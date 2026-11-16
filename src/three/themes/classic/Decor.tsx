import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { arena } from '../../layout/table';
import type { DecorProps } from '../types';
import { Placer, useHudZones, type Placed } from '../decorKit';
import { FLOOR_Z, MARQUEE_R } from './floor';
import { HEAD_Y, STAND_BALL, beamGeometry, standGeometry } from './stage';
import { Sparkles, softGlow } from './sparkles';

const WHITE = new THREE.Color('#ffffff');
const GOLD = new THREE.Color('#ffd65a');
/** a warm white for lit bulbs: reads as light on every one of the four floors */
const WARM = new THREE.Color('#fff1c8');

/** a tapped bulb sends a bright wave round the marquee for this long */
const WAVE = 1.4;
/**
 * The marquee is drawn early (after the floor, before everything else) and leaves no depth behind: the near bulbs lie
 * on the floor closer to the camera than your hand, which floats over them, and the cards must still draw over them.
 */
const MARQUEE_ORDER = -60;
/** steps per second of the chase, and how many bulbs one lit group spans */
const CHASE_HZ = 6;
const CHASE_EVERY = 3;

/**
 * Classic: a game-show stage. A marquee of light bulbs seated in the floor's dark track all the way round the rim
 * (see floor.ts), chasing in groups of three. The near ones lie on the floor under your hand, which draws over them;
 * they take no pointer events (a tap there is always for your cards). Hover a bulb and it lights up gold; tap it and a golden wave
 * runs round the marquee from it, with a burst of sparkles. On bigger screens a bulb now and then gives off
 * a little twinkle of its own. Everything sits on the rim, outside the seats, so it never covers a card.
 *
 * Draw calls: bulbs 1, sparkles 1, plus sockets and halos (2) on desktop; the hit targets are never drawn.
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const { camera, size, viewport } = useThree();
  const acc = useMemo(() => new THREE.Color(accent), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => new THREE.Color(), []);
  const tmp2 = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  /* the bulbs: all the way round the floor's marquee ring (a multiple of the chase's group of three, so it runs on
     round the seam without a skip); the near ones sit on the floor under your hand, which draws over them */
  const nBulbs = lite ? 45 : 72;
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const halos = useRef<THREE.InstancedMesh>(null);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.085, lite ? 8 : 12, lite ? 6 : 8), [lite]);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(0.32, 6, 4), []);
  const haloGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const socketGeo = useMemo(() => new THREE.RingGeometry(0.09, 0.125, 20).rotateX(-Math.PI / 2), []);
  useEffect(() => () => [bulbGeo, hitGeo, haloGeo, socketGeo].forEach((g) => g.dispose()), [bulbGeo, hitGeo, haloGeo, socketGeo]);
  const bulbPos = useMemo(() => {
    const [cx, , cz] = arena({ portrait }).discard;
    return Array.from({ length: nBulbs }, (_, i) => {
      // floor angle: +pi/2 points at the camera; bulb 0 sits right in front of you, the rest go round evenly
      const a = Math.PI / 2 + (i / nBulbs) * Math.PI * 2;
      return new THREE.Vector3(cx + Math.cos(a) * MARQUEE_R, 0.085, cz + (Math.sin(a) * MARQUEE_R) / FLOOR_Z);
    });
  }, [nBulbs, portrait]);
  /** the bulbs on the near side, under your hand: lit like the rest, but never hovered or tapped (your cards are) */
  const underHand = useMemo(() => {
    const A = arena({ portrait });
    const half = (A.hand.maxW / 2) * 1.4 + 1;
    return bulbPos.map(p => p.z > A.discard[2] + 1 && Math.abs(p.x - A.discard[0]) < half);
  }, [bulbPos, portrait]);

  /* bulb interaction: which one is under the pointer, the last tap */
  const hot = useRef(-1);
  const wave = useRef({ at: -10, from: 0 });
  const nextTwinkle = useRef(0);

  const sparkles = useMemo(() => new Sparkles(lite ? 24 : 48, -3), [lite]);
  const burstCols = useMemo(() => [new THREE.Color(), WHITE, GOLD], []);
  useEffect(() => () => sparkles.dispose(), [sparkles]);

  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) document.body.style.cursor = '';
    },
    [],
  );

  /** a bulb answers the pointer only when it is the nearest thing under it (a card over it takes the touch) */
  const mine = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.intersections[0]?.object === e.eventObject && e.instanceId !== undefined && !underHand[e.instanceId];

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (!mine(e)) return;
    e.stopPropagation();
    hot.current = e.instanceId ?? -1;
    hovering.current = true;
    document.body.style.cursor = 'pointer';
  };
  const leave = () => {
    if (!hovering.current) return;
    hot.current = -1;
    hovering.current = false;
    document.body.style.cursor = '';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (hovering.current) e.stopPropagation();
    leave();
  };
  const move = (e: ThreeEvent<PointerEvent>) => {
    // a card slid in over the hovered bulb: let it go; the pointer went on to the next bulb: light that one
    if (!mine(e)) leave();
    else if (hot.current !== e.instanceId) over(e);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!mine(e)) return;
    e.stopPropagation();
    const i = e.instanceId!;
    wave.current.at = performance.now() / 1000;
    wave.current.from = i;
    burstCols[0].copy(acc);
    const p = bulbPos[i];
    sparkles.burst(p.x, p.y + 0.15, p.z, lite ? 14 : 26, burstCols, 2.6, 0.3, 1.4);
  };

  /** place every instance of a mesh on the bulbs (y and scale given); `hit`: none under your hand */
  const seat = (m: THREE.InstancedMesh, y: number | null, s: number, hit = false) => {
    bulbPos.forEach((p, i) => {
      dummy.position.set(p.x, y ?? p.y, p.z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(hit && underHand[i] ? 0 : s);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      m.setColorAt(i, WHITE);
    });
    m.instanceMatrix.needsUpdate = true;
  };

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const now = performance.now() / 1000;
    acc.lerp(tmp.set(accent), 1 - Math.exp(-dt * 2));
    const cam = camera as THREE.PerspectiveCamera;
    sparkles.setScale((size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));

    // the chase: every third bulb lit warm white, stepping round; the rest glow softly in the colour.
    // A lit bulb fades over a step rather than snapping, so the chase reads as smooth movement.
    const phase = t * CHASE_HZ;
    const b = bulbs.current;
    const h = halos.current;
    const wt = now - wave.current.at;
    // the wave runs both ways round the ring from the tapped bulb and meets on the far side
    const front = wt < WAVE ? (wt / WAVE) * (nBulbs / 2) : -99;
    for (let i = 0; i < nBulbs; i++) {
      const d = (((i - phase) % CHASE_EVERY) + CHASE_EVERY) % CHASE_EVERY; // 0..3: distance behind the lit head
      const lit = Math.max(0, 1 - d) ** 1.5;
      const gap = Math.abs(i - wave.current.from);
      const w = front < 0 ? 0 : Math.max(0, 1 - Math.abs(Math.min(gap, nBulbs - gap) - front) / 2.5);
      const hov = i === hot.current ? 1 : 0;
      // unlit bulbs still glow in the colour (a dull bulb reads as a bump, not a light); lit ones go warm white
      tmp2.copy(acc).lerp(WHITE, 0.3).multiplyScalar(0.85);
      tmp2.lerp(WARM, lit);
      if (hov || w > 0.02) tmp2.lerp(GOLD, Math.max(hov, w)).multiplyScalar(1 + 0.5 * Math.max(hov, w));
      b.setColorAt(i, tmp2);
      // the tapped wave and a hovered bulb swell a little
      const s = 1 + 0.45 * Math.max(hov, w);
      dummy.position.copy(bulbPos[i]);
      dummy.quaternion.identity();
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      if (h) h.setColorAt(i, tmp2.multiplyScalar(0.18 + 0.32 * Math.max(lit, w, hov)));
    }
    b.instanceMatrix.needsUpdate = true;
    b.instanceColor!.needsUpdate = true;
    if (h) h.instanceColor!.needsUpdate = true;

    // now and then a lit bulb throws off a tiny twinkle (desktop only: phones keep their overdraw low)
    if (!lite && now > nextTwinkle.current) {
      nextTwinkle.current = now + 1.2 + Math.random() * 1.6;
      const p = bulbPos[Math.floor(Math.random() * nBulbs)];
      burstCols[0].copy(acc).lerp(WHITE, 0.5);
      sparkles.burst(p.x, p.y + 0.1, p.z, 3, burstCols, 0.9, 0.2, 0.9);
    }
    sparkles.update(dt);
  });

  return (
    <group name="decor">
      {/* invisible, larger targets round the bulbs: easy to hover and tap, never drawn */}
      <instancedMesh key={`hit${nBulbs}${portrait}`} args={[hitGeo, undefined, nBulbs]} onPointerOver={over} onPointerMove={move} onPointerOut={out} onClick={click}
        onUpdate={(m) => seat(m, null, 1, true)}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh key={`sock${portrait}`} args={[socketGeo, undefined, nBulbs]} frustumCulled={false} renderOrder={MARQUEE_ORDER} onUpdate={(m) => seat(m, 0.006, 1)}>
          <meshBasicMaterial color="#8f6c2a" toneMapped={false} depthWrite={false} />
        </instancedMesh>
      )}
      {!lite && (
        <instancedMesh key={`halo${portrait}`} ref={halos} args={[haloGeo, undefined, nBulbs]} frustumCulled={false} renderOrder={MARQUEE_ORDER + 1} onUpdate={(m) => seat(m, 0.012, 0.75)}>
          {/* additive, but drawn with the opaque things (transparent off), so it stays under the cards like the bulbs */}
          <meshBasicMaterial map={softGlow()} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </instancedMesh>
      )}
      <instancedMesh key={`bulb${nBulbs}${portrait}`} ref={bulbs} args={[bulbGeo, undefined, nBulbs]} frustumCulled={false} renderOrder={MARQUEE_ORDER + 2} onUpdate={(m) => seat(m, null, 1)}>
        <meshBasicMaterial toneMapped={false} depthWrite={false} />
      </instancedMesh>
      <primitive object={sparkles.points} />
      {lite && !portrait && (
        <Stands
          accent={acc}
          center={[arena({ portrait }).discard[0], arena({ portrait }).discard[2]]}
          onTap={(x, y, z) => {
            burstCols[0].copy(acc);
            sparkles.burst(x, y, z, 14, burstCols, 2.2, 0.3, 1.2);
          }}
        />
      )}
    </group>
  );
}

