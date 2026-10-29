import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { COLORS, HEX } from '../../../game/content';
import { landingTime } from '../../PlayFx';
import { nowSec } from '../../fxState';
import type { LandingProps } from '../types';
import { Sparkles } from './sparkles';

const LIFE = 0.8;
const GRAV = -9;

const rayTex: Record<string, THREE.Texture> = {};
/**
 * Game-show sunburst: 16 soft rays fading out at the rim (256 px, made once per kind).
 * 'glow' is white with a bright core (added on top: shines on dark floors); 'paint' is the same rays,
 * white or in the four card colours for a wild, laid on normally, so they still show on a bright floor.
 */
function sunburst(kind: 'glow' | 'paint' | 'wild') {
  if (rayTex[kind]) return rayTex[kind];
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  c.translate(128, 128);
  for (let i = 0; i < 16; i++) {
    const fade = c.createRadialGradient(0, 0, 0, 0, 0, 128);
    const rgb = kind === 'wild' ? ['255,59,59', '255,204,0', '35,190,90', '40,120,255'][i % 4] : '255,255,255';
    fade.addColorStop(0, `rgba(${rgb},${kind === 'glow' ? 1 : 0})`);
    fade.addColorStop(kind === 'glow' ? 0.5 : 0.25, `rgba(${rgb},${kind === 'glow' ? 0.5 : 0.9})`);
    fade.addColorStop(1, `rgba(${rgb},0)`);
    c.fillStyle = fade;
    const a = (i / 16) * Math.PI * 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.arc(0, 0, 128, a - 0.09, a + 0.09);
    c.closePath();
    c.fill();
  }
  if (kind === 'glow') {
    const core = c.createRadialGradient(0, 0, 0, 0, 0, 50);
    core.addColorStop(0, 'rgba(255,255,255,.9)');
    core.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = core;
    c.fillRect(-128, -128, 256, 256);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  rayTex[kind] = t;
  return t;
}

interface Bit { vx: number; vy: number; vz: number; rx: number; ry: number; wx: number; wy: number; s: number }

/**
 * Classic: the card lands to a game-show cheer — a sunburst flashes on the floor under it,
 * a pop of confetti in its colour (all four for a wild) and, on bigger screens, a ring of stars.
 */
export function Landing({ top, at, lite }: LandingProps) {
  const { camera, size, viewport } = useThree();
  const N = lite ? 18 : 36;
  const conf = useRef<THREE.InstancedMesh>(null!);
  const rays = useRef<THREE.Mesh>(null!);
  const raysMat = useRef<THREE.MeshBasicMaterial>(null!);
  const paint = useRef<THREE.Mesh>(null!);
  const paintMat = useRef<THREE.MeshBasicMaterial>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bits = useMemo<Bit[]>(() => Array.from({ length: N }, () => ({ vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, wx: 0, wy: 0, s: 1 })), [N]);
  const geo = useMemo(() => new THREE.PlaneGeometry(0.2, 0.12), []);
  const stars = useMemo(() => (lite ? null : new Sparkles(24, -2)), [lite]);
  const cols = useMemo(() => [new THREE.Color(), new THREE.Color(), new THREE.Color('#ffffff'), new THREE.Color('#ffd65a')], []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const start = useRef(-10);
  const armed = useRef<number | null>(null);
  const first = useRef(true);
  const fired = useRef(true);

  useEffect(() => () => stars?.dispose(), [stars]);
  useEffect(() => () => geo.dispose(), [geo]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    armed.current = nowSec();
    fired.current = false;
    const wild = top.color === 'wild';
    // the confetti colours: the card's own colour twice, white and gold; a wild throws all four colours
    for (let i = 0; i < N; i++) {
      const c = wild ? HEX[COLORS[i % 4]] : i % 4 < 2 ? HEX[top.color as keyof typeof HEX] : i % 4 === 2 ? '#ffffff' : '#ffd65a';
      conf.current.setColorAt(i, tmp.set(c));
      const a = (i / N) * Math.PI * 2 + Math.random() * 0.4;
      const sp = 2.2 + Math.random() * 2.2;
      Object.assign(bits[i], {
        vx: Math.cos(a) * sp, vy: 3.2 + Math.random() * 2.6, vz: Math.sin(a) * sp * 0.8,
        rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 22, wy: (Math.random() - 0.5) * 22,
        s: 0.7 + Math.random() * 0.6,
      });
    }
    conf.current.instanceColor!.needsUpdate = true;
    cols[0].set(wild ? HEX.red : HEX[top.color as keyof typeof HEX]);
    cols[1].set(wild ? HEX.blue : HEX[top.color as keyof typeof HEX]).lerp(cols[2], 0.4);
    raysMat.current.color.set(wild ? '#fff1c4' : HEX[top.color as keyof typeof HEX]).lerp(tmp.set('#ffffff'), 0.3);
    // the painted rays: the card's colour a shade deeper, so a yellow card still shows on the yellow floor
    paintMat.current.map = sunburst(wild ? 'wild' : 'paint');
    paintMat.current.color.set(wild ? '#ffffff' : HEX[top.color as keyof typeof HEX]).multiplyScalar(wild ? 1 : 0.82);
    paintMat.current.needsUpdate = true;
  }, [top.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, dt) => {
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
    conf.current.visible = rays.current.visible = paint.current.visible = on;
    if (stars) {
      if (on && !fired.current) {
        fired.current = true;
        const cam = camera as THREE.PerspectiveCamera;
        stars.setScale((size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
        stars.burst(at[0], 0.35, at[2], 24, cols, 4.2, 0.4, 0.6);
      }
      stars.update(dt);
    }
    if (!on) return;
    const k = t / LIFE;

    // the sunburst: flashes up, turns a little and fades
    rays.current.scale.setScalar(1.2 + (1 - Math.pow(1 - Math.min(1, k * 2.2), 3)) * 3.4);
    rays.current.rotation.z = k * 0.6;
    raysMat.current.opacity = (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88) * 0.75;
    paint.current.scale.copy(rays.current.scale);
    paint.current.rotation.z = rays.current.rotation.z;
    paintMat.current.opacity = raysMat.current.opacity * 0.75;

    // confetti: a pop up and out, flutter, fall, shrink away at the end
    const m = conf.current;
    for (let i = 0; i < N; i++) {
      const b = bits[i];
      dummy.position.set(at[0] + b.vx * t, 0.25 + b.vy * t + 0.5 * GRAV * t * t, at[2] + b.vz * t);
      if (dummy.position.y < 0.03) dummy.position.y = 0.03;
      dummy.rotation.set(b.rx + b.wx * t, b.ry + b.wy * t, 0);
      dummy.scale.setScalar(b.s * Math.min(1, k * 10) * (1 - Math.pow(k, 4)));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={paint} rotation-x={-Math.PI / 2} position={[at[0], 0.008, at[2]]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={paintMat} map={sunburst('paint')} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh ref={rays} rotation-x={-Math.PI / 2} position={[at[0], 0.01, at[2]]} visible={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={raysMat} map={sunburst('glow')} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
      <instancedMesh ref={conf} args={[geo, undefined, N]} frustumCulled={false} visible={false}
        onUpdate={(m) => { for (let i = 0; i < N; i++) m.setColorAt(i, tmp.set('#ffffff')); }}>
        <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
      </instancedMesh>
      {stars && <primitive object={stars.points} />}
    </>
  );
}
