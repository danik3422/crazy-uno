import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { canvasTex } from '../decorKit';
import type { DecorProps } from '../types';
import { POINT_SIZE, ROTATE_PC, flakeTexture, merge, paint } from './bits';

/* ---------- geometry, built once ---------- */

const SNOW = '#f2f7ff';

/** A snowy pine: three tiers with snow on each, a trunk and a little mound at its foot (one geometry). */
function pineGeometry(lite: boolean) {
  const seg = lite ? 7 : 9;
  const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 6, 1).translate(0, 0.22, 0), '#4a2c1c')];
  const tiers: [number, number, number][] = [[0.95, 1.0, 0.32], [0.74, 0.86, 0.86], [0.5, 0.74, 1.36]];
  tiers.forEach(([r, h, y], i) => {
    parts.push(paint(new THREE.ConeGeometry(r, h, seg, 1).translate(0, y + h / 2, 0), i % 2 ? '#1f6a52' : '#1a5a48'));
    const sh = h * 0.42;
    parts.push(paint(new THREE.ConeGeometry(r * 0.5, sh, seg, 1).rotateY(0.3).translate(0, y + h - sh / 2 + 0.03, 0), SNOW));
  });
  parts.push(paint(new THREE.SphereGeometry(0.85, seg + 1, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1), '#e4eefc'));
  return merge(parts);
}
/** radius of a pine's surface at height y (for winding lights round it) */
const pineRadius = (y: number) => (y < 0.86 ? 0.95 * (1 - (y - 0.32) / 1.0) : y < 1.36 ? 0.74 * (1 - (y - 0.86) / 0.86) : 0.5 * (1 - (y - 1.36) / 0.74));

const CAB = { w: 2.0, d: 1.5, wall: 1.05, gable: 0.8 };

/** A log cabin with a snowy gable roof and a chimney; its front faces +z. */
function cabinGeometry() {
  const { w, d, wall, gable } = CAB;
  const parts: THREE.BufferGeometry[] = [paint(new THREE.BoxGeometry(w - 0.1, wall, d - 0.1).translate(0, wall / 2, 0), '#5a341e')];
  const logs = 6;
  const step = wall / logs;
  for (let i = 0; i < logs; i++) {
    const c = i % 2 ? '#7c4c2c' : '#6a3e24';
    for (const z of [-d / 2, d / 2]) parts.push(paint(new THREE.CylinderGeometry(0.09, 0.09, w + 0.22, 7, 1).rotateZ(Math.PI / 2).translate(0, step * (i + 0.5), z), c));
    for (const x of [-w / 2, w / 2]) parts.push(paint(new THREE.CylinderGeometry(0.09, 0.09, d + 0.22, 7, 1).rotateX(Math.PI / 2).translate(x, step * (i + 0.5) + step * 0.5, 0), c));
  }
  // the gables
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2 - 0.05, 0);
  tri.lineTo(0, gable);
  tri.lineTo(w / 2 + 0.05, 0);
  tri.closePath();
  for (const z of [-d / 2, d / 2 - 0.06]) parts.push(paint(new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false }).translate(0, wall, z), '#6a3e24'));
  // roof panels, each with a thick layer of snow
  const half = w / 2 + 0.3;
  const ang = Math.atan2(gable + 0.1, half);
  const len = Math.hypot(half, gable + 0.1) + 0.1;
  for (const s of [-1, 1]) {
    const panel = new THREE.BoxGeometry(len, 0.08, d + 0.45).rotateZ(-s * ang).translate((s * half) / 2, wall + (gable + 0.1) / 2 - 0.02, 0);
    parts.push(paint(panel, '#4a2a1c'));
    const nx = Math.sin(ang) * s;
    const ny = Math.cos(ang);
    const snow = new THREE.BoxGeometry(len + 0.06, 0.13, d + 0.52).rotateZ(-s * ang).translate((s * half) / 2 + nx * 0.1, wall + (gable + 0.1) / 2 - 0.02 + ny * 0.1, 0);
    parts.push(paint(snow, SNOW));
  }
  // chimney with a snow cap
  parts.push(paint(new THREE.BoxGeometry(0.26, 0.7, 0.26).translate(0.52, wall + gable * 0.55 + 0.2, -0.25), '#7a5a50'));
  parts.push(paint(new THREE.BoxGeometry(0.34, 0.1, 0.34).translate(0.52, wall + gable * 0.55 + 0.58, -0.25), SNOW));
  // door and window frames
  parts.push(paint(new THREE.BoxGeometry(0.44, 0.72, 0.05).translate(0, 0.36, d / 2 + 0.1), '#3a2014'));
  for (const x of [-0.62, 0.62]) parts.push(paint(new THREE.BoxGeometry(0.5, 0.5, 0.04).translate(x, 0.58, d / 2 + 0.1), '#efe4cf'));
  // a snow drift round the foot
  parts.push(paint(new THREE.SphereGeometry(1, 14, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.7, 0.2, 1.25), '#e4eefc'));
  return merge(parts);
}

