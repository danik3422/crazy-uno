import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Card, ThemeId } from '../../game/types';
import { DRAG_HEIGHT, drag, dropZone, keySel } from './drag';
import { SPIN_TIME, fxState, nowSec } from '../effects/fxState';
import { lastPlace, spawn, type Target } from '../layout';
import { cardBodyGeometry, cardFaceGeometry, CARD_H, CARD_W } from './cardShape';
import { cardTexture } from './textures';
import { THEMES } from '../themes/index';

/** the printed faces, cut to the card's rounded outline */
const plane = cardFaceGeometry();
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const THICK = 0.012;
/** seconds between cards when several are drawn in one go */
const DRAW_GAP = 0.16;
const deckQueue = { at: 0 };
/**
 * The cards that left the deck in one frame (a +4, a draw until playable, a rain…). They are visited in no
 * particular order, so each newcomer re-sorts the batch (by owner, then place in the hand) and every flight
 * of the batch gets its slot again; none of them has started yet, so nothing jumps.
 */
const deckBatch = { frame: -1, base: 0, list: [] as { key: number; f: Flight }[] };

/** The card's body: a thin rounded slab, so a tilted card shows a real edge instead of a paper plane. */
const body = cardBodyGeometry(THICK);
/** how high a hovered hand card rises: its pointer zone reaches that far up, so the lifted card stays under the pointer */
const HOVER_REACH = 0.36;
/**
 * A hand card's pointer zone: the card's own outline where it rests (plus, while hovered, the strip it rises into).
 * It does not move or grow with the card, so the hovered card cannot steal the pointer from its neighbours.
 */
const hitPlane = new THREE.PlaneGeometry(CARD_W, CARD_H);
/** the zone of the card under the pointer reaches up to where it has risen, so it keeps the pointer */
const hitPlaneLifted = new THREE.PlaneGeometry(CARD_W, CARD_H + HOVER_REACH).translate(0, HOVER_REACH / 2, 0);
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false, side: THREE.DoubleSide });
const edgeMat = new THREE.MeshStandardMaterial({ color: '#e4ddcf', roughness: 0.7 });
/** the same edge for a card held up out of the hand: drawn over its neighbours instead of cutting through them */
const edgeMatTop = Object.assign(edgeMat.clone(), { depthTest: false, transparent: true });
/** draw order of a held card's parts (edge, then faces) when it is drawn over the hand */
const TOP_ORDER = 1000;

/** A soft glow the shape of a card, behind cards you can play right now. Shared: they all pulse together. */
const glowPlane = new THREE.PlaneGeometry(CARD_W * 1.42, CARD_H * 1.3);
const glowMat = (() => {
  const W = 132;
  const H = 186;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(18, 18, W - 36, H - 36, 16);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, color: '#fff2b0', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
})();
/**
 * Jump-In: a card you may throw in out of turn glows bright white and pulses fast, so it reads as "now or never".
 * Not additive: the table is always tinted the card's own colour then, and an additive glow would wash out on it.
 */
const jumpGlowMat = glowMat.clone();
jumpGlowMat.color.set('#ffffff');
jumpGlowMat.blending = THREE.NormalBlending;
/** Each table glows its playable cards in its own colour. */
export function setPlayableGlow(color: string) {
  glowMat.color.set(color);
}

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** a toss: leaves the hand with speed and glides in */
const easeOut = (p: number) => {
  // cubic Hermite: leaves the hand with some speed (but no snap) and still has momentum when it lands
  const m0 = 0.55;
  const m1 = 0.3;
  return (p ** 3 - 2 * p ** 2 + p) * m0 + (3 * p ** 2 - 2 * p ** 3) + (p ** 3 - p ** 2) * m1;
};
/** the little pop when a card hits the pile */
const SLAM = 0.24;
const slamPop = (since: number) => (since > 0 && since < SLAM ? Math.sin((since / SLAM) * Math.PI) * 0.07 : 0);