/** how many spotlight stands a phone may show */
const STANDS = 4;
const BEAM_WARM = new THREE.Color('#fff1c8');

/**
 * A phone on its side: stage spotlights on stands in the room its screen has left (beside and between the side
 * players, then past the far ones; see Placer), turned to the table, their beams swaying slowly over it.
 * Hover brightens a beam; a tap flares it gold with a burst of sparkles. Two draw calls (stands, beams).
 */
function Stands({ accent, center, onTap }: { accent: THREE.Color; center: [number, number]; onTap: (x: number, y: number, z: number) => void }) {
  const hud = useHudZones();
  const [spots, setSpots] = useState<Placed[]>([]);
  const fitted = useRef({ version: -1, w: 0, h: 0, key: '' });
  const geo = useMemo(() => ({ stand: standGeometry(true), beam: beamGeometry(true) }), []);
  useEffect(() => () => { geo.stand.dispose(); geo.beam.dispose(); }, [geo]);
  const stands = useRef<THREE.InstancedMesh>(null);
  const beams = useRef<THREE.InstancedMesh>(null);
  const st = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color(), hot: -1, flareAt: new Float64Array(STANDS).fill(-10) }), []);
  const hovering = useRef(false);
  useEffect(() => () => { if (hovering.current) document.body.style.cursor = ''; }, []);
  // per-instance colours exist from the start, so the material compiles with them
  const beamColors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, spots.length) * 3).fill(1), 3), [spots.length]);

  useFrame((state) => {
    const zones = hud.current;
    const { width: w, height: h } = state.size;
    const f = fitted.current;
    if (f.version !== zones.version || f.w !== w || f.h !== h) {
      f.version = zones.version;
      f.w = w;
      f.h = h;
      const out: Placed[] = [];
      if (zones.view.compact) {
        const P = new Placer(w, h, zones);
        const near = [-1, 1].flatMap((side) => [...P.side(side, [-2.5, -1, -4, 0.5, -5.5, 2, 3, 4], [1.3, 2.1, 0.8, 3, 4]), ...P.strip(side)]);
        const far = [-10, 10, -7.5, 7.5, -12.5, 12.5, -5, 5].flatMap((x) => [-10.5, -8.5, -12.5].map((z) => ({ x, z })));
        for (let i = 0; i < STANDS; i++) {
          const side = i % 2 ? 1 : -1;
          const mine = (l: { x: number; z: number }[]) => l.filter((p) => Math.sign(p.x) === side);
          const order = i < 2 ? [...mine(near), ...mine(far), ...near, ...far] : [...mine(far), ...mine(near), ...far, ...near];
          const p = P.place(order, STAND_BALL, { maxPx: (i < 2 ? 0.17 : 0.11) * h, minPx: 0.05 * h, onScreen: 0.85 }, spots[i]);
          if (p) out.push(p);
        }
      }
      const key = JSON.stringify(out);
      if (key !== f.key) {
        f.key = key;
        setSpots(out);
      }
    }
    const sm = stands.current;
    const bm = beams.current;
    if (!sm || !bm) return;
    const t = state.clock.elapsedTime;
    const now = performance.now() / 1000;
    const { o, c } = st;
    spots.forEach((p, i) => {
      // turned to the table, sweeping slowly to and fro; a tap swings it round once
      const fl = now - st.flareAt[i];
      const swing = fl >= 0 && fl < 0.9 ? Math.sin((fl / 0.9) * Math.PI * 2) * 0.5 : 0;
      o.position.set(p.x, 0, p.z);
      o.rotation.set(0, Math.atan2(center[0] - p.x, center[1] - p.z) + Math.sin(t * 0.45 + i * 1.7) * 0.22 + swing, 0);
      o.scale.setScalar(p.s);
      o.updateMatrix();
      sm.setMatrixAt(i, o.matrix);
      bm.setMatrixAt(i, o.matrix);
      const flare = fl >= 0 && fl < 1.4 ? 1 - fl / 1.4 : 0;
      c.copy(accent).lerp(BEAM_WARM, 0.55).multiplyScalar(0.9 + (st.hot === i ? 0.6 : 0) + 0.12 * Math.sin(t * 2.3 + i));
      if (flare > 0) c.lerp(GOLD, flare).multiplyScalar(1 + flare);
      bm.setColorAt(i, c);
    });
    sm.instanceMatrix.needsUpdate = true;
    bm.instanceMatrix.needsUpdate = true;
    if (bm.instanceColor) bm.instanceColor.needsUpdate = true;
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (e.intersections[0]?.object !== e.eventObject) return;
    e.stopPropagation();
    st.hot = e.instanceId ?? -1;
    hovering.current = true;
    document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (!hovering.current) return;
    e.stopPropagation();
    st.hot = -1;
    hovering.current = false;
    document.body.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.intersections[0]?.object !== e.eventObject || e.instanceId === undefined) return;
    e.stopPropagation();
    const p = spots[e.instanceId];
    if (!p) return;
    st.flareAt[e.instanceId] = performance.now() / 1000;
    onTap(p.x, HEAD_Y * p.s, p.z);
  };

  if (!spots.length) return null;
  return (
    <group name="stands">
      <instancedMesh key={`s${spots.length}`} ref={stands} args={[geo.stand, undefined, spots.length]} frustumCulled={false} onPointerOver={over} onPointerOut={out} onClick={click}>
        <meshLambertMaterial vertexColors emissive="#1a1420" />
      </instancedMesh>
      <instancedMesh key={`b${spots.length}`} ref={beams} args={[geo.beam, undefined, spots.length]} frustumCulled={false} renderOrder={3}
        instanceColor={beamColors}>
        <meshBasicMaterial vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}