/** Two warm window panes and a door lamp's glow on the snow, sharing one texture (left: panes, right: glow). */
function windowGeometry() {
  const { d } = CAB;
  const quad = (w: number, h: number, u0: number, u1: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    return g;
  };
  const parts = [
    quad(0.4, 0.4, 0, 0.5).translate(-0.62, 0.58, d / 2 + 0.125),
    quad(0.4, 0.4, 0, 0.5).translate(0.62, 0.58, d / 2 + 0.125),
    quad(3.2, 2.0, 0.5, 1).rotateX(-Math.PI / 2).translate(0, 0.03, d / 2 + 1.0),
  ];
  const g = merge(parts.map(p => p.toNonIndexed()));
  return g;
}

const windowTexture = () =>
  canvasTex(128, 64, ctx => {
    const g = ctx.createRadialGradient(32, 36, 2, 32, 32, 40);
    g.addColorStop(0, '#fff3c8');
    g.addColorStop(0.6, '#ffc060');
    g.addColorStop(1, '#e0802a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#4a2a18';
    ctx.fillRect(29, 0, 6, 64);
    ctx.fillRect(0, 29, 64, 6);
    const p = ctx.createRadialGradient(96, 32, 0, 96, 32, 31);
    p.addColorStop(0, 'rgba(255,200,120,.55)');
    p.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = p;
    ctx.fillRect(64, 0, 64, 64);
  });

/** The snowman's three balls, coal face and buttons, carrot nose and his left stick arm. */
function snowmanGeometry(lite: boolean, scarf: string | null) {
  const ws = lite ? 12 : 16;
  const hs = lite ? 9 : 12;
  const coal = '#1a1a22';
  const parts = [
    paint(new THREE.SphereGeometry(0.55, ws, hs).scale(1, 0.92, 1).translate(0, 0.5, 0), SNOW),
    paint(new THREE.SphereGeometry(0.42, ws, hs).translate(0, 1.2, 0), SNOW),
    paint(new THREE.SphereGeometry(0.3, ws, hs).translate(0, 1.74, 0), SNOW),
    paint(new THREE.ConeGeometry(0.05, 0.3, 6, 1).rotateX(Math.PI / 2).translate(0, 1.73, 0.4), '#ff8a1a'),
    paint(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5, 1).rotateZ(Math.PI / 2 - 0.5).translate(-0.62, 1.42, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 4, 1).rotateZ(-0.4).translate(-0.82, 1.6, 0), '#4a2c1c'),
  ];
  for (const x of [-0.1, 0.1]) parts.push(paint(new THREE.SphereGeometry(0.04, 6, 4).translate(x, 1.81, 0.26), coal));
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    parts.push(paint(new THREE.SphereGeometry(0.025, 5, 3).translate(Math.sin(a) * 0.14, 1.64 - Math.cos(a) * 0.04 + 0.02, 0.27), coal));
  }
  for (let i = 0; i < 3; i++) parts.push(paint(new THREE.SphereGeometry(0.045, 6, 4).translate(0, 1.08 + i * 0.14, 0.4 - Math.abs(i - 1) * 0.02), coal));
  if (scarf) parts.push(...scarfParts().map(g => paint(g, scarf)));
  return merge(parts);
}
const scarfParts = () => [new THREE.TorusGeometry(0.29, 0.075, 6, 16).rotateX(Math.PI / 2).translate(0, 1.47, 0), new THREE.BoxGeometry(0.14, 0.42, 0.05).rotateZ(0.18).translate(0.16, 1.26, 0.33)];
const scarfGeometry = () => merge(scarfParts().map(g => g.toNonIndexed()).map(g => (g.deleteAttribute('uv'), g)));

