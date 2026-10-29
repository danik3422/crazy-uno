import { Stars } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { Color, ThemeId } from '../game/types';
import type { View } from './layout';

interface Palette { inner: string; mid: string; outer: string; accent: string }

/**
 * Colours of the arena for every theme and current colour.
 * Classic floods the whole world with the colour; the others keep their own mood and only tint it.
 */
export const PALETTES: Record<ThemeId, Record<Color, Palette>> = {
  classic: {
    red: { inner: '#ffd25e', mid: '#f0401e', outer: '#3c0505', accent: '#ff8a5c' },
    yellow: { inner: '#fff7b8', mid: '#f5a300', outer: '#3d1d00', accent: '#ffe27a' },
    green: { inner: '#e6ffa8', mid: '#20ad4c', outer: '#022514', accent: '#8dffb0' },
    blue: { inner: '#bdf3ff', mid: '#3a63f0', outer: '#100845', accent: '#8ac8ff' },
  },
  neon: {
    red: { inner: '#ff2e88', mid: '#2a0634', outer: '#05010c', accent: '#ff2e88' },
    yellow: { inner: '#ffe600', mid: '#2a1a06', outer: '#05010c', accent: '#ffe600' },
    green: { inner: '#39ff88', mid: '#062a20', outer: '#02060a', accent: '#39ff88' },
    blue: { inner: '#2ee6ff', mid: '#061c34', outer: '#02040e', accent: '#2ee6ff' },
  },
  space: {
    red: { inner: '#ff9a8a', mid: '#2a1240', outer: '#02010a', accent: '#ff7a6a' },
    yellow: { inner: '#ffe0a0', mid: '#2a1a40', outer: '#02010a', accent: '#ffd27a' },
    green: { inner: '#a0ffd0', mid: '#0e2440', outer: '#02010a', accent: '#7affc0' },
    blue: { inner: '#a8c8ff', mid: '#141a50', outer: '#02010a', accent: '#8ab0ff' },
  },
  halloween: {
    red: { inner: '#ff5a2a', mid: '#3a0f2e', outer: '#0b0310', accent: '#ff7a1a' },
    yellow: { inner: '#ffb02a', mid: '#3a1a1e', outer: '#0b0310', accent: '#ffb02a' },
    green: { inner: '#7aff3a', mid: '#1e2a1a', outer: '#06080a', accent: '#9dff3a' },
    blue: { inner: '#a07aff', mid: '#24124a', outer: '#08031a', accent: '#b08aff' },
  },
};

const MODE: Record<ThemeId, number> = { classic: 0, neon: 1, space: 2, halloween: 3 };

