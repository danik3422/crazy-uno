import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { DecorProps } from '../types';
import { glowTex, laserTex } from './textures';

/*
 * Neon club around the table:
 *  - an equalizer of light bars along the far edge, mirrored in the glossy floor (click: a bass drop)
 *  - two holographic wire shapes hovering between the far seats (hover: brighten; click: spin, colour flip, flash)
 *  - laser beams sweeping down from the dark ceiling onto the far floor (they strobe on every click)
 *  - neon dust rising at the edges
 * Everything is additive, unlit and shared, a handful of draw calls in all.
 */

const PINK = new THREE.Color('#ff2ea6');
const CYAN = new THREE.Color('#22e6ff');
const HUES = ['#ff2ea6', '#22e6ff', '#ffe14a', '#2bff88', '#a64dff'].map((c) => new THREE.Color(c));
const UP = new THREE.Vector3(0, 1, 0);

/** shared click state: lasers strobe after any click, the equalizer drops after a click on it */
const club = { strobeAt: -10, dropAt: -10 };
/** the last frame's clock time, readable from event handlers (clicks line up with useFrame's elapsedTime) */
const clockTime = { current: 0 };

/* ---------- shared geometry (module level, built once) ---------- */

/** the edges of a polyhedron as thin tubes, merged into one mesh: thick neon lines with no line-width limits */
function tubeEdges(src: THREE.BufferGeometry, radius: number) {
  const edges = new THREE.EdgesGeometry(src);
  const pos = edges.getAttribute('position');
  const parts: THREE.BufferGeometry[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    const len = a.distanceTo(b);
    const c = new THREE.CylinderGeometry(radius, radius, len, 5, 1, true);
    q.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    c.applyQuaternion(q);
    c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(c);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  edges.dispose();
  return merged;
}

let shapes: { ico: THREE.BufferGeometry; gyro: THREE.BufferGeometry; core: THREE.BufferGeometry; hit: THREE.BufferGeometry } | null = null;
function shapeGeos() {
  if (shapes) return shapes;
  const ico = tubeEdges(new THREE.IcosahedronGeometry(0.62, 0), 0.028);
  // a gyroscope: three tube rings at right angles
  const r1 = new THREE.TorusGeometry(0.58, 0.026, 5, 40);
  const r2 = r1.clone().rotateX(Math.PI / 2);
  const r3 = r1.clone().rotateY(Math.PI / 2).scale(0.78, 0.78, 0.78);
  const gyro = mergeGeometries([r1, r2, r3])!;
  [r1, r2, r3].forEach((g) => g.dispose());
  shapes = {
    ico,
    gyro,
    core: new THREE.OctahedronGeometry(0.24, 0),
    hit: new THREE.SphereGeometry(0.95, 8, 6),
  };
  return shapes;
}

/** an equalizer bar: a box standing on its base, so scale.y is its height */
const barGeo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
/** a laser: two crossed planes running along +Y from 0 to 1, visible from every side */
const laserGeo = (() => {
  const a = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const b = a.clone().rotateY(Math.PI / 2);
  const m = mergeGeometries([a, b])!;
  a.dispose();
  b.dispose();
  return m;
})();
const spotGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

/* ---------- layout ---------- */

interface Layout {
  bars: { x: number; z: number }[];
  shapes: [number, number, number][];
  lasers: { from: THREE.Vector3; sweepX: [number, number]; z: number; speed: number; phase: number }[];
  dust: { x: [number, number]; z: [number, number] };
}

function layout(portrait: boolean, lite: boolean): Layout {
  // bars along the far edge, gently curving toward you at the sides, with a gap behind the far seat
  const bars: Layout['bars'] = [];
  const per = lite ? 7 : 11;
  const [x0, x1, zBack, curve] = portrait ? [1.4, 5.4, -9.4, 0.3] : [2.5, 10.2, -10.4, 0.26];
  for (const s of [-1, 1])
    for (let i = 0; i < per; i++) {
      const x = x0 + ((x1 - x0) * i) / (per - 1);
      bars.push({ x: x * s, z: zBack + (x - x0) * curve });
    }
  const sx = portrait ? 3.1 : 5.6;
  const sz = portrait ? -7.2 : -7.6;
  const lasers: Layout['lasers'] = [
    { from: new THREE.Vector3(-13, 13, -4), sweepX: [-9, 1], z: -9.5, speed: 0.55, phase: 0 },
    { from: new THREE.Vector3(13, 13, -4), sweepX: [-1, 9], z: -9.5, speed: 0.6, phase: 2.1 },
    { from: new THREE.Vector3(-6, 14, -16), sweepX: [-8, 6], z: -7.5, speed: 0.4, phase: 4.2 },
    { from: new THREE.Vector3(6, 14, -16), sweepX: [-6, 8], z: -7.5, speed: 0.47, phase: 1.3 },
  ];
  return {
    bars,
    shapes: [
      [-sx, 0.8, sz],
      [sx, 0.8, sz],
    ],
    lasers: lite ? lasers.slice(0, 2) : lasers,
    dust: portrait ? { x: [4.2, 7], z: [-9, 2] } : { x: [8, 12], z: [-9, 1] },
  };
}

/* ---------- pointer helpers ---------- */

function useCursor() {
  const over = useRef(0);
  useEffect(
    () => () => {
      if (over.current > 0) document.body.style.cursor = '';
    },
    [],
  );
  return {
    enter: () => {
      over.current++;
      document.body.style.cursor = 'pointer';
    },
    leave: () => {
      over.current = Math.max(0, over.current - 1);
      if (!over.current) document.body.style.cursor = '';
    },
  };
}

/* ---------- the equalizer ---------- */

function Equalizer({ bars, accent }: { bars: Layout['bars']; accent: string }) {
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const n = bars.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const acc = useMemo(() => new THREE.Color(accent), []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const level = useMemo(() => new Float32Array(n), [n]);
  const hover = useRef(0);
  const hovered = useRef(false);
  const cursor = useCursor();

  useLayoutEffect(() => {
    // give the instanceColor buffer a value so the shader is built with it
    for (let i = 0; i < n * 2; i++) mesh.current.setColorAt(i, PINK);
  }, [n]);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    acc.lerp(target.set(accent), Math.min(1, dt * 2));
    hover.current += ((hovered.current ? 1 : 0) - hover.current) * Math.min(1, dt * 8);
    const drop = Math.max(0, 1 - (t - club.dropAt) / 1.4);
    // a four-on-the-floor kick at 124 bpm
    const beat = Math.pow(1 - ((t * 124) / 60) % 1, 3);
    const m = mesh.current;
    for (let i = 0; i < n; i++) {
      const b = bars[i];
      const k = i % (n / 2);
      // a fake spectrum: low bands near the middle punch with the kick, high ones flicker
      const band = k / (n / 2 - 1);
      const wave = 0.5 + 0.5 * Math.sin(t * (2.2 + band * 5.3) + i * 1.7) * Math.sin(t * (0.9 + band * 1.3) + i);
      let h = 0.18 + wave * (0.55 - band * 0.2) + beat * (0.55 - band * 0.45);
      h += drop * (0.9 + Math.sin(t * 30 + i) * 0.25) * (1 - band * 0.4);
      // a little peak hold so the bars fall slower than they rise
      level[i] = h > level[i] ? h : Math.max(h, level[i] - dt * 1.6);
      const hh = level[i] * (1 + hover.current * 0.25);
      dummy.position.set(b.x, 0, b.z);
      dummy.rotation.set(0, b.x * -0.06, 0);
      dummy.scale.set(0.34, hh, 0.12);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      // the reflection in the floor: the same bar upside down
      dummy.scale.y = -hh * 0.7;
      dummy.updateMatrix();
      m.setMatrixAt(n + i, dummy.matrix);
      // from the accent at the middle to hot pink at the ends; a drop washes them white
      tmp.copy(acc).lerp(PINK, band * 0.85).lerp(CYAN, drop * Math.max(0, Math.sin(t * 18 + i)) * 0.6);
      tmp.multiplyScalar(1 + hover.current * 0.6 + drop * 0.8);
      m.setColorAt(i, tmp);
      tmp.multiplyScalar(0.22);
      m.setColorAt(n + i, tmp);
    }
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[barGeo, undefined, n * 2]}
      frustumCulled={false}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hovered.current = true;
        cursor.enter();
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hovered.current = false;
        cursor.leave();
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        club.dropAt = club.strobeAt = clockTime.current;
      }}
    >
      <meshBasicMaterial toneMapped={false} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
    </instancedMesh>
  );
}

