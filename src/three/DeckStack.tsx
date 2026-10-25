import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ThemeId } from '../game/types';
import { DECK_SLIDE_MS, SHUFFLE_MS } from '../net/protocol';
import { fxState, nowSec } from './fxState';
import { DECK_TOP, type Vec3 } from './layout';
import { cardTexture } from './textures';

/** the stack is drawn as this many thick "cards" (each stands for a few real ones) */
const LAYERS = 22;
const HALF = LAYERS / 2;
const H = DECK_TOP / LAYERS;
const W = 0.97;
const L = 1.47;
const SHUFFLE = SHUFFLE_MS / 1000;
const ROUND = SHUFFLE / 2;
const SLIDE = DECK_SLIDE_MS / 1000;
/** how far each half moves aside: the two halves never overlap (card width plus turn and jitter) */
const SPREAD = 0.62;
/** the halves are held this much above the growing pile while it is riffled together */
const HOLD = 0.05;
/** how the stack is turned when it rests in its spot */
const REST_YAW = -0.35;

/** One layer of the deck: a rounded card shape with the back on both faces and card edges around. */
const slabGeometry = (() => {
  const r = 0.11;
  const s = new THREE.Shape();
  s.moveTo(-W / 2 + r, -L / 2);
  s.lineTo(W / 2 - r, -L / 2);
  s.quadraticCurveTo(W / 2, -L / 2, W / 2, -L / 2 + r);
  s.lineTo(W / 2, L / 2 - r);
  s.quadraticCurveTo(W / 2, L / 2, W / 2 - r, L / 2);
  s.lineTo(-W / 2 + r, L / 2);
  s.quadraticCurveTo(-W / 2, L / 2, -W / 2, L / 2 - r);
  s.lineTo(-W / 2, -L / 2 + r);
  s.quadraticCurveTo(-W / 2, -L / 2, -W / 2 + r, -L / 2);
  // a hair thinner than a layer: neighbours never share a face, so nothing flickers between them
  const g = new THREE.ExtrudeGeometry(s, { depth: H * 0.9, bevelEnabled: false, curveSegments: 5 });
  // lie flat: the shape goes onto the table plane, the thickness points up (0 … depth)
  g.rotateX(-Math.PI / 2);
  return g;
})();