/** A scripted hop from one place to another: lifts off, arcs over the table, turns over in the air, lands. */
interface Flight {
  t0: number;
  dur: number;
  from: THREE.Vector3;
  /** start orientation; for a turn-over, already flipped onto the other side (see flipQ) */
  fromQ: THREE.Quaternion;
  apex: number;
  /** size at take-off (fan cards are smaller): it grows or shrinks to the new size on the way */
  fromS: number;
  toss: boolean;
  /** the card turns over on the way (face down -> face up or back): it rolls around its long side */
  flip: boolean;
  /** a short, plain hop back into your hand (the held card after a pass): no table flourishes */
  tuck?: boolean;
}
const NORMAL = new THREE.Vector3();
const TO_CAM = new THREE.Vector3();
const FLIP = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI);
/** which side of a card the camera sees: > 0 the face, < 0 the back */
function faceSide(q: THREE.Quaternion) {
  NORMAL.set(0, 0, 1).applyQuaternion(q);
  // the camera looks down at the table from the near side
  return NORMAL.y * 0.8 + NORMAL.z * 0.6;
}

/**
 * Critically damped spring (like Unity's SmoothDamp): starts gently, never overshoots, settles softly.
 * Unlike plain exponential easing it has no jolt on the first frame of a move.
 */
function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

interface Props {
  card: Card;
  t: Target;
  theme: ThemeId;
  onPick: (id: number) => void;
}

/**
 * A card that always flies toward its target transform.
 * Moving between zones (deal, play, swap, chaos…) animates automatically:
 * the card arcs up while far from its target and settles with exponential damping.
 */
/** One level deep: equal fields, and arrays (positions, angles) equal element by element. */
function sameFields<T extends object>(a: T, b: T): boolean {
  if (a === b) return true;
  const ka = Object.keys(a) as (keyof T)[];
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every(k => {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((v, i) => v === y[i]);
    return x === y;
  });
}

/**
 * The layout makes new card and target objects on every change of the game, so the default comparison would redraw
 * all 100+ cards on every move. A card whose place and face did not change keeps its render (its motion runs in useFrame).
 */
const sameCard = (a: Props, b: Props) =>
  a.theme === b.theme && a.onPick === b.onPick && sameFields(a.card, b.card) && sameFields(a.t, b.t);