/* ---------- a hologram shape ---------- */

function Holo({ pos, geo, accent, lite, seed }: { pos: [number, number, number]; geo: THREE.BufferGeometry; accent: string; lite: boolean; seed: number }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null!);
  const glow = useRef<THREE.SpriteMaterial>(null!);
  const glowS = useRef<THREE.Sprite>(null!);
  const geos = shapeGeos();
  const hovered = useRef(false);
  const s = useRef({ hover: 0, spin: 0, flash: 0, hue: -1, hueT: 0, clicked: -10 });
  const target = useMemo(() => new THREE.Color(), []);
  const cursor = useCursor();

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const v = s.current;
    v.hover += ((hovered.current ? 1 : 0) - v.hover) * Math.min(1, dt * 8);
    v.spin *= Math.exp(-dt * 1.6);
    v.flash *= Math.exp(-dt * 4);
    v.hueT = Math.max(0, v.hueT - dt);
    // hovering and turning; a click flings it round
    body.current.rotation.y += dt * (0.5 + v.spin * 9 + v.hover * 0.8);
    body.current.rotation.x = Math.sin(t * 0.7 + seed) * 0.35 + v.spin * 0.6;
    g.current.position.y = pos[1] + Math.sin(t * 1.3 + seed) * 0.12;
    const pop = 1 + v.hover * 0.18 + v.flash * 0.25;
    body.current.scale.setScalar(pop);
    // a hologram flicker now and then
    const flick = Math.sin(t * 37 + seed) > 0.96 ? 0.45 : 1;
    // the accent, or for a while after a click a colour of its own
    target.set(v.hueT > 0 ? HUES[v.hue] : accent);
    const k = Math.min(1, dt * (v.hueT > 0 ? 12 : 2));
    mat.current.color.lerp(target, k);

    const bright = (1 + v.hover * 0.7 + v.flash * 1.5) * flick;
    mat.current.opacity = Math.min(1, 0.75 * bright);
    if (!lite) {
      coreMat.current.color.copy(mat.current.color);
      coreMat.current.opacity = 0.35 + v.hover * 0.3 + v.flash * 0.5;
      glow.current.color.copy(mat.current.color);
      glow.current.opacity = (0.32 + v.hover * 0.25 + v.flash * 0.6) * flick;
      glowS.current.scale.setScalar(2.4 * (1 + v.flash * 0.6 + v.hover * 0.15));
    }
  });

  return (
    <group ref={g} position={pos}>
      <group ref={body}>
        <mesh geometry={geo}>
          <meshBasicMaterial ref={mat} color={accent} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {!lite && (
          <mesh geometry={geos.core}>
            <meshBasicMaterial ref={coreMat} color={accent} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        )}
      </group>
      {!lite && (
        <sprite ref={glowS} scale={2.4}>
          <spriteMaterial ref={glow} map={glowTex()} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      )}
      {/* an invisible, generous hit target: thin tubes are hard to point at */}
      <mesh
        geometry={geos.hit}
        visible={false}
        onPointerOver={(e) => {
          e.stopPropagation();
          hovered.current = true;
          cursor.enter();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          hovered.current = false;
          cursor.leave();
        }}
        onClick={(e) => {
          e.stopPropagation();
          const v = s.current;
          v.spin = 1;
          v.flash = 1;
          v.hue = (v.hue + 1 + Math.floor(Math.random() * (HUES.length - 1))) % HUES.length;
          v.hueT = 2.6;
          club.strobeAt = clockTime.current;
        }}
      />
    </group>
  );
}