const vert = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// One floor shader, four looks: stage glow, synthwave grid, nebula with stars, spider web.
const frag = /* glsl */ `
  uniform vec3 cIn;
  uniform vec3 cMid;
  uniform vec3 cOut;
  uniform float uTime;
  uniform float uMode;
  uniform vec2 uCenter;
  varying vec3 vPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  void main() {
    vec2 p = vPos.xz - uCenter;
    p.y *= 1.45;
    float r = length(p);
    float a = atan(p.y, p.x);
    vec3 col = mix(cIn, cMid, smoothstep(0.0, 5.0, r));
    col = mix(col, cOut, smoothstep(4.5, 17.0, r));

    if (uMode < 0.5) {
      // classic stage: rings drifting outward and faceted light sectors
      float ring = pow(0.5 + 0.5 * sin(r * 1.5 - uTime * 1.3), 26.0);
      col += mix(cIn, vec3(1.0), 0.35) * ring * 0.2 * smoothstep(16.0, 2.0, r);
      col += cIn * (smoothstep(0.14, 0.0, abs(r - 3.1)) * 0.4 + smoothstep(0.1, 0.0, abs(r - 5.2)) * 0.2);
      float sector = floor((a + 3.14159) / 6.28318 * 16.0);
      float facet = fract(sin(sector * 12.9898 + floor(r * 0.3) * 78.233) * 43758.5453);
      col *= 0.88 + 0.2 * facet * smoothstep(1.5, 9.0, r);
    } else if (uMode < 1.5) {
      // neon: a glowing grid scrolling toward the player, plus bright rings around the pile
      col = mix(cMid * 0.7, cOut, smoothstep(2.0, 16.0, r));
      vec2 g = vec2(vPos.x, vPos.z + uTime * 0.6) / 1.1;
      vec2 d = abs(fract(g) - 0.5);
      float line = smoothstep(0.47, 0.5, max(d.x, d.y));
      col += cIn * line * 0.6 * smoothstep(18.0, 3.0, r);
      col += cIn * smoothstep(0.12, 0.0, abs(r - 3.1)) * 0.9;
      col += cIn * smoothstep(0.08, 0.0, abs(r - 3.45)) * 0.35;
      col += cIn * 0.25 * smoothstep(3.0, 0.0, r);
    } else if (uMode < 2.5) {
      // space: drifting nebula clouds and a sprinkle of twinkling stars on a glassy floor
      float n = noise(vPos.xz * 0.18 + vec2(uTime * 0.02, 0.0)) * 0.6 + noise(vPos.xz * 0.45 - uTime * 0.03) * 0.4;
      col = mix(cOut, cMid, smoothstep(0.35, 0.85, n));
      col += cIn * smoothstep(0.62, 0.95, n) * 0.35;
      vec2 cell = floor(vPos.xz * 3.0);
      float star = step(0.985, hash(cell)) * smoothstep(0.12, 0.0, length(fract(vPos.xz * 3.0) - 0.5));
      col += vec3(star) * (0.6 + 0.4 * sin(uTime * 3.0 + hash(cell) * 40.0));
      col += cIn * smoothstep(0.1, 0.0, abs(r - 3.1)) * 0.35;
      col += cIn * 0.18 * smoothstep(3.5, 0.0, r);
    } else {
      // halloween: a spider web spun around the pile, with creeping coloured fog
      float spokes = smoothstep(0.06, 0.0, abs(sin(a * 6.0)) * r * 0.12);
      float wav = r + 0.18 * sin(a * 12.0);
      float rings = smoothstep(0.47, 0.5, abs(fract(wav / 1.3) - 0.5) + 0.0);
      float web = max(spokes, rings) * smoothstep(13.0, 2.5, r);
      col += vec3(0.85, 0.8, 0.7) * web * 0.22;
      float fog = noise(vPos.xz * 0.25 + vec2(uTime * 0.05, uTime * 0.03));
      col += cIn * fog * 0.18 * smoothstep(12.0, 2.0, r);
      col += cIn * smoothstep(0.12, 0.0, abs(r - 3.1)) * 0.45;
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Props {
  color: Color;
  theme: ThemeId;
  view: View;
  center: [number, number];
}

export function Arena({ color, theme, view, center }: Props) {
  const { scene } = useThree();
  const pal = PALETTES[theme][color];
  // created once; colours and mode follow the props inside useFrame
  const uniforms = useMemo(
    () => ({
      cIn: { value: new THREE.Color(pal.inner) },
      cMid: { value: new THREE.Color(pal.mid) },
      cOut: { value: new THREE.Color(pal.outer) },
      uTime: { value: 0 },
      uMode: { value: MODE[theme] },
      uCenter: { value: new THREE.Vector2(...center) },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tmp = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    scene.background = new THREE.Color(pal.outer);
    scene.fog = new THREE.Fog(pal.outer, 18, 42);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((st, dt) => {
    const k = Math.min(1, dt * 2.2);
    uniforms.cIn.value.lerp(tmp.set(pal.inner), k);
    uniforms.cMid.value.lerp(tmp.set(pal.mid), k);
    uniforms.cOut.value.lerp(tmp.set(pal.outer), k);
    uniforms.uTime.value = st.clock.elapsedTime;
    uniforms.uMode.value = MODE[theme];
    uniforms.uCenter.value.set(center[0], center[1]);
    tmp.set(pal.outer);
    (scene.background as THREE.Color).lerp(tmp, k);
    scene.fog?.color.lerp(tmp, k);
  });

  return (
    <>
      {/* drawn first and without depth: the faint reflections of the opponents' cards show on it */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} renderOrder={-100}>
        <planeGeometry args={[90, 90]} />
        <shaderMaterial vertexShader={vert} fragmentShader={frag} uniforms={uniforms} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={theme === 'classic' ? 0.28 : 0.45} />
      </mesh>
      {theme === 'classic' && <Shards accent={pal.accent} portrait={view.portrait} />}
      {theme === 'neon' && <NeonShapes accent={pal.accent} portrait={view.portrait} />}
      {theme === 'space' && <SpaceDecor accent={pal.accent} />}
      {theme === 'halloween' && <HalloweenDecor accent={pal.accent} portrait={view.portrait} />}
    </>
  );
}

/** Makes a material's colour follow the theme accent smoothly. */
function useAccent(mat: RefObject<THREE.MeshBasicMaterial>, accent: string) {
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    mat.current?.color.lerp(tmp.set(accent), Math.min(1, dt * 2));
  });
}

interface DriftPart { a: number; r: number; y: number; s: number; spin: number; speed: number; rot: THREE.Euler }

/** Objects slowly drifting in a ring around the arena (shared by several themes). */
function useDrift(count: number, portrait: boolean, yMin: number, yMax: number): DriftPart[] {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        a: (i / count) * Math.PI * 2 + Math.random() * 0.3,
        r: (portrait ? 6 : 9) + Math.random() * 9,
        y: yMin + Math.random() * (yMax - yMin),
        s: 0.4 + Math.random() * 1.4,
        spin: (Math.random() - 0.5) * 0.8,
        speed: 0.015 + Math.random() * 0.03,
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      })),
    [count, portrait, yMin, yMax],
  );
}

function stepDrift(parts: DriftPart[], mesh: THREE.InstancedMesh, dummy: THREE.Object3D, t: number, dt: number, scale = 1) {
  parts.forEach((p, i) => {
    p.a += p.speed * dt;
    p.rot.x += p.spin * dt;
    p.rot.y += p.spin * 0.7 * dt;
    // on the near side of the ring they climb out of the way, so nothing drifts into the camera
    const front = Math.max(0, Math.sin(p.a));
    dummy.position.set(Math.cos(p.a) * p.r, p.y + Math.sin(t * 0.5 + i) * 0.3 + front * 9, Math.sin(p.a) * p.r * 0.7 - 2);
    dummy.rotation.copy(p.rot);
    dummy.scale.setScalar(p.s * scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/** Classic: translucent glass triangles. */
function Shards({ accent, portrait }: { accent: string; portrait: boolean }) {
  const N = 42;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0.5, 0, -0.45, -0.35, 0, 0.5, -0.3, 0], 3));
    return g;
  }, []);
  const parts = useDrift(N, portrait, 0.6, 6.6);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useAccent(mat, accent);
  useFrame((st, dt) => stepDrift(parts, ref.current, dummy, st.clock.elapsedTime, dt));
  return (
    <instancedMesh ref={ref} args={[geo, undefined, N]}>
      <meshBasicMaterial ref={mat} transparent opacity={0.28} side={THREE.DoubleSide} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

/** Neon: wireframe shapes glowing in the accent colour, plus laser beams sweeping the dark. */
function NeonShapes({ accent, portrait }: { accent: string; portrait: boolean }) {
  const octa = useRef<THREE.InstancedMesh>(null!);
  const tor = useRef<THREE.InstancedMesh>(null!);
  const m1 = useRef<THREE.MeshBasicMaterial>(null!);
  const m2 = useRef<THREE.MeshBasicMaterial>(null!);
  const beams = useRef<THREE.Group>(null!);
  const a = useDrift(16, portrait, 1, 7);
  const b = useDrift(10, portrait, 1.5, 6);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useAccent(m1, accent);
  useAccent(m2, accent);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    stepDrift(a, octa.current, dummy, t, dt, 0.8);
    stepDrift(b, tor.current, dummy, t, dt, 0.7);
    beams.current.children.forEach((c, i) => {
      c.rotation.z = Math.sin(t * 0.6 + i * 1.7) * 0.5;
    });
  });
  return (
    <>
      <instancedMesh ref={octa} args={[undefined, undefined, 16]}>
        <octahedronGeometry args={[0.5, 0]} />
        <meshBasicMaterial ref={m1} wireframe transparent opacity={0.85} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={tor} args={[undefined, undefined, 10]}>
        <torusGeometry args={[0.45, 0.06, 6, 18]} />
        <meshBasicMaterial ref={m2} transparent opacity={0.7} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <group ref={beams}>
        {[-9, -3, 3, 9].map((x, i) => (
          <mesh key={x} position={[x, 9, -14]}>
            <planeGeometry args={[0.18, 26]} />
            <meshBasicMaterial color={i % 2 ? '#2ee6ff' : '#ff2e88'} transparent opacity={0.22} toneMapped={false} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/** Space: a star field, a big ringed planet on the horizon, a small moon and tumbling asteroids. */
function SpaceDecor({ accent }: { accent: string }) {
  const planet = useRef<THREE.Group>(null!);
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const parts = useDrift(22, false, 0.8, 7);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useAccent(ringMat, accent);
  useFrame((st, dt) => {
    planet.current.rotation.y += dt * 0.05;
    stepDrift(parts, rocks.current, dummy, st.clock.elapsedTime, dt, 0.55);
  });
  return (
    <>
      <Stars radius={70} depth={30} count={2500} factor={4} saturation={0} fade speed={0.6} />
      {/* the camera looks down at the table, so the planet hangs low over the far edge to stay in view */}
      <group ref={planet} position={[4.8, 1.5, -8.5]} rotation={[0.35, 0, 0.25]} scale={0.3}>
        <mesh>
          <sphereGeometry args={[6, 48, 32]} />
          <meshStandardMaterial color="#e8603a" emissive="#5a1a4a" emissiveIntensity={0.35} roughness={0.9} />
        </mesh>
        <mesh rotation-x={Math.PI / 2.2}>
          <ringGeometry args={[7.5, 11, 96]} />
          <meshBasicMaterial ref={ringMat} transparent opacity={0.45} side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      <mesh position={[-4.6, 1.7, -9]}>
        <sphereGeometry args={[0.55, 32, 24]} />
        <meshStandardMaterial color="#9fb4ff" emissive="#2a3a8a" emissiveIntensity={0.5} roughness={1} />
      </mesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 22]}>
        <dodecahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#8a8494" roughness={1} flatShading />
      </instancedMesh>
    </>
  );
}

function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const batTexture = () =>
  canvasTex(128, 64, ctx => {
    ctx.fillStyle = '#0d0410';
    ctx.translate(64, 30);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(-26, -26, -62, -8);
    ctx.quadraticCurveTo(-46, -2, -42, 14);
    ctx.quadraticCurveTo(-30, 2, -20, 14);
    ctx.quadraticCurveTo(-10, 2, 0, 12);
    ctx.quadraticCurveTo(10, 2, 20, 14);
    ctx.quadraticCurveTo(30, 2, 42, 14);
    ctx.quadraticCurveTo(46, -2, 62, -8);
    ctx.quadraticCurveTo(26, -26, 0, -6);
    ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-6, -2, 3, 3);
    ctx.fillRect(3, -2, 3, 3);
  });

/** Glowing jack-o'-lantern face: triangle eyes and a zig-zag grin. */
const pumpkinFaceTexture = () =>
  canvasTex(128, 128, ctx => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffd36a';
    const tri = (x: number, y: number, s: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.6);
      ctx.lineTo(x - s, y + s * 0.6);
      ctx.closePath();
      ctx.fill();
    };
    tri(44, 48, 12);
    tri(84, 48, 12);
    ctx.beginPath();
    ctx.moveTo(30, 78);
    for (let i = 0; i <= 6; i++) ctx.lineTo(30 + i * 11.3, 78 + (i % 2 ? 10 : 0));
    ctx.lineTo(98, 92);
    ctx.quadraticCurveTo(64, 112, 30, 92);
    ctx.closePath();
    ctx.fill();
  });

/** Halloween: a flock of flapping bats and grinning jack-o'-lanterns around the table. */
function HalloweenDecor({ accent, portrait }: { accent: string; portrait: boolean }) {
  const N = 18;
  const bats = useRef<THREE.InstancedMesh>(null!);
  const glow = useRef<THREE.PointLight>(null!);
  const batTex = useMemo(batTexture, []);
  const faceTex = useMemo(pumpkinFaceTexture, []);
  const parts = useDrift(N, portrait, 2.5, 7);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const pumpkins = useMemo(() => {
    const ring = portrait
      ? [[-3.6, 3.2], [3.6, 3.2], [-3.8, -4.8], [3.8, -4.8]]
      : [[-8.2, 2.6], [8.2, 2.6], [-6, -4.6], [6, -4.6], [0, -5.6]];
    return ring.map(([x, z], i) => ({ x, z, s: 0.7 + (i % 3) * 0.2, rot: -x * 0.08 }));
  }, [portrait]);
  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    parts.forEach((p, i) => {
      p.a += p.speed * 3 * dt;
      const front = Math.max(0, Math.sin(p.a));
      dummy.position.set(Math.cos(p.a) * p.r, p.y + Math.sin(t * 2 + i) * 0.4 + front * 9, Math.sin(p.a) * p.r * 0.7 - 2);
      dummy.rotation.set(0, -p.a, 0);
      // flap: squash the wings vertically in a quick rhythm
      const flap = 0.35 + Math.abs(Math.sin(t * 9 + i)) * 0.65;
      dummy.scale.set(p.s * 0.9, p.s * 0.45 * flap, 1);
      dummy.updateMatrix();
      bats.current.setMatrixAt(i, dummy.matrix);
    });
    bats.current.instanceMatrix.needsUpdate = true;
    glow.current.intensity = 18 + Math.sin(t * 7) * 3 + Math.random() * 3;
    glow.current.color.lerp(tmp.set(accent), Math.min(1, dt * 2));
  });
  return (
    <>
      <instancedMesh ref={bats} args={[undefined, undefined, N]}>
        <planeGeometry args={[1.6, 0.8]} />
        <meshBasicMaterial map={batTex} transparent alphaTest={0.4} side={THREE.DoubleSide} />
      </instancedMesh>
      {pumpkins.map((p, i) => (
        <group key={i} position={[p.x, 0.5 * p.s, p.z]} rotation-y={p.rot} scale={p.s}>
          <mesh scale={[1.15, 0.85, 1.15]} castShadow>
            <sphereGeometry args={[0.6, 24, 16]} />
            <meshStandardMaterial color="#ff7a1a" emissive="#ff5a00" emissiveIntensity={0.25} roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.02, 0.62]}>
            <planeGeometry args={[0.9, 0.9]} />
            <meshBasicMaterial map={faceTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0.56, 0]}>
            <cylinderGeometry args={[0.06, 0.09, 0.25, 8]} />
            <meshStandardMaterial color="#3a6b1a" />
          </mesh>
        </group>
      ))}
      <pointLight ref={glow} position={[0, 2.5, -1]} distance={16} decay={1.6} />
    </>
  );
}