export const Card3D = memo(function Card3D({ card, t, theme, onPick }: Props) {
  const motion = THEMES[theme].motion;
  const ref = useRef<THREE.Group>(null!);
  const frontMat = useRef<THREE.MeshStandardMaterial>(null!);
  const frontRef = useRef<THREE.Mesh>(null!);
  const backRef = useRef<THREE.Mesh>(null!);
  const bodyRef = useRef<THREE.Mesh>(null!);
  const backMat = useRef<THREE.MeshStandardMaterial>(null!);
  /** held, dragged or lifted under the pointer: drawn on top of the rest of the hand */
  const onTop = useRef(false);
  const glowRef = useRef<THREE.Mesh>(null!);
  const hovered = useRef(false);
  const hitRef = useRef<THREE.Mesh>(null);
  const startAt = useRef<number | null>(null);
  const placed = useRef(false);
  const tq = useMemo(() => new THREE.Quaternion(), []);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  const lastPos = useRef<[number, number, number] | null>(null);
  const lastZone = useRef(t.zone);
  const slamAt = useRef(-10);
  /** this card falls out of the bombing plane: hidden until released, then tumbles down */
  const dropping = useRef(false);
  const eul = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const vel = useMemo(() => ({ x: { v: 0 }, y: { v: 0 }, z: { v: 0 }, s: { v: 0 } }), []);
  const flight = useRef<Flight | null>(null);
  /** the card has not made its first move yet (it waits in the deck or where it was) */
  const launched = useRef(false);
  /** started somewhere else than its new place (online re-id), and should hop from there */
  const hopFromPrev = useRef(false);
  /** moved to another seat without changing zone (hands swapped or passed on): fly there properly */
  const farMove = useRef(false);
  /** was held up in front of you (the drawn card): going back into the hand is a proper flight too */
  const wasHeld = useRef(false);
  /** whose fan this card stands in (Target.bobGroup) */
  const lastOwner = useRef(t.bobGroup ?? 0);
  const tucking = useRef(false);
  const fq = useMemo(() => new THREE.Quaternion(), []);
  const tRef = useRef(t);
  tRef.current = t;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const { camera, gl } = useThree();

  /** Grab a playable hand card: follow the finger over the table, drop it on the pile to play. */
  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    const tt = tRef.current;
    if (!tt.interactive || tt.zone !== 'hand' || e.button > 0) return;
    e.stopPropagation();
    drag.id = card.id;
    drag.moved = false;
    drag.over = false;
    drag.startX = e.nativeEvent.clientX;
    drag.startY = e.nativeEvent.clientY;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_HEIGHT);
    const move = (ev: PointerEvent) => {
      if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 10) return;
      drag.moved = true;
      document.body.style.cursor = 'grabbing';
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, drag.point)) return;
      // anywhere near the pile, or simply pushed well up from the hand, counts as "play it"
      const near = Math.hypot(drag.point.x - dropZone.x, drag.point.z - dropZone.z) < dropZone.radius;
      drag.over = near || drag.point.z < dropZone.handZ - 2.2;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.cursor = '';
      if (drag.moved) {
        drag.suppressClickUntil = performance.now() + 350;
        if (drag.over && tRef.current.interactive) pickRef.current(card.id);
      }
      drag.id = null;
      drag.moved = false;
      drag.over = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  useFrame((st, rawDt) => {
    // the same number for every card within one frame
    const frameKey = st.clock.elapsedTime;
    // a long frame (tab switch, GC pause) must not teleport cards: cap the step
    const dt = Math.min(rawDt, 1 / 30);
    const g = ref.current;
    const tt = tRef.current;
    const now = nowSec();
    // remember where this card really was last frame (see lastPlace)
    if (placed.current) {
      const q = g.quaternion;
      const e = lastPlace.get(card.id);
      if (e) {
        e.pos[0] = g.position.x; e.pos[1] = g.position.y; e.pos[2] = g.position.z;
        e.quat[0] = q.x; e.quat[1] = q.y; e.quat[2] = q.z; e.quat[3] = q.w;
        e.zone = lastZone.current;
      } else lastPlace.set(card.id, { pos: [g.position.x, g.position.y, g.position.z], quat: [q.x, q.y, q.z, q.w], zone: lastZone.current });
    }
    // the camera only ever sees one side of a card: skip drawing the other (half the face draw calls).
    // Decided from last frame's pose, with a wide margin so a fast flip never hides the side coming into view.
    if (placed.current) {
      NORMAL.set(0, 0, 1).applyQuaternion(g.quaternion);
      TO_CAM.subVectors(camera.position, g.position);
      const facing = NORMAL.dot(TO_CAM) / (TO_CAM.length() || 1);
      frontRef.current.visible = facing > -0.3;
      backRef.current.visible = facing < 0.3;
    }
    const inHandZone = tt.zone === 'hand' || tt.zone === 'opp';
    const bombing = fxState.drop.until > now && inHandZone;
    if (!placed.current) {
      // first frame: start in the deck, then wait for this card's turn in the deal
      // online a card may have just changed its id: start where it was under the old one
      // after a rebuilt canvas (lost GPU context) cards reappear right where they were
      const settled = Number.isFinite(fxState.dealAt) && fxState.dealAt < now ? lastPlace.get(card.id) : undefined;
      const prev = (card.fromId !== undefined ? lastPlace.get(card.fromId) : undefined) ?? settled;
      g.position.set(...(prev?.pos ?? spawn.pos));
      if (prev) g.quaternion.set(...prev.quat);
      else {
        eul.set(Math.PI / 2, -0.35, 0);
        g.quaternion.setFromEuler(eul);
      }
      startAt.current = prev ? 0 : null;
      // it came from another zone under its old id (an opponent's card hitting the pile): hop over
      hopFromPrev.current = !!prev && prev !== settled && prev.zone !== tt.zone;
      if (prev === settled && prev) launched.current = true;
      placed.current = true;
      if (bombing) {
        // a brand-new card (online) during a bombing run comes out of the plane
        dropping.current = true;
        startAt.current = fxState.drop.at + (Math.abs(card.id) % 4) * 0.14;
      }
    }
    // the deal has not started yet (table still loading): stay in the deck
    if (startAt.current === null) {
      // until the deal reaches it, a card waits inside the deck, wherever the deck is (shuffled mid-table)
      const o = fxState.deckOffset;
      g.position.set(spawn.pos[0] + o[0], spawn.pos[1] + o[1], spawn.pos[2] + o[2]);
      if (!Number.isFinite(fxState.dealAt) || now < fxState.dealAt) {
        g.visible = tt.zone === 'deck' && !tt.hidden && !fxState.deckHidesTop;
        if (tt.zone === 'deck') g.position.set(tt.pos[0] + o[0], tt.pos[1] + o[1], tt.pos[2] + o[2]);
        return;
      }
      // the stagger only applies to the opening deal; a card drawn later leaves the deck at once
      const inDeal = now < fxState.dealEnd;
      startAt.current = Math.max(now, fxState.dealAt) + (inDeal ? tt.delay : 0);
    }
    // a new destination during a hold (e.g. a meteor still falling) waits for the impact
    const lp = lastPos.current;
    if (!lp || lp[0] !== tt.pos[0] || lp[1] !== tt.pos[1] || lp[2] !== tt.pos[2]) {
      // passed on to another opponent (swap, gift, 7-0): a proper flight even between neighbours
      const owner = tt.bobGroup ?? 0;
      if (lp && launched.current && inHandZone && tt.zone === lastZone.current && (Math.hypot(tt.pos[0] - lp[0], tt.pos[2] - lp[2]) > 2.5 || owner !== lastOwner.current)) farMove.current = true;
      lastOwner.current = owner;
      if (lp && bombing && lastZone.current === 'deck') {
        dropping.current = true;
        startAt.current = fxState.drop.at + (Math.abs(card.id) % 4) * 0.14;
      } else if (lp && fxState.holdUntil > now) startAt.current = Math.max(startAt.current!, fxState.holdUntil + (card.id % 10) * 0.045);
      lastPos.current = tt.pos;
    }
    if (!!tt.held !== wasHeld.current) {
      // tucked into the hand after a pass (or a timeout): a short hop, not a slow drift
      if (wasHeld.current && launched.current && tt.zone === lastZone.current) farMove.current = tucking.current = true;
      wasHeld.current = !!tt.held;
    }
    if (dropping.current) {
      if (now < startAt.current!) {
        g.visible = false;
        return;
      }
      // release: appear under the plane, spinning, then fall into the hand
      dropping.current = false;
      g.position.set(...fxState.drop.pos);
      eul.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      g.quaternion.setFromEuler(eul);
      g.scale.setScalar(0.6);
      vel.x.v = vel.y.v = vel.z.v = 0;
    }
    // cards buried in the deck or deep in the pile are not drawn (and cast no shadow);
    // the real top cards hide while the deck is being riffled
    // cards still lying on the deck (its top, or waiting for the deal) hide while the stack draws its own top
    const onDeck = tt.zone === 'deck' || (!launched.current && now < startAt.current!);
    g.visible = !tt.hidden && !(onDeck && fxState.deckHidesTop);
    if (now < startAt.current!) {
      // still waiting for its turn in the deal: it lies on the deck and rides along when the deck moves
      if (!launched.current && !hopFromPrev.current && !dropping.current) {
        const o = fxState.deckOffset;
        g.position.set(spawn.pos[0] + o[0], spawn.pos[1] + o[1], spawn.pos[2] + o[2]);
      }
      return;
    }
    // fly properly on the first move out of the deck and every time a card changes hands
    const zoneChanged = tt.zone !== lastZone.current || farMove.current;
    farMove.current = false;
    if (!launched.current || zoneChanged) {
      const fromDeck = !launched.current && !hopFromPrev.current;
      if (zoneChanged || fromDeck || hopFromPrev.current) {
        const dist = Math.hypot(tt.pos[0] - g.position.x, tt.pos[2] - g.position.z);
        const dealing = now < fxState.dealEnd;
        const toss = tt.zone === 'discard' && !dealing;
        // a played card is quick and decisive; a draw travels a little slower
        const dur = dealing ? 0.42 : toss ? THREE.MathUtils.clamp(0.36 + dist * 0.045, 0.42, 0.66) : THREE.MathUtils.clamp(0.42 + dist * 0.05, 0.5, 0.75);
        // several cards leaving the deck at once (draw until playable, +N penalties): one after another
        let t0 = now;
        const leavesDeck = (fromDeck || lastZone.current === 'deck') && !dealing;
        // after a reconnect the hands are laid out all at once; real draws leave the deck one after another
        const relayout = now < fxState.revealFrom;
        if (leavesDeck && !relayout) {
          if (deckBatch.frame !== frameKey) {
            deckBatch.frame = frameKey;
            deckBatch.base = Math.max(now, deckQueue.at);
            deckBatch.list = [];
          }
          t0 = deckBatch.base + deckBatch.list.length * DRAW_GAP;
          deckQueue.at = t0 + DRAW_GAP;
        }
        eul.set(...tt.rot);
        tq.setFromEuler(eul);
        const flip = faceSide(g.quaternion) * faceSide(tq) < 0;
        const fromQ = g.quaternion.clone();
        if (flip) fromQ.multiply(FLIP);
        const tuck = tucking.current && tt.zone === 'hand';
        tucking.current = false;
        flight.current = tuck
          ? { t0, dur: 0.42, from: g.position.clone(), fromQ, apex: 0.12, fromS: g.scale.x, toss: false, flip, tuck }
          : { t0, dur, from: g.position.clone(), fromQ, apex: (toss ? 0.5 : 0.45) + dist * 0.1, fromS: g.scale.x, toss, flip };
        if (leavesDeck && !relayout && deckBatch.frame === frameKey) {
          deckBatch.list.push({ key: (tt.bobGroup ?? 0) * 1000 + (tt.seq ?? 0), f: flight.current });
          deckBatch.list.sort((p, q) => p.key - q.key);
          deckBatch.list.forEach((b, i) => (b.f.t0 = deckBatch.base + i * DRAW_GAP));
          t0 = flight.current.t0;
        }
        if (leavesDeck && tt.zone !== 'discard') fxState.drawLandAt = Math.max(fxState.drawLandAt, ...deckBatch.list.map(b => b.f.t0 + b.f.dur), t0 + flight.current.dur);
        if (tt.zone === 'discard') {
          // the slam when it lands; the pile's flash and ring wait for the same moment
          slamAt.current = t0 + dur;
          fxState.landAt = t0 + dur;
        }
      }
      launched.current = true;
      hopFromPrev.current = false;
      lastZone.current = tt.zone;
    }

    let [x, y, z] = tt.pos;
    let [rx, ry, rz] = tt.rot;
    // the deck moves (shuffled in the middle, then slides home): its cards ride along
    if (tt.zone === 'deck') {
      const o = fxState.deckOffset;
      x += o[0];
      y += o[1];
      z += o[2];
    }
    const dragging = drag.id === card.id && drag.moved;
    // a card you hold, drag or lift is drawn over the others: lifted out of an overlapping fan it would cut through its neighbours
    // while another card is being dragged, the ones under the pointer stay down
    const otherDragged = drag.id !== null && drag.id !== card.id && drag.moved;
    const top = tt.zone === 'hand' && (drag.id === card.id || (!otherDragged && ((hovered.current || keySel.id === card.id) && tt.interactive || !!tt.held)));
    if (top !== onTop.current) {
      onTop.current = top;
      bodyRef.current.material = top ? edgeMatTop : edgeMat;
      bodyRef.current.renderOrder = top ? TOP_ORDER : 0;
      // without a depth test the card writes no depth either, so it must also be drawn after every glow and effect
      // (the see-through pass, last of all), or those would paint over it
      for (const [mesh, mat] of [[frontRef.current, frontMat.current], [backRef.current, backMat.current]] as const) {
        mesh.renderOrder = top ? TOP_ORDER + 1 : 0;
        mat.depthTest = !top;
        mat.transparent = top;
        mat.needsUpdate = true;
      }
    }
    const chaos = now < fxState.chaosUntil && (tt.zone === 'hand' || tt.zone === 'opp');
    if (chaos) {
      // a tornado over the pile, sized to the table (smaller on phones), low enough to stay clear of the name plates
      const a = card.id * 2.39996 + now * 4.2;
      const k = dropZone.radius / 2.6;
      const r = (1.1 + (card.id % 6) * 0.36) * k;
      x = dropZone.x + Math.cos(a) * r;
      z = dropZone.z + 0.5 + Math.sin(a) * r * 0.8;
      y = 0.9 + (card.id % 9) * 0.16 + Math.sin(now * 3 + card.id) * 0.2;
      if (tt.zone === 'opp') {
        // someone else's cards swirl back up (only rocking a little), so nobody gets a peek
        rx = Math.PI / 2 + Math.sin(now * 3 + card.id) * 0.35;
        ry = now * 2 + card.id;
        rz = 0;
      } else {
        rx = now * 3 + card.id;
        ry = now * 2;
        rz = card.id;
      }
    } else if (dragging) {
      x = drag.point.x;
      y = drag.point.y + (drag.over ? 0.15 : 0);
      z = drag.point.z;
      rx = drag.over ? -1.35 : -0.95;
      ry = 0;
      rz = 0;
    } else if (!otherDragged && (hovered.current || keySel.id === card.id) && tt.interactive) {
      // lift toward the viewer along the card's own normal, never sideways into its neighbours
      y += (tt.held ? 0.12 : 0.3) * motion.hoverLift;
      z += (tt.held ? 0.08 : 0.16) * motion.hoverLift;
    } else if (tt.held && !otherDragged) {
      // held up in front of you: it floats gently, waiting to be played
      y += Math.sin(now * 2.4) * 0.05;
      rz += Math.sin(now * 1.3) * 0.035;
    }

    // the swirl wins over a spin: both at once would whip the card around
    const spinning = (tt.zone === 'hand' || tt.zone === 'opp') && now < fxState.spinUntil && !chaos && !dragging;
    if (spinning) y += Math.sin((1 - (fxState.spinUntil - now) / SPIN_TIME) * Math.PI) * 0.7;
    // a scripted hop in progress finishes even through a spin (the spin would snap the card over);
    // a card picked up by the finger or caught by the swirl leaves it and springs on from where it is
    const f = flight.current;
    if (f && !dragging && !chaos) {
      // waiting its turn in a multi-card draw: stays on top of the deck until then
      const p = THREE.MathUtils.clamp((now - f.t0) / f.dur, 0, 1);
      // a played card is tossed: it glides over and comes down onto the pile with some weight (a falling arc);
      // everything else lifts off, travels and sets down softly
      const e = f.toss ? easeOut(p) : easeInOut(p);
      const arc = f.toss ? 4 * e * (1 - e) : Math.sin(Math.PI * e);
      // the table's own way of flying: higher or lower arcs, and an S-swing sideways
      const sw = motion.sway && !f.tuck ? Math.sin(Math.PI * 2 * e) * motion.sway : 0;
      const ddx = x - f.from.x;
      const ddz = z - f.from.z;
      const dl = Math.hypot(ddx, ddz) || 1;
      g.position.set(
        f.from.x + ddx * e - (ddz / dl) * sw,
        f.from.y + (y - f.from.y) * e + arc * f.apex * (f.tuck ? 1 : motion.arc),
        f.from.z + ddz * e + (ddx / dl) * sw,
      );
      eul.set(rx, ry, rz);
      tq.setFromEuler(eul);
      // turn toward the landing pose; a card that changes sides also rolls over its long edge on the way,
      // instead of tumbling around whatever axis happens to be shortest
      fq.copy(f.fromQ).slerp(tq, e);
      if (f.flip) fq.multiply(spinQ.setFromAxisAngle(Y_AXIS, Math.PI * (1 - e)));
      if (motion.spin && !f.tuck) fq.multiply(spinQ.setFromAxisAngle(Z_AXIS, motion.spin * Math.PI * 2 * (1 - e)));
      g.quaternion.copy(fq);
      vel.x.v = vel.y.v = vel.z.v = 0;
      if (p >= 1) flight.current = null;
      // a touch bigger in the air (closer to the camera), exactly its size again when it lands
      const size = f.fromS + ((tt.scale ?? 1) - f.fromS) * e;
      g.scale.setScalar(size * (1 + Math.sin(Math.PI * p) * 0.1));
      vel.s.v = 0;
      const shade = tt.dim ? 0.5 : 1;
      const c = frontMat.current.color;
      c.setScalar(c.r + (shade - c.r) * Math.min(1, dt * 8));
      return;
    }
    if (f) flight.current = null;

    // lying on the deck: part of the stack, it moves with it exactly (a spring would trail behind a sliding deck)
    if (tt.zone === 'deck' && !dragging && !chaos) {
      g.position.set(x, y, z);
      eul.set(rx, ry, rz);
      g.quaternion.setFromEuler(eul);
      g.scale.setScalar(tt.scale ?? 1);
      vel.x.v = vel.y.v = vel.z.v = vel.s.v = 0;
      return;
    }

    // how long a move takes to settle: snappy under the finger, a touch slower for a swirl;
    // a spin turns the card fast but moves it at the usual pace
    const smooth = dragging ? 0.05 : chaos ? 0.22 : 0.17;
    const k = 1 - Math.exp(-dt / ((spinning ? 0.05 : smooth) * 0.55));
    const dx = x - g.position.x;
    const dz = z - g.position.z;
    // in-hand flights arc up; a card under the finger goes straight there
    const far = dragging ? 0 : Math.min(Math.hypot(dx, dz), 6);
    g.position.x = smoothDamp(g.position.x, x, vel.x, smooth, dt);
    g.position.z = smoothDamp(g.position.z, z, vel.z, smooth, dt);
    // some tables let the cards in the hands drift gently up and down
    // the whole hand (and each opponent's wall) bobs as one piece: cards overlap in a fan, so bobbing each on its own
    // would push them through their neighbours
    const group = tt.bobGroup ?? 0;
    const bob = motion.float && !dragging && (tt.zone === 'hand' || tt.zone === 'opp') ? Math.sin(now * 1.6 + group * 1.7) * motion.float : 0;
    g.position.y = smoothDamp(g.position.y, y + far * 0.3 + bob, vel.y, smooth, dt);
    eul.set(rx, ry, rz);
    tq.setFromEuler(eul);
    if (spinning) {
      const prog = 1 - (fxState.spinUntil - now) / SPIN_TIME;
      // your own cards turn over twice; someone else's only twirl in place, so their faces never show
      const turn = THREE.MathUtils.smoothstep(prog, 0, 1) * Math.PI * 4;
      tq.multiply(spinQ.setFromAxisAngle(tt.zone === 'hand' ? Y_AXIS : Z_AXIS, tt.zone === 'hand' ? turn : turn / 2));
    }
    g.quaternion.slerp(tq, k);

    // a played card lands with a little slam: it grows in flight and settles on the pile
    const slam = slamPop(now - slamAt.current);
    const base = tt.scale ?? 1;
    const sTarget = dragging ? (drag.over ? 1.25 : 1.12) : !otherDragged && (hovered.current || keySel.id === card.id) && tt.interactive ? base * 1.12 : base;
    if (slam) {
      // a short, exact pop: the spring would lag behind it and leave the card swollen
      g.scale.setScalar(base * (1 + slam));
      vel.s.v = 0;
    } else g.scale.setScalar(smoothDamp(g.scale.x, sTarget, vel.s, 0.12, dt));

    if (hitRef.current) hitRef.current.geometry = hovered.current && tt.interactive ? hitPlaneLifted : hitPlane;
    // playable cards are simply raised (see layout); the rest are dimmed
    const shade = tt.dim ? 0.42 : 1;
    const c = frontMat.current.color;
    c.setScalar(c.r + (shade - c.r) * k);
  });

  // after the card has moved: the glow behind a playable card
  useFrame(st => {
    const g = ref.current;
    const tt = tRef.current;
    const glow = glowRef.current;
    const settled = !flight.current;
    glow.visible = tt.interactive && tt.zone === 'hand' && settled && g.visible && !(drag.id === card.id && drag.moved);
    if (!glow.visible) return;
    if (tt.jump) {
      // Jump-In: its own hot glow, pulsing fast and swelling
      const k = Math.sin(st.clock.elapsedTime * 9);
      glow.material = jumpGlowMat;
      jumpGlowMat.opacity = 0.7 + k * 0.3;
      glow.scale.setScalar(1.08 + k * 0.07);
    } else {
      glow.material = glowMat;
      glow.scale.setScalar(1);
      glowMat.opacity = 0.42 + Math.sin(st.clock.elapsedTime * 3) * 0.12;
    }
  });

  const inHand = t.zone === 'hand';
  const handlers = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (!t.interactive) return;
      e.stopPropagation();
      hovered.current = true;
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      hovered.current = false;
      document.body.style.cursor = '';
    },
    onPointerDown: startDrag,
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (!t.interactive) return;
      e.stopPropagation();
      if (performance.now() < drag.suppressClickUntil) return;
      hovered.current = false;
      document.body.style.cursor = '';
      onPick(card.id);
    },
  };

  const front = cardTexture(card, theme);
  const back = cardTexture(null, theme);

  return (
    <>
    {/* in the hand the pointer is caught by a still zone where the card rests (see hitPlane), not by the moving card */}
    {inHand && (
      <mesh ref={hitRef} geometry={hitPlane} material={hitMat} position={t.pos} rotation={[t.rot[0], t.rot[1], t.rot[2], 'YXZ']} scale={t.scale ?? 1} {...handlers} />
    )}
    <group ref={ref} userData={{ fit: 'card', id: card.id }} {...(inHand ? {} : handlers)}>
      <mesh ref={bodyRef} geometry={body} material={edgeMat} castShadow />
      <mesh ref={frontRef} geometry={plane} position-z={THICK / 2 + 0.0015}>
        <meshStandardMaterial ref={frontMat} map={front} roughness={0.38} metalness={0} />
      </mesh>
      <mesh ref={backRef} geometry={plane} position-z={-THICK / 2 - 0.0015} rotation={[0, Math.PI, Math.PI]}>
        <meshStandardMaterial ref={backMat} map={back} roughness={0.38} />
      </mesh>
      <mesh ref={glowRef} geometry={glowPlane} material={glowMat} position-z={-THICK / 2 - 0.006} visible={false} />
    </group>
    </>
  );
}, sameCard);