/** The waving right arm: a stick with two twig fingers, reaching out along +x from the shoulder (the origin). */
function armGeometry() {
  return merge([
    paint(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5, 1).rotateZ(Math.PI / 2).translate(0.31, 0, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 4, 1).rotateZ(-0.6).translate(0.62, 0.07, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 4, 1).rotateZ(0.9).translate(0.6, -0.05, 0), '#4a2c1c'),
  ]);
}

/** A top hat with a berry-red band, sitting on its brim at the origin. */
function hatGeometry() {
  return merge([
    paint(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 16, 1).translate(0, 0.015, 0), '#1c1c26'),
    paint(new THREE.CylinderGeometry(0.2, 0.21, 0.36, 14, 1).translate(0, 0.2, 0), '#1c1c26'),
    paint(new THREE.CylinderGeometry(0.215, 0.215, 0.08, 14, 1).translate(0, 0.07, 0), '#c22a3e'),
  ]);
}

/* ---------- snow, bursts and fairy lights: one point cloud, all animated on the GPU ---------- */

const snowVert = /* glsl */ `
  attribute float aKind;
  attribute float aSeed;
  attribute vec3 aDir;
  attribute vec3 aColor;
  uniform float uTime;
  uniform vec4 uBurst;
  uniform float uSpread;
  uniform float uLights;
  uniform vec3 uBox;
  varying float vAlpha;
  varying float vKind;
  varying float vRot;
  varying vec3 vColor;
  ${POINT_SIZE}
  void main() {
    vec3 p = position;
    float size = 0.0;
    vAlpha = 1.0;
    vColor = vec3(1.0);
    vRot = aSeed * 6.0 + uTime * (aSeed - 0.5);
    if (aKind < 0.5) {
      // falling snow, drifting from side to side
      float sp = 0.35 + aSeed * 0.45;
      p.y = mod(position.y - uTime * sp, uBox.y);
      p.x += sin(uTime * (0.4 + aSeed * 0.6) + aSeed * 40.0) * 0.4;
      p.z += cos(uTime * 0.3 + aSeed * 20.0) * 0.25;
      size = 0.06 + aSeed * 0.09;
      vAlpha = 0.85 * smoothstep(0.0, 0.6, p.y) * smoothstep(uBox.y, uBox.y - 1.0, p.y);
    } else if (aKind < 1.5) {
      // a burst of flakes thrown out of a clicked thing, then settling down
      float t = uTime - uBurst.w;
      if (t > 0.0 && t < 1.6) {
        float k = t / 1.6;
        p = uBurst.xyz + aDir * (1.0 - pow(1.0 - min(1.0, t / 0.9), 3.0)) * uSpread;
        p.y = max(0.05, p.y - 0.5 * t * t);
        size = 0.12 + aSeed * 0.12;
        vAlpha = (1.0 - k * k);
      }
    } else {
      // fairy lights: twinkling, flaring when the cabin lights come on
      float tw = 0.55 + 0.45 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 30.0);
      size = 0.24 * (0.8 + 0.2 * tw) * (1.0 + uLights * 0.6);
      vAlpha = tw * (0.75 + uLights);
      vColor = aColor;
    }
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = size > 0.0 ? pointPx(mv, size) : 0.0;
    gl_Position = projectionMatrix * mv;
  }
`;

const snowFrag = /* glsl */ `
  uniform sampler2D uMap;
  varying float vAlpha;
  varying float vKind;
  varying float vRot;
  varying vec3 vColor;
  ${ROTATE_PC}
  void main() {
    vec4 c;
    if (vKind < 1.5) c = texture2D(uMap, rotPC(gl_PointCoord, vRot)) * vec4(0.92, 0.96, 1.0, 1.0);
    else {
      float d = length(gl_PointCoord - 0.5) * 2.0;
      float a = pow(max(0.0, 1.0 - d), 2.0) + smoothstep(0.3, 0.0, d);
      c = vec4(mix(vColor, vec3(1.0), smoothstep(0.35, 0.0, d)), a);
    }
    gl_FragColor = vec4(c.rgb * c.a * vAlpha, 1.0);
  }
`;

