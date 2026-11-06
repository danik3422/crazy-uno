import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { landingTime } from '../../effects/PlayFx';
import { nowSec } from '../../effects/fxState';
import type { LandingProps } from '../types';
import { NEON } from './face';
import { glowTex } from './textures';

const LIFE = 0.75;
const SPARKS = 12;
const WILD = [NEON.red, NEON.yellow, NEON.green, NEON.blue].map((c) => new THREE.Color(c));

/** flat on the floor: a hexagon tube outline */
const hexGeo = new THREE.RingGeometry(0.93, 1, 6, 1).rotateX(-Math.PI / 2);
/** a spark streak lying on the floor, running along +X from its start */
const sparkGeo = new THREE.PlaneGeometry(1, 1).translate(0.5, 0, 0).rotateX(-Math.PI / 2);
const flashGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Neon landing: two hexagon tubes snap out of the pile one after the other, a ring of spark streaks
 * shoots out along the floor, and a glitchy flash flickers under the card — all in the card's colour.
 */
export function Landing({ top, at, lite }: LandingProps) {
  const hexA = useRef<THREE.Mesh>(null!);
  const hexB = useRef<THREE.Mesh>(null!);
  const matA = useRef<THREE.MeshBasicMaterial>(null!);
  const matB = useRef<THREE.MeshBasicMaterial>(null!);
  const sparks = useRef<THREE.InstancedMesh>(null!);
  const sparkMat = useRef<THREE.MeshBasicMaterial>(null!);
  const flash = useRef<THREE.Mesh>(null!);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null!);
  const first = useRef(true);
  const armed = useRef<number | null>(null);
  const start = useRef(-10);
  const wild = useRef(false);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  // each spark's angle and speed, re-rolled per landing
  const dirs = useMemo(() => new Float32Array(SPARKS * 2), []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    armed.current = nowSec();
    wild.current = top.color === 'wild';
    const c = wild.current ? '#ff3df0' : NEON[top.color as keyof typeof NEON];
    matA.current.color.set(c);
    matB.current.color.set(wild.current ? '#22e6ff' : c);
    sparkMat.current.color.set(c);
    flashMat.current.color.set(c);
    const off = Math.random() * Math.PI * 2;
    for (let i = 0; i < SPARKS; i++) {
      dirs[i * 2] = off + (i / SPARKS) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      dirs[i * 2 + 1] = 0.7 + Math.random() * 0.6;
    }
  }, [top.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const now = nowSec();
    if (armed.current !== null) {
      const t0 = landingTime(armed.current, now);
      if (t0 !== null) {
        start.current = t0;
        armed.current = null;
      }
    }
    const t = now - start.current;
    const on = t >= 0 && t < LIFE;
    hexA.current.visible = hexB.current.visible = flash.current.visible = on;
    sparks.current.visible = on && !lite;
    if (!on) return;
    const x = t / LIFE;

    // wild cards cycle through the four colours
    if (wild.current) {
      const c = WILD[Math.floor(t * 16) % 4];
      sparkMat.current.color.copy(c);
      flashMat.current.color.copy(c);
    }

    // the first hexagon snaps out fast, the second follows, turned
    const a = Math.min(1, x / 0.7);
    hexA.current.scale.setScalar(0.9 + easeOut(a) * 3.6);
    hexA.current.rotation.y = 0.3 + a * 0.5;
    matA.current.opacity = a < 1 ? (1 - a) * 1.2 : 0;
    const b = Math.max(0, Math.min(1, (x - 0.15) / 0.85));
    hexB.current.visible = b > 0;
    hexB.current.scale.setScalar(0.7 + easeOut(b) * 2.6);
    hexB.current.rotation.y = -0.2 - b * 0.7;
    matB.current.opacity = (1 - b) * 0.9;

    // a glitchy flash: bright, then a few hard flickers
    const flick = x < 0.12 ? 1 : Math.sin(t * 70) > 0.2 ? 0.55 : 0.1;
    flashMat.current.opacity = Math.max(0, 1 - x * 1.4) * flick;
    flash.current.scale.set(3.6 + x * 1.5, 1, 3.6 + x * 1.5);

    // spark streaks shoot outward and shrink
    if (!lite) {
      const s = easeOut(Math.min(1, x / 0.8));
      for (let i = 0; i < SPARKS; i++) {
        const ang = dirs[i * 2];
        const sp = dirs[i * 2 + 1];
        const r0 = 0.9 + s * 2.6 * sp;
        dummy.position.set(at[0] + Math.cos(ang) * r0, 0.012, at[2] + Math.sin(ang) * r0);
        dummy.rotation.set(0, -ang, 0);
        dummy.scale.set(0.15 + (1 - s) * 0.9 * sp, 1, 0.06);
        dummy.updateMatrix();
        sparks.current.setMatrixAt(i, dummy.matrix);
      }
      sparks.current.instanceMatrix.needsUpdate = true;
      sparkMat.current.opacity = 1 - x;
    }
  });

  const mat = { transparent: true, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending } as const;
  return (
    <group>
      <mesh ref={flash} geometry={flashGeo} position={[at[0], 0.008, at[2]]} visible={false}>
        <meshBasicMaterial ref={flashMat} map={glowTex()} {...mat} />
      </mesh>
      <mesh ref={hexA} geometry={hexGeo} position={[at[0], 0.01, at[2]]} visible={false}>
        <meshBasicMaterial ref={matA} {...mat} />
      </mesh>
      <mesh ref={hexB} geometry={hexGeo} position={[at[0], 0.011, at[2]]} visible={false}>
        <meshBasicMaterial ref={matB} {...mat} />
      </mesh>
      <instancedMesh ref={sparks} args={[sparkGeo, undefined, SPARKS]} visible={false} frustumCulled={false}>
        <meshBasicMaterial ref={sparkMat} {...mat} />
      </instancedMesh>
    </group>
  );
}
