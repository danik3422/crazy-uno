import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { landingTime } from '../../PlayFx';
import { nowSec } from '../../fxState';
import { canvasTex } from '../decorKit';
import type { LandingProps } from '../types';
import { POINT_SIZE, ROTATE_PC, flakeTexture, puffTexture } from './bits';
import { WINTER } from './face';

const LIFE = 0.8;

/**
 * Points of the landing: powder puffs (kind 0) rolling out low over the table and frost crystals (kind 1)
 * skating outward and spinning. All of it moves on the GPU from one time uniform.
 */
const vert = /* glsl */ `
  attribute float aKind;
  attribute vec3 aDir;
  attribute float aSeed;
  uniform float uT;
  uniform vec3 uAt;
  varying float vAlpha;
  varying float vKind;
  varying float vRot;
  ${POINT_SIZE}
  void main() {
    float k = clamp(uT / ${LIFE.toFixed(2)}, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - k, 3.0);
    vec3 p = uAt;
    float size;
    if (aKind < 0.5) {
      p += aDir * (0.35 + e * (1.1 + aSeed * 0.7)) + vec3(0.0, 0.18 + e * (0.25 + aSeed * 0.35), 0.0);
      size = (0.7 + e * 1.0) * (1.0 - k * k * 0.4);
      vAlpha = min(1.0, k / 0.1) * pow(1.0 - k, 1.3) * 0.9;
    } else {
      p += aDir * (0.3 + e * (1.5 + aSeed * 1.1)) + vec3(0.0, 0.08 + sin(k * 3.14) * 0.3 * aSeed, 0.0);
      size = 0.26 + aSeed * 0.2;
      vAlpha = min(1.0, k / 0.06) * (1.0 - k * k);
    }
    vKind = aKind;
    vRot = aSeed * 6.0 + k * (aSeed - 0.5) * 8.0;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uT < 0.0 || uT > ${LIFE.toFixed(2)} ? 0.0 : pointPx(mv, size);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform sampler2D uPuff;
  uniform sampler2D uFlake;
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vKind;
  varying float vRot;
  ${ROTATE_PC}
  void main() {
    vec2 pc = rotPC(gl_PointCoord, vRot);
    vec4 c = vKind < 0.5 ? texture2D(uPuff, pc) * vec4(mix(vec3(1.0), uColor, 0.3), 1.0) : texture2D(uFlake, pc) * vec4(mix(uColor, vec3(1.0), 0.12) * 1.25, 1.0);
    gl_FragColor = vec4(c.rgb * c.a * vAlpha, 1.0);
  }
`;

/** A ring of frost crystals lying flat on the table, white so it takes the card's colour. */
const frostTexture = () =>
  canvasTex(256, 256, ctx => {
    ctx.translate(128, 128);
    const g = ctx.createRadialGradient(0, 0, 60, 0, 0, 126);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,.35)');
    g.addColorStop(0.75, 'rgba(255,255,255,.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-128, -128, 256, 256);
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const r0 = 78 + (i % 3) * 6;
      const r1 = r0 + 26 + (i % 2) * 14;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      // little side spikes
      const m = (r0 + r1) / 2;
      for (const s of [1, -1]) {
        ctx.moveTo(Math.cos(a) * m, Math.sin(a) * m);
        ctx.lineTo(Math.cos(a + s * 0.07) * (m + 10), Math.sin(a + s * 0.07) * (m + 10));
      }
      ctx.stroke();
    }
  });

/**
 * Winter landing: a puff of powder snow bursts out low around the pile, frost crystals in the card's colour
 * skate outward spinning, and (on desktop) a ring of frost spreads over the ice.
 */
export function Landing({ top, at, lite }: LandingProps) {
  const PUFFS = lite ? 6 : 10;
  const FLAKES = lite ? 10 : 18;
  const res = useMemo(() => ({ puff: puffTexture(), flake: flakeTexture(), frost: frostTexture() }), []);
  const geo = useMemo(() => {
    const n = PUFFS + FLAKES;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(n).map((_, i) => (i < PUFFS ? 0 : 1)), 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }, [PUFFS, FLAKES]);
  useEffect(
    () => () => {
      Object.values(res).forEach(r => r.dispose());
      geo.dispose();
    },
    [res, geo],
  );
  const U = useMemo(
    () => ({ uT: { value: -1 }, uAt: { value: new THREE.Vector3(...at) }, uColor: { value: new THREE.Color() }, uViewH: { value: 800 }, uPuff: { value: res.puff }, uFlake: { value: res.flake } }),
    [res], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const points = useRef<THREE.Points>(null!);
  const ring = useRef<THREE.Mesh>(null);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null);
  const first = useRef(true);
  const armed = useRef<number | null>(null);
  const start = useRef(-10);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    armed.current = nowSec();
    // icy aurora-teal for wild cards, the card's own colour otherwise
    U.uColor.value.set(top.color === 'wild' ? '#7affd8' : WINTER[top.color as keyof typeof WINTER]);
    ringMat.current?.color.copy(U.uColor.value).lerp(new THREE.Color('#ffffff'), 0.3);
    // a fresh scatter each time (a handful of numbers, only on a landing)
    const dir = geo.attributes.aDir as THREE.BufferAttribute;
    const seed = geo.attributes.aSeed as THREE.BufferAttribute;
    const n = PUFFS + FLAKES;
    for (let i = 0; i < n; i++) {
      const puff = i < PUFFS;
      const a = ((puff ? i : i - PUFFS) / (puff ? PUFFS : FLAKES)) * Math.PI * 2 + Math.random() * 0.5;
      dir.setXYZ(i, Math.cos(a), 0, Math.sin(a) * 0.75);
      seed.setX(i, Math.random());
    }
    dir.needsUpdate = true;
    seed.needsUpdate = true;
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
    points.current.visible = on;
    if (ring.current) ring.current.visible = on;
    if (!on) return;
    U.uT.value = t;
    U.uAt.value.set(at[0], at[1], at[2]);
    U.uViewH.value = state.size.height * state.viewport.dpr;
    if (ring.current && ringMat.current) {
      const k = t / LIFE;
      ring.current.position.set(at[0], 0.03, at[2]);
      ring.current.scale.setScalar(1.2 + (1 - (1 - k) ** 3) * 3.4);
      ringMat.current.opacity = Math.min(1, k / 0.1) * (1 - k) ** 1.5;
    }
  });

  return (
    <>
      <points ref={points} geometry={geo} visible={false} frustumCulled={false} renderOrder={4}>
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={U} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {!lite && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={3}>
          <planeGeometry />
          <meshBasicMaterial ref={ringMat} map={res.frost} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </>
  );
}
