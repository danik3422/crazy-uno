import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HEX } from '../../../game/content';
import { landingTime } from '../../PlayFx';
import { nowSec } from '../../fxState';
import type { LandingProps } from '../types';
import { glowTex } from './textures';

const SPARKS = 36;
const SPARKS_LITE = 16;
const LIFE = 0.8;
const QUADS = [HEX.red, HEX.yellow, HEX.green, HEX.blue];
const WHITE = new THREE.Color(1, 1, 1);

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

/**
 * Space landing: a mini supernova in the card's colour. A tilted accretion ring collapses into the pile
 * (the shared shock ring goes the other way), a flash pops, and star sparks spiral outward.
 */
export function Landing({ top, at, lite }: LandingProps) {
  const n = lite ? SPARKS_LITE : SPARKS;
  const flash = useRef<THREE.Sprite>(null!);
  const flashMat = useRef<THREE.SpriteMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const pts = useRef<THREE.Points>(null!);
  const armed = useRef<number | null>(null);
  const start = useRef(-10);
  const first = useRef(true);

  const { geo, mat, dirs, speed } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const m = new THREE.PointsMaterial({
      size: 0.32,
      map: glowTex(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    const d = new Float32Array(n * 2);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      d[i * 2] = a;
      d[i * 2 + 1] = 0.2 + Math.random() * 0.9; // rise
      s[i] = 1.6 + Math.random() * 1.6;
    }
    return { geo: g, mat: m, dirs: d, speed: s };
  }, [n]);
  const tmp = useMemo(() => new THREE.Color(), []);

  useEffect(() => () => {
    geo.dispose();
    mat.dispose();
  }, [geo, mat]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    armed.current = nowSec();
    const wild = top.color === 'wild';
    const base = wild ? '#ffffff' : HEX[top.color as Exclude<typeof top.color, 'wild'>];
    flashMat.current.color.set(base);
    ringMat.current.color.set(wild ? '#c8b8ff' : base).lerp(WHITE, 0.25);
    const col = geo.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < n; i++) {
      tmp.set(wild ? QUADS[i % 4] : base).lerp(WHITE, i % 3 === 0 ? 0.7 : 0.15);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
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
    flash.current.visible = on && t < 0.45;
    ring.current.visible = on && t < 0.5;
    pts.current.visible = on;
    if (!on) return;
    const k = t / LIFE;

    // the flash: a quick bright pop that fades
    if (t < 0.45) {
      const f = t / 0.45;
      flash.current.scale.setScalar(0.8 + easeOut(f) * 3.4);
      flashMat.current.opacity = (f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85) * 0.95;
    }
    // the accretion ring collapses inward, spinning
    if (t < 0.5) {
      const f = t / 0.5;
      ring.current.scale.setScalar(2.6 - easeOut(f) * 2.2);
      ring.current.rotation.z = f * 3;
      ringMat.current.opacity = Math.sin(f * Math.PI) * 0.85;
    }
    // star sparks spiral outward, slowing down
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const e = easeOut(k);
    for (let i = 0; i < n; i++) {
      const a = dirs[i * 2] + e * 0.9;
      const d = 0.3 + e * speed[i];
      pos.setXYZ(i, at[0] + Math.cos(a) * d, 0.15 + e * dirs[i * 2 + 1], at[2] + Math.sin(a) * d * 0.8);
    }
    pos.needsUpdate = true;
    mat.opacity = 1 - k * k;
    mat.size = 0.34 * (1 - k * 0.5);
  });

  return (
    <>
      <sprite ref={flash} position={[at[0], 0.35, at[2]]} renderOrder={9} visible={false}>
        <spriteMaterial ref={flashMat} map={glowTex()} transparent depthWrite={false} depthTest={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      <mesh ref={ring} position={[at[0], 0.08, at[2]]} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.92, 1, lite ? 32 : 56]} />
        <meshBasicMaterial ref={ringMat} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <points ref={pts} geometry={geo} material={mat} frustumCulled={false} visible={false} renderOrder={9} />
    </>
  );
}