/* ---------- lasers ---------- */

function Lasers({ lasers, accent, lite }: { lasers: Layout['lasers']; accent: string; lite: boolean }) {
  const beams = useRef<THREE.InstancedMesh>(null!);
  const spots = useRef<THREE.InstancedMesh>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
  const spotMat = useRef<THREE.MeshBasicMaterial>(null!);
  const n = lasers.length;
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const to = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const acc = useMemo(() => new THREE.Color(accent), []); // eslint-disable-line react-hooks/exhaustive-deps
  const target = useMemo(() => new THREE.Color(), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useLayoutEffect(() => {
    for (let i = 0; i < n; i++) {
      beams.current.setColorAt(i, PINK);
      spots.current?.setColorAt(i, PINK);
    }
  }, [n]);

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    clockTime.current = t;
    acc.lerp(target.set(accent), Math.min(1, dt * 2));
    const strobe = Math.max(0, 1 - (t - club.strobeAt) / 1.6);
    const on = strobe > 0 ? (Math.sin(t * 40) > 0 ? 1.8 : 0.25) : 1;
    beamMat.current.opacity = (0.16 + strobe * 0.2) * on;
    if (spotMat.current) spotMat.current.opacity = Math.min(1, 0.7 * on);
    for (let i = 0; i < n; i++) {
      const L = lasers[i];
      const u = 0.5 + 0.5 * Math.sin(t * L.speed * (1 + strobe * 3) + L.phase);
      to.set(L.sweepX[0] + (L.sweepX[1] - L.sweepX[0]) * u, 0, L.z + Math.sin(t * 0.3 + L.phase) * 1.2);
      dir.subVectors(to, L.from);
      const len = dir.length();
      dummy.position.copy(L.from);
      dummy.quaternion.setFromUnitVectors(UP, dir.divideScalar(len));
      dummy.scale.set(0.09 + strobe * 0.05, len, 0.09 + strobe * 0.05);
      dummy.updateMatrix();
      beams.current.setMatrixAt(i, dummy.matrix);
      tmp.copy(i % 2 ? CYAN : PINK).lerp(acc, i < 2 ? 0.5 : 0.15);
      beams.current.setColorAt(i, tmp);
      if (spots.current) {
        dummy.position.set(to.x, 0.015, to.z);
        dummy.quaternion.identity();
        dummy.scale.setScalar(1.1 + Math.sin(t * 9 + i) * 0.15);
        dummy.updateMatrix();
        spots.current.setMatrixAt(i, dummy.matrix);
        spots.current.setColorAt(i, tmp);
      }
    }
    beams.current.instanceMatrix.needsUpdate = true;
    if (beams.current.instanceColor) beams.current.instanceColor.needsUpdate = true;
    if (spots.current) {
      spots.current.instanceMatrix.needsUpdate = true;
      if (spots.current.instanceColor) spots.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={beams} args={[laserGeo, undefined, n]} frustumCulled={false}>
        <meshBasicMaterial ref={beamMat} map={laserTex()} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} fog={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh ref={spots} args={[spotGeo, undefined, n]} frustumCulled={false}>
          <meshBasicMaterial ref={spotMat} map={glowTex()} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </instancedMesh>
      )}
    </>
  );
}

