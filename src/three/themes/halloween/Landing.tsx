import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { landingTime } from '../../effects/PlayFx';
import { nowSec } from '../../effects/fxState';
import { canvasTex } from '../decorKit';
import type { LandingProps } from '../types';
import { batTexture, wingGeometry } from './bits';
import { SPOOKY } from './face';

const LIFE = 0.8;
const easeOut = (x: number) => 1 - (1 - x) ** 3;

/** A lumpy soft puff of smoke, white so it takes any tint. */
const puffTexture = () =>
  canvasTex(128, 128, ctx => {
    for (const [x, y, r] of [[64, 70, 40], [44, 58, 26], [84, 56, 28], [62, 44, 26], [50, 82, 22], [80, 82, 24]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
  });

/**
 * Halloween landing: a puff of witchy smoke in the card's colour rolls out from the pile
 * and a little swarm of bats bursts out of it, flapping away in a spiral.
 */
export function Landing({ top, at, lite }: LandingProps) {
  const PUFFS = lite ? 6 : 10;
  const BATS = lite ? 4 : 7;
  const puffs = useRef<THREE.InstancedMesh>(null!);
  const puffMat = useRef<THREE.MeshBasicMaterial>(null!);
  const bats = useRef<THREE.InstancedMesh>(null!);
  const res = useMemo(() => ({ puff: puffTexture(), bat: batTexture(), wing: wingGeometry() }), []);
  useEffect(() => () => Object.values(res).forEach(r => r.dispose()), [res]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const first = useRef(true);
  const armed = useRef<number | null>(null);
  const start = useRef(-10);
  // per-burst randomness, re-rolled each time without allocating
  const seeds = useMemo(() => ({ puff: new Float32Array(PUFFS * 2), bat: new Float32Array(BATS * 2) }), [PUFFS, BATS]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    armed.current = nowSec();
    // witch-green smoke for wild cards, the card's own colour otherwise
    puffMat.current.color.set(top.color === 'wild' ? '#8dff5a' : SPOOKY[top.color as keyof typeof SPOOKY]).lerp(new THREE.Color('#c8a0ff'), 0.25);
    for (let i = 0; i < seeds.puff.length; i++) seeds.puff[i] = Math.random();
    for (let i = 0; i < seeds.bat.length; i++) seeds.bat[i] = Math.random();
  }, [top.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(state => {
    const now = nowSec();
    if (armed.current !== null) {
      const s = landingTime(armed.current, now);
      if (s !== null) {
        start.current = s;
        armed.current = null;
      }
    }
    const t = now - start.current;
    const on = t >= 0 && t < LIFE;
    puffs.current.visible = bats.current.visible = on;
    if (!on) return;
    const k = t / LIFE;
    const e = easeOut(k);

    // smoke rolls outward along the table and curls up, fading
    for (let i = 0; i < PUFFS; i++) {
      const a = (i / PUFFS) * Math.PI * 2 + seeds.puff[i * 2] * 0.6;
      const r = 0.3 + e * (1.3 + seeds.puff[i * 2 + 1] * 0.8);
      o.position.set(at[0] + Math.cos(a) * r, 0.25 + e * (0.4 + seeds.puff[i * 2 + 1] * 0.5), at[2] + Math.sin(a) * r * 0.75);
      o.quaternion.copy(state.camera.quaternion);
      o.rotateZ(a + k * 1.5);
      o.scale.setScalar((0.7 + e * 1.1) * (1 - k * k * 0.5));
      o.updateMatrix();
      puffs.current.setMatrixAt(i, o.matrix);
    }
    puffs.current.instanceMatrix.needsUpdate = true;
    puffMat.current.opacity = (k < 0.12 ? k / 0.12 : 1) * (1 - k) ** 1.4 * 0.95;

    // bats spiral out and up, wings beating fast
    for (let i = 0; i < BATS; i++) {
      const a = (i / BATS) * Math.PI * 2 + seeds.bat[i * 2] * 0.5 + e * 1.6;
      const r = 0.2 + e * (2.2 + seeds.bat[i * 2 + 1]);
      const px = at[0] + Math.cos(a) * r;
      const pz = at[2] + Math.sin(a) * r * 0.7;
      const py = 0.4 + e * (1.6 + seeds.bat[i * 2 + 1] * 1.2);
      const flap = Math.sin(t * 40 + i * 1.7) * 1.0;
      // the bat shrinks away at the very end instead of popping out
      const s = 0.42 * Math.min(1, k * 6) * (k > 0.8 ? (1 - k) / 0.2 : 1);
      // facing the camera, banking toward the side it flies off to
      const bank = -Math.cos(a) * 0.5;
      for (const side of [1, -1]) {
        o.position.set(px, py, pz);
        o.rotation.set(-0.6, 0, bank);
        o.rotateY(side * flap);
        o.scale.set(side * s, s, s);
        o.updateMatrix();
        bats.current.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), o.matrix);
      }
    }
    bats.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={puffs} args={[undefined, undefined, PUFFS]} visible={false} frustumCulled={false} renderOrder={3}>
        <planeGeometry />
        <meshBasicMaterial ref={puffMat} map={res.puff} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={bats} args={[res.wing, undefined, BATS * 2]} visible={false} frustumCulled={false} renderOrder={4}>
        <meshBasicMaterial map={res.bat} alphaTest={0.4} side={THREE.DoubleSide} />
      </instancedMesh>
    </>
  );
}