/** Side of a layer: cream with fine darker seams, a few per layer, so the stack reads as many cards. */
function edgeTexture() {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#f3efe4';
  ctx.fillRect(0, 0, 8, 128);
  for (let y = 0; y < 128; y += 4) {
    ctx.fillStyle = y % 8 ? 'rgba(80,60,40,.16)' : 'rgba(80,60,40,.28)';
    ctx.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  // side walls get world-sized UVs: the layer is H tall, show about four seams on it
  t.repeat.set(1, 4 / 32 / H);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = (p: number) => 1 - (1 - p) * (1 - p);

/** One riffle: cut in two, then the halves fall together alternately, bottom first. */
function riffle(order: number[]) {
  const out: number[] = [];
  for (let r = 0; r < HALF; r++) out.push(order[r], order[HALF + r]);
  return out;
}
const rankOf = (order: number[]) => {
  const rank: number[] = [];
  order.forEach((slab, k) => (rank[slab] = k));
  return rank;
};

/**
 * The draw pile, as in the console UNO games: a tall, slightly messy stack that never runs out.
 * At the start of a round it sits exactly in the middle of the table and is riffle-shuffled twice,
 * the hands are dealt from there, then it slides over to its resting spot and the pile gets its first card.
 *
 * The riffle is built so that no two layers ever pass through each other: the halves first move apart
 * sideways (the upper half lifted clear of the lower one), only then take their heights, and each layer
 * drops into the slot right above the previous one.
 */
export function DeckStack({ at, center, theme, slideAt, portrait }: { at: Vec3; center: Vec3; theme: ThemeId; slideAt: number; portrait: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const turn = useRef<THREE.Group>(null!);
  // all layers are one instanced mesh: two draw calls for the whole stack instead of two per layer
  const slabs = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // on a narrow phone the halves part along the screen's long side, so they stay clear of the side plates;
  // the deck turns back to its usual angle on the way to its spot
  const yawMid = portrait ? -Math.PI / 2 + 0.2 : REST_YAW;
  const live = useMemo(() => new THREE.Vector3(), []);

  const materials = useMemo(() => {
    // the card back on the caps: the shape's own coordinates (-W/2…W/2, -L/2…L/2) become 0…1
    const back = cardTexture(null, theme).clone();
    back.needsUpdate = true;
    back.repeat.set(1 / W, 1 / L);
    back.offset.set(0.5, 0.5);
    const face = new THREE.MeshStandardMaterial({ map: back, roughness: 0.4 });
    const side = new THREE.MeshStandardMaterial({ map: edgeTexture(), roughness: 0.8 });
    return [face, side];
  }, [theme]);
  useLayoutEffect(() => () => materials.forEach(m => { m.map?.dispose(); m.dispose(); }), [materials]);

  // a little untidy, like a real pile: each layer turned and shifted a touch
  const jitter = useMemo(
    () =>
      Array.from({ length: LAYERS }, (_, i) => ({
        rot: Math.sin(i * 12.9898) * 0.04,
        dx: Math.sin(i * 78.233) * 0.022,
        dz: Math.cos(i * 37.719) * 0.022,
      })),
    [],
  );
  // which layer is at which height before, between and after the two riffles
  const ranks = useMemo(() => {
    const o0 = Array.from({ length: LAYERS }, (_, i) => i);
    const o1 = riffle(o0);
    return [rankOf(o0), rankOf(o1), rankOf(riffle(o1))];
  }, []);

  /** where the whole stack is: the middle of the table until the hands are dealt, then a short slide home */
  const place = (now: number) => {
    const dealAt = fxState.dealAt;
    const leave = dealAt + slideAt;
    let k = 1;
    let lift = 0;
    if (!Number.isFinite(dealAt) || now < leave) k = 0;
    else if (now < leave + SLIDE) {
      const p = (now - leave) / SLIDE;
      k = easeInOut(p);
      lift = Math.sin(Math.PI * p) * 0.3;
    }
    live.set(center[0] + (at[0] - center[0]) * k, lift, center[2] + (at[2] - center[2]) * k);
    group.current.position.copy(live);
    turn.current.rotation.y = yawMid + (REST_YAW - yawMid) * k;
    fxState.deckOffset = [live.x - at[0], live.y, live.z - at[2]];
  };
  // before the first frame, so the top cards never show up at the resting spot for a moment
  useLayoutEffect(() => place(nowSec()), [at, center, slideAt, yawMid]);

  useFrame(() => {
    const now = nowSec();
    place(now);
    const dealAt = fxState.dealAt;
    const t = now - (dealAt - SHUFFLE);
    const shuffling = Number.isFinite(dealAt) && t >= 0 && t < SHUFFLE;
    fxState.shuffling = shuffling;
    fxState.deckHidesTop = shuffling || Math.abs(turn.current.rotation.y - REST_YAW) > 0.01;
    const done = Number.isFinite(dealAt) && t >= SHUFFLE;

    for (let i = 0; i < LAYERS; i++) {
      const j = jitter[i];
      let x = 0;
      let y: number;
      let yaw = 0;
      if (!shuffling) {
        y = (done ? ranks[2][i] : ranks[0][i]) * H;
      } else {
        const round = t < ROUND ? 0 : 1;
        const p = (t - round * ROUND) / ROUND; // 0…1 within this riffle
        const k = ranks[round][i]; // height of this layer when the riffle starts
        const upper = k >= HALF;
        const r = upper ? k - HALF : k; // its place inside its half
        const side = upper ? 1 : -1;
        const slot = upper ? 2 * r + 1 : 2 * r; // where it lands in the riffled pile
        const start = k * H;
        const held = slot * H + HOLD; // in the hand, right above its slot
        // 1. the cut: the halves move apart, the upper one lifted clear of the lower one
        const apart = smooth(p / 0.2);
        // 2. once they are clear of each other, every layer takes the height it will be released from
        const settle = smooth((p - 0.2) / 0.14);
        // 3. the riffle: bottom first, alternating halves, each layer drops into its slot
        const dropAt = 0.38 + (slot / LAYERS) * 0.46;
        const drop = (p - dropAt) / 0.08;
        const fell = drop >= 1 ? 1 : drop <= 0 ? 0 : easeOut(drop);
        const lifted = upper ? 0.1 * apart * (1 - settle) : 0;
        const hy = start + lifted + (held - start) * settle;
        // it moves in over the pile first and comes down the last bit, never through the layer above
        x = side * SPREAD * apart * (1 - fell);
        y = hy - HOLD * smooth((drop - 0.35) / 0.65);
        // the halves are bent a little in the hands: a slight turn that straightens as the layer lands
        yaw = side * 0.06 * apart * (1 - fell);
        // 4. square up: a light tap that settles the stack
        if (p > 0.88) y += Math.sin(((p - 0.88) / 0.12) * Math.PI) * 0.012 * (slot / LAYERS);
      }
      dummy.position.set(x + j.dx, y, j.dz);
      dummy.rotation.set(0, j.rot + yaw, 0);
      dummy.updateMatrix();
      slabs.current.setMatrixAt(i, dummy.matrix);
    }
    slabs.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={group} position={[at[0], 0, at[2]]}>
      <group ref={turn} rotation-y={REST_YAW}>
        <instancedMesh ref={slabs} args={[slabGeometry, materials, LAYERS]} castShadow receiveShadow frustumCulled={false} />
      </group>
    </group>
  );
}