/* ---------- rising neon dust ---------- */

function Dust({ area, count, accent }: { area: Layout['dust']; count: number; accent: string }) {
  const pts = useRef<THREE.Points>(null!);
  const mat = useRef<THREE.PointsMaterial>(null!);
  const target = useMemo(() => new THREE.Color(), []);
  const { geo, speed } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const sp = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const side = i % 2 ? 1 : -1;
      p[i * 3] = side * (area.x[0] + Math.random() * (area.x[1] - area.x[0]));
      p[i * 3 + 1] = Math.random() * 5;
      p[i * 3 + 2] = area.z[0] + Math.random() * (area.z[1] - area.z[0]);
      sp[i] = 0.25 + Math.random() * 0.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    return { geo: g, speed: sp };
  }, [area, count]);
  useEffect(() => () => geo.dispose(), [geo]);

  useFrame((st, dt) => {
    const a = geo.getAttribute('position') as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    for (let i = 0; i < count; i++) {
      let y = arr[i * 3 + 1] + speed[i] * dt;
      if (y > 5) y -= 5;
      arr[i * 3 + 1] = y;
    }
    a.needsUpdate = true;
    mat.current.color.lerp(target.set(accent), Math.min(1, dt * 2));
    mat.current.opacity = 0.75 + Math.sin(st.clock.elapsedTime * 3) * 0.15;
  });

  return (
    <points ref={pts} geometry={geo} frustumCulled={false}>
      <pointsMaterial ref={mat} map={glowTex()} size={0.22} sizeAttenuation transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </points>
  );
}

/** Neon: a club around the table — equalizer, hologram shapes, sweeping lasers and rising dust. */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const L = useMemo(() => layout(portrait, lite), [portrait, lite]);
  const geos = shapeGeos();
  return (
    <>
      <Equalizer bars={L.bars} accent={accent} />
      <Holo pos={L.shapes[0]} geo={geos.ico} accent={accent} lite={lite} seed={0} />
      <Holo pos={L.shapes[1]} geo={geos.gyro} accent={accent} lite={lite} seed={2.4} />
      <Lasers lasers={L.lasers} accent={accent} lite={lite} />
      <Dust area={L.dust} count={lite ? 40 : 110} accent={accent} />
    </>
  );
}