/* ---------- the aurora: a curtain of light low over the far edge ---------- */

const auroraVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float sx = (uv.x - 0.5) * 2.0;
    // bowed toward the camera at the ends, gently rippling
    p.z += sx * sx * 2.6 + sin(uv.x * 9.0 + uTime * 0.25) * 0.6;
    p.y += sin(uv.x * 16.0 + uTime * 0.4) * 0.09 * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const auroraFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAccent;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float rays = 0.55 + 0.45 * sin(vUv.x * 110.0 + sin(vUv.x * 13.0 + uTime * 0.5) * 4.0);
    float band = smoothstep(0.0, 0.18, vUv.y) * pow(1.0 - vUv.y, 1.6);
    float wave = 0.35 + 0.65 * smoothstep(-0.2, 1.0, sin(vUv.x * 7.0 - uTime * 0.22) * 0.5 + 0.5);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    vec3 c = mix(vec3(0.2, 1.0, 0.62), vec3(0.62, 0.42, 1.0), smoothstep(0.25, 0.95, vUv.y + 0.25 * sin(vUv.x * 5.0 + uTime * 0.15)));
    c = mix(c, uAccent, 0.3);
    gl_FragColor = vec4(c * band * rays * wave * edge * uStrength, 1.0);
  }
`;

/* ---------- layout ---------- */

interface Spot { x: number; z: number; s: number }
const faceCamera = (x: number, z: number) => Math.atan2(-x, 11 - z);

function layout(portrait: boolean, lite: boolean) {
  const pines: Spot[] = portrait
    ? [{ x: -3.5, z: -9.4, s: 0.9 }, { x: 3.7, z: -9.0, s: 0.95 }, { x: -4.7, z: -11.6, s: 1.15 }, { x: 4.8, z: -11.9, s: 1.2 }, { x: 0.4, z: -13.2, s: 0.9 }]
    : [
        { x: -9.6, z: -3.4, s: 1.1 }, { x: 9.5, z: -4.0, s: 1.15 }, { x: -11.0, z: -6.4, s: 1.45 }, { x: 10.9, z: -7.0, s: 1.5 },
        { x: -2.8, z: -9.8, s: 0.8 }, { x: 2.4, z: -10.4, s: 0.9 }, { x: 8.2, z: -9.6, s: 1.1 }, { x: -8.9, z: -9.8, s: 1.05 },
      ];
  return {
    pines: lite ? pines.slice(0, portrait ? 3 : 4) : pines,
    cabin: portrait ? { x: -1.7, z: -11.6, s: 0.8 } : { x: -6.0, z: -8.0, s: 1 },
    snowman: portrait ? { x: 2.0, z: -10.2, s: 0.75 } : { x: 5.4, z: -7.6, s: 0.95 },
    flakes: lite ? 110 : 300,
    burst: lite ? 24 : 40,
    box: portrait ? { x: 7, z0: -14, z1: 4, y: 8 } : { x: 14, z0: -12, z1: 3, y: 7 },
    aurora: portrait ? { w: 18, z: -12.6, h: 3.2 } : { w: 30, z: -9.3, h: 2.6 },
  };
}

const setCursor = (c: string) => {
  document.body.style.cursor = c;
};

const LIGHT_COLS = ['#ffcf5a', '#ff6a7a', '#7affc8', '#8fd4ff', '#fff4e0'].map(c => new THREE.Color(c));
const WARM = new THREE.Color('#ffb85a');

/**
 * Winter: snowy pines, a log cabin with warm windows and fairy lights, a snowman in a top hat with a scarf
 * in the colour of play, snow falling and an aurora low over the far edge.
 * Click a pine to shake its snow off, the cabin to switch its lights on, the snowman to wave and lose his hat.
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const L = useMemo(() => layout(portrait, lite), [portrait, lite]);
  const res = useMemo(
    () => ({
      pine: pineGeometry(lite),
      cabin: cabinGeometry(),
      windows: windowGeometry(),
      windowTex: windowTexture(),
      snowman: snowmanGeometry(lite, lite ? '#d83a4a' : null),
      scarf: scarfGeometry(),
      arm: armGeometry(),
      hat: hatGeometry(),
      flake: flakeTexture(),
      aurora: new THREE.PlaneGeometry(1, 1, lite ? 24 : 48, 1).translate(0, 0.5, 0),
    }),
    [lite],
  );

  // the transforms of the cabin and snowman, used to place the fairy lights and the bursts
  const cabinM = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(L.cabin.x, 0, L.cabin.z);
    o.rotation.y = faceCamera(L.cabin.x, L.cabin.z);
    o.scale.setScalar(L.cabin.s);
    o.updateMatrix();
    return o.matrix.clone();
  }, [L]);

  const cloud = useMemo(() => {
    const lightPts: THREE.Vector3[] = [];
    // along the front eaves of the cabin
    const { w, d, wall, gable } = CAB;
    const half = w / 2 + 0.3;
    for (let i = 0; i <= 12; i++) {
      const f = i / 12;
      const x = -half + f * half * 2;
      const y = wall - 0.04 + (gable + 0.1) * (1 - Math.abs(x) / half);
      lightPts.push(new THREE.Vector3(x, y - 0.06, d / 2 + 0.26).applyMatrix4(cabinM));
    }
    // wound round the two nearest pines
    if (!lite) {
      L.pines.slice(0, 2).forEach(p => {
        for (let k = 0; k < 11; k++) {
          const f = k / 11;
          const y = 0.5 + f * 1.45;
          const a = f * Math.PI * 4.5;
          const r = pineRadius(y) * 1.02 + 0.03;
          lightPts.push(new THREE.Vector3(p.x + Math.cos(a) * r * p.s, y * p.s, p.z + Math.sin(a) * r * p.s));
        }
      });
    }
    const n = L.flakes + L.burst + lightPts.length;
    const pos = new Float32Array(n * 3);
    const kind = new Float32Array(n);
    const seed = new Float32Array(n);
    const dir = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const { box } = L;
    for (let i = 0; i < n; i++) {
      seed[i] = Math.random();
      if (i < L.flakes) {
        pos.set([(Math.random() * 2 - 1) * box.x, Math.random() * box.y, box.z0 + Math.random() * (box.z1 - box.z0)], i * 3);
      } else if (i < L.flakes + L.burst) {
        kind[i] = 1;
        const a = Math.random() * Math.PI * 2;
        const up = 0.2 + Math.random() * 0.9;
        const r = 0.4 + Math.random() * 0.6;
        dir.set([Math.cos(a) * r, up, Math.sin(a) * r], i * 3);
      } else {
        kind[i] = 2;
        const j = i - L.flakes - L.burst;
        lightPts[j].toArray(pos, i * 3);
        LIGHT_COLS[j % LIGHT_COLS.length].toArray(col, i * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [L, lite, cabinM]);

  const snowU = useMemo(
    () => ({
      uTime: { value: 0 },
      uViewH: { value: 800 },
      uBurst: { value: new THREE.Vector4(0, 0, 0, -100) },
      uSpread: { value: 1.5 },
      uLights: { value: 0 },
      uBox: { value: new THREE.Vector3(L.box.x, L.box.y, 0) },
      uMap: { value: res.flake },
    }),
    [L, res],
  );
  const auroraU = useMemo(() => ({ uTime: { value: 0 }, uAccent: { value: new THREE.Color(accent) }, uStrength: { value: 0.8 } }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      Object.values(res).forEach(r => r.dispose());
      cloud.dispose();
      setCursor('');
    },
    [res, cloud],
  );

  const pines = useRef<THREE.InstancedMesh>(null!);
  const snowman = useRef<THREE.Group>(null!);
  const arm = useRef<THREE.Mesh>(null!);
  const hat = useRef<THREE.Mesh>(null!);
  const scarfMat = useRef<THREE.MeshLambertMaterial>(null);
  const winMat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null);

  // interaction state lives in refs: no React renders
  const st = useRef({ hoverPine: -1, hoverCabin: false, hoverMan: false, shakeAt: new Float64Array(8).fill(-10), lightsAt: -10, waveAt: -10, clock: 0 });
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color(), acc: new THREE.Color(accent), v: new THREE.Vector3() }), []); // eslint-disable-line react-hooks/exhaustive-deps
  // per-instance colours exist from the start, so the material compiles with them
  const pineColors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(L.pines.length * 3).fill(1), 3), [L]);

  const burst = (x: number, y: number, z: number, spread: number) => {
    snowU.uBurst.value.set(x, y, z, st.current.clock);
    snowU.uSpread.value = spread;
  };

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const t = state.clock.elapsedTime;
    const s = st.current;
    s.clock = t;
    const { o, c, acc } = tmp;
    acc.lerp(c.set(accent), Math.min(1, dt * 2));
    snowU.uTime.value = t;
    snowU.uViewH.value = state.size.height * state.viewport.dpr;

    // pines: a slow sway; hover brightens, a click shakes the snow off
    L.pines.forEach((p, i) => {
      const k = t - s.shakeAt[i];
      const shake = k >= 0 && k < 1.2 ? Math.sin(k * 30) * 0.12 * (1 - k / 1.2) : 0;
      const hov = s.hoverPine === i;
      o.position.set(p.x, 0, p.z);
      o.rotation.set(Math.sin(t * 0.7 + i) * 0.012 + shake * 0.5, i * 1.3, Math.sin(t * 0.9 + i * 2) * 0.015 + shake + (hov ? Math.sin(t * 9) * 0.03 : 0));
      o.scale.setScalar(p.s * (hov ? 1.04 : 1));
      o.updateMatrix();
      pines.current.setMatrixAt(i, o.matrix);
      const b = hov ? 1.35 : 1;
      pines.current.setColorAt(i, c.setScalar(b));
    });
    pines.current.instanceMatrix.needsUpdate = true;
    pines.current.instanceColor!.needsUpdate = true;

    // cabin windows: a warm flicker; a click flicks them off and on, then they blaze for a while
    const lk = t - s.lightsAt;
    let glow = 1 + Math.sin(t * 6.3) * 0.04 + Math.sin(t * 13.1) * 0.03 + (s.hoverCabin ? 0.35 : 0);
    let flare = 0;
    if (lk >= 0 && lk < 4) {
      if (lk < 0.6) glow *= Math.sin(lk * 40) > 0 ? 1.6 : 0.15;
      else flare = lk < 1 ? 1 : 1 - (lk - 1) / 3;
    }
    glow += flare * 0.8;
    winMat.current.color.copy(WARM).lerp(acc, 0.15 + flare * 0.25).multiplyScalar(glow);
    snowU.uLights.value = (s.hoverCabin ? 0.3 : 0) + flare * 1.2;
    if (light.current) {
      light.current.intensity = 5 * glow;
      light.current.color.copy(WARM).lerp(acc, 0.2);
    }

    // the snowman: a gentle lean, a wobble on hover; a click makes him wave and his hat pop up and spin
    const wk = t - s.waveAt;
    const waving = wk >= 0 && wk < 2;
    const man = snowman.current;
    man.rotation.z = Math.sin(t * 0.8) * 0.015 + (s.hoverMan ? Math.sin(t * 10) * 0.05 : 0) + (waving && wk < 0.4 ? Math.sin(wk * 25) * 0.06 * (1 - wk / 0.4) : 0);
    arm.current.rotation.z = waving ? 0.5 + Math.abs(Math.sin(wk * 7)) * 0.9 * Math.min(1, (2 - wk) * 2) : 0.35 + Math.sin(t * 1.3) * 0.05;
    const hk = waving ? wk / 1.1 : 1;
    const h = hat.current;
    if (hk < 1) {
      h.position.y = 1.98 + Math.sin(hk * Math.PI) * 1.1;
      h.rotation.set(Math.sin(hk * Math.PI) * 0.4, hk * Math.PI * 4, 0);
    } else {
      h.position.y = 1.98;
      h.rotation.set(0, 0, -0.12 + (s.hoverMan ? Math.sin(t * 10) * 0.08 : 0));
    }
    if (scarfMat.current) scarfMat.current.color.copy(acc);

    auroraU.uTime.value = t;
    auroraU.uAccent.value.copy(acc);
  });

  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();
  const overPine = (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current.hoverPine = e.instanceId ?? -1;
    setCursor('pointer');
  };
  const outPine = (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current.hoverPine = -1;
    setCursor('');
  };
  const clickPine = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    const i = e.instanceId ?? 0;
    const p = L.pines[i];
    st.current.shakeAt[i] = st.current.clock;
    burst(p.x, 1.5 * p.s, p.z, 1.6 * p.s);
  };
  const hover = (key: 'hoverCabin' | 'hoverMan', on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current[key] = on;
    setCursor(on ? 'pointer' : '');
  };
  const clickCabin = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    if (st.current.clock - st.current.lightsAt > 1) st.current.lightsAt = st.current.clock;
    tmp.v.set(0, CAB.wall + CAB.gable + 0.2, 0).applyMatrix4(cabinM);
    burst(tmp.v.x, tmp.v.y, tmp.v.z, 1.8 * L.cabin.s);
  };
  const clickMan = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    if (st.current.clock - st.current.waveAt > 2) {
      st.current.waveAt = st.current.clock;
      burst(L.snowman.x, 2.0 * L.snowman.s, L.snowman.z, 1.2);
    }
  };

  const man = L.snowman;
  return (
    <>
      <instancedMesh
        ref={pines}
        args={[res.pine, undefined, L.pines.length]}
        instanceColor={pineColors}
       
        onPointerOver={overPine}
        onPointerOut={outPine}
        onClick={clickPine}
      >
        <meshLambertMaterial vertexColors emissive="#0a1a2a" />
      </instancedMesh>
      <group position={[L.cabin.x, 0, L.cabin.z]} rotation={[0, faceCamera(L.cabin.x, L.cabin.z), 0]} scale={L.cabin.s}>
        <mesh geometry={res.cabin} onPointerOver={hover('hoverCabin', true)} onPointerOut={hover('hoverCabin', false)} onClick={clickCabin}>
          <meshLambertMaterial vertexColors emissive="#140a10" />
        </mesh>
        <mesh geometry={res.windows} renderOrder={2}>
          <meshBasicMaterial ref={winMat} map={res.windowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <group ref={snowman} position={[man.x, 0, man.z]} rotation={[0, faceCamera(man.x, man.z), 0]} scale={man.s}>
        <mesh geometry={res.snowman} onPointerOver={hover('hoverMan', true)} onPointerOut={hover('hoverMan', false)} onClick={clickMan}>
          <meshLambertMaterial vertexColors emissive="#1a2238" />
        </mesh>
        {!lite && (
          <mesh geometry={res.scarf}>
            <meshLambertMaterial ref={scarfMat} emissive="#200810" />
          </mesh>
        )}
        <mesh ref={arm} geometry={res.arm} position={[0.38, 1.32, 0]}>
          <meshLambertMaterial vertexColors />
        </mesh>
        <mesh ref={hat} geometry={res.hat} position={[0, 1.98, 0]} onPointerOver={hover('hoverMan', true)} onPointerOut={hover('hoverMan', false)} onClick={clickMan}>
          <meshLambertMaterial vertexColors emissive="#101018" />
        </mesh>
      </group>
      <points geometry={cloud} frustumCulled={false} renderOrder={6}>
        <shaderMaterial vertexShader={snowVert} fragmentShader={snowFrag} uniforms={snowU} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>
      {!lite && (
        <mesh geometry={res.aurora} position={[0, 0.15, L.aurora.z]} scale={[L.aurora.w, L.aurora.h, 1]} renderOrder={-10} frustumCulled={false}>
          <shaderMaterial vertexShader={auroraVert} fragmentShader={auroraFrag} uniforms={auroraU} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}
      {!lite && <pointLight ref={light} position={[L.cabin.x, 1.2, L.cabin.z + 2.2]} distance={9} decay={1.5} />}
    </>
  );
}
