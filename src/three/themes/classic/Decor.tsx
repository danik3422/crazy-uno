import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { arena } from '../../layout/table';
import type { DecorProps } from '../types';
import { FLOOR_Z, MARQUEE_R } from './floor';
import { Sparkles, softGlow } from './sparkles';

const WHITE = new THREE.Color('#ffffff');
const GOLD = new THREE.Color('#ffd65a');
/** a warm white for lit bulbs: reads as light on every one of the four floors */
const WARM = new THREE.Color('#fff1c8');

/** a tapped bulb sends a bright wave round the marquee for this long */
const WAVE = 1.4;
/** the marquee leaves a gap this wide (radians each side) at the near edge, behind your hand */
const FRONT_GAP = 1.15;
/** steps per second of the chase, and how many bulbs one lit group spans */
const CHASE_HZ = 6;
const CHASE_EVERY = 3;

/**
 * Classic: a game-show stage. A marquee of light bulbs seated in the floor's dark track round the rim
 * (see floor.ts), chasing in groups of three. Hover a bulb and it lights up gold; tap it and a golden wave
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

  /* the bulbs: on the floor's marquee ring round the pile, from the near left round the back to the near right */
  const nBulbs = lite ? 30 : 48;
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const halos = useRef<THREE.InstancedMesh>(null);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.085, lite ? 8 : 12, lite ? 6 : 8), [lite]);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(0.32, 6, 4), []);
  const haloGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const socketGeo = useMemo(() => new THREE.RingGeometry(0.09, 0.125, 20).rotateX(-Math.PI / 2), []);
  useEffect(() => () => [bulbGeo, hitGeo, haloGeo, socketGeo].forEach((g) => g.dispose()), [bulbGeo, hitGeo, haloGeo, socketGeo]);
  const bulbPos = useMemo(() => {
    const [cx, , cz] = arena({ portrait }).discard;
    const span = Math.PI * 2 - FRONT_GAP * 2;
    return Array.from({ length: nBulbs }, (_, i) => {
      // floor angle: +pi/2 points at the camera, so start just past the near gap and go round the back
      const a = Math.PI / 2 + FRONT_GAP + (i / (nBulbs - 1)) * span;
      return new THREE.Vector3(cx + Math.cos(a) * MARQUEE_R, 0.085, cz + (Math.sin(a) * MARQUEE_R) / FLOOR_Z);
    });
  }, [nBulbs, portrait]);

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

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hot.current = e.instanceId ?? -1;
    hovering.current = true;
    document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hot.current = -1;
    hovering.current = false;
    document.body.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    wave.current.at = performance.now() / 1000;
    wave.current.from = i;
    burstCols[0].copy(acc);
    const p = bulbPos[i];
    sparkles.burst(p.x, p.y + 0.15, p.z, lite ? 14 : 26, burstCols, 2.6, 0.3, 1.4);
  };

  /** place every instance of a mesh on the bulbs (y and scale given) */
  const seat = (m: THREE.InstancedMesh, y: number | null, s: number) => {
    bulbPos.forEach((p, i) => {
      dummy.position.set(p.x, y ?? p.y, p.z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(s);
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
    const front = wt < WAVE ? (wt / WAVE) * nBulbs : -99;
    for (let i = 0; i < nBulbs; i++) {
      const d = (((i - phase) % CHASE_EVERY) + CHASE_EVERY) % CHASE_EVERY; // 0..3: distance behind the lit head
      const lit = Math.max(0, 1 - d) ** 1.5;
      const w = front < 0 ? 0 : Math.max(0, 1 - Math.abs(Math.abs(i - wave.current.from) - front) / 2.5);
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
      <instancedMesh key={`hit${nBulbs}${portrait}`} args={[hitGeo, undefined, nBulbs]} onPointerOver={over} onPointerOut={out} onClick={click}
        onUpdate={(m) => seat(m, null, 1)}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh key={`sock${portrait}`} args={[socketGeo, undefined, nBulbs]} frustumCulled={false} onUpdate={(m) => seat(m, 0.006, 1)}>
          <meshBasicMaterial color="#8f6c2a" toneMapped={false} />
        </instancedMesh>
      )}
      {!lite && (
        <instancedMesh key={`halo${portrait}`} ref={halos} args={[haloGeo, undefined, nBulbs]} frustumCulled={false} onUpdate={(m) => seat(m, 0.012, 0.75)}>
          <meshBasicMaterial map={softGlow()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </instancedMesh>
      )}
      <instancedMesh key={`bulb${nBulbs}${portrait}`} ref={bulbs} args={[bulbGeo, undefined, nBulbs]} frustumCulled={false} onUpdate={(m) => seat(m, null, 1)}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      <primitive object={sparkles.points} />
    </group>
  );
}
