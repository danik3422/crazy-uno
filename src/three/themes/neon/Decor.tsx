import { useFrame, useThree } from '@react-three/fiber';
import { Placer, useHudZones, type Placed } from '../decorKit';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { visibleHalfWidth } from '../../layout/camera';
import type { DecorProps } from '../types';
import { holoGeos } from './geometry';

/*
 * Neon decor. The club itself lives in the floor shader (grid, track, LED equalizer ring, horizon haze),
 * because from this camera every free patch of screen around the table is taken by a player plate or the HUD:
 * the top corners hold the colour badge and the menu, the sides hold the side seats.
 *
 * What stands up is only a pair of wireframe holograms over little projector pads, and only where the screen
 * really has room for them beside the side seats (ultrawide monitors), and on a phone on its side wherever its
 * screen has room left between the plates, the cards and the dock (PhoneHolos). Hover:
 * brighten; click: a spin and a colour of their own for a moment.
 * No glow sprites or soft blobs: thin unlit tubes and rings, so nothing reads as blur.
 * Draw calls: 4 when shown (2 holograms + 2 pads), 0 otherwise; up to 8 on a phone (4 holograms + pads).
 */

const HUES = ['#ff2e9a', '#2ed8ff', '#ffd60a', '#2bff8a', '#a64dff'].map((c) => new THREE.Color(c));

/** the depth the holograms stand at: level with the side seats' cards, below the HUD's top corners */
const HOLO_Z = -0.6;
/** they must clear the side seats: their cards and plates reach about this far from the middle */
const SEAT_CLEAR_X = 8.9;
/** and keep this far inside the screen edge */
const EDGE_MARGIN = 1.0;

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

/* ---------- a hologram over its projector pad ---------- */

function Holo({ pos, geo, accent, lite, seed, s: size = 1 }: { pos: [number, number, number]; geo: THREE.BufferGeometry; accent: string; lite: boolean; seed: number; s?: number }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const padMat = useRef<THREE.MeshBasicMaterial>(null!);
  const geos = holoGeos();
  const hovered = useRef(false);
  const s = useRef({ hover: 0, spin: 0, flash: 0, hue: -1, hueT: 0 });
  const target = useMemo(() => new THREE.Color(), []);
  const cursor = useCursor();

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const v = s.current;
    v.hover += ((hovered.current ? 1 : 0) - v.hover) * Math.min(1, dt * 8);
    v.spin *= Math.exp(-dt * 1.6);
    v.flash *= Math.exp(-dt * 4);
    v.hueT = Math.max(0, v.hueT - dt);
    // a slow, steady turn and a gentle bob; a click flings it round
    body.current.rotation.y += dt * (0.45 + v.spin * 8 + v.hover * 0.6);
    body.current.rotation.x = Math.sin(t * 0.5 + seed) * 0.25 + v.spin * 0.5;
    g.current.position.y = (pos[1] + Math.sin(t * 1.1 + seed) * 0.08) / size;
    body.current.scale.setScalar(1 + v.hover * 0.12 + v.flash * 0.2);
    // the accent, or for a while after a click a colour of its own
    target.set(v.hueT > 0 ? HUES[v.hue] : accent);
    mat.current.color.lerp(target, Math.min(1, dt * (v.hueT > 0 ? 12 : 2)));
    mat.current.opacity = Math.min(1, 0.8 + v.hover * 0.2 + v.flash * 0.4);
    if (!lite) {
      padMat.current.color.copy(mat.current.color);
      padMat.current.opacity = 0.55 + v.hover * 0.3 + v.flash * 0.45;
    }
  });

  return (
    <group position={[pos[0], 0, pos[2]]} scale={size}>
      <group ref={g} position={[0, pos[1], 0]}>
        <group ref={body}>
          <mesh geometry={geo}>
            <meshBasicMaterial ref={mat} color={accent} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      </group>
      {!lite && (
        <mesh geometry={geos.pad} position-y={0.012}>
          <meshBasicMaterial ref={padMat} color={accent} toneMapped={false} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      )}
      {/* an invisible, generous hit target: thin tubes are hard to point at */}
      <mesh
        geometry={geos.hit}
        position-y={pos[1] / size}
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
        }}
      />
    </group>
  );
}

/** Neon: wireframe holograms beside the side seats, on screens wide enough to hold them. */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  // a phone on its side: the holograms go wherever its screen has room
  if (lite && !portrait) return <PhoneHolos accent={accent} />;
  // the outermost spot that still sits a margin inside the screen edge; none when that would crowd a seat
  const x = portrait ? 0 : visibleHalfWidth({ portrait, aspect }, 0.85, HOLO_Z) - EDGE_MARGIN;
  if (lite || portrait || x < SEAT_CLEAR_X) return null;
  const geos = holoGeos();
  const hx = Math.min(x, 11.5);
  return (
    <group name="decor">
      <Holo pos={[-hx, 0.85, HOLO_Z]} geo={geos.ico} accent={accent} lite={lite} seed={0} />
      <Holo pos={[hx, 0.85, HOLO_Z]} geo={geos.gyro} accent={accent} lite={lite} seed={2.4} />
    </group>
  );
}

/** how many holograms a phone may show, and their size at scale 1 as a ball round their middle */
const PHONE_HOLOS = 4;
const HOLO_BALL = { r: 0.7, y: 0.85, rx: 0.75 };

/**
 * A phone on its side: up to four holograms (with their projector pads) in the room its screen has left, the side
 * strips beside and between the side players first, then the band past the far ones (see Placer). Redone only when
 * the HUD or the cards move; a hologram stays where it is while that spot is still clear.
 * Draw calls: 2 per hologram shown (8 at most).
 */
function PhoneHolos({ accent }: { accent: string }) {
  const hud = useHudZones();
  const [spots, setSpots] = useState<Placed[]>([]);
  const fitted = useRef({ version: -1, w: 0, h: 0, key: '' });
  useFrame((st) => {
    const zones = hud.current;
    const { width: w, height: h } = st.size;
    const f = fitted.current;
    if (f.version === zones.version && f.w === w && f.h === h) return;
    f.version = zones.version;
    f.w = w;
    f.h = h;
    if (!zones.view.compact) {
      if (f.key !== '') { f.key = ''; setSpots([]); }
      return;
    }
    const P = new Placer(w, h, zones);
    const near = [-1, 1].flatMap((side) => [...P.side(side, [-2.5, -1, -4, 0.5, -5.5, 2, 3, 4], [1.4, 2.2, 0.9, 3, 4]), ...P.strip(side)]);
    const far = [-10, 10, -7.5, 7.5, -12.5, 12.5, -5, 5].flatMap((x) => [-10.5, -8.5].map((z) => ({ x, z })));
    const out: Placed[] = [];
    for (let i = 0; i < PHONE_HOLOS; i++) {
      const side = i % 2 ? 1 : -1;
      const order = [...near.filter((p) => Math.sign(p.x) === side), ...far.filter((p) => Math.sign(p.x) === side), ...near, ...far];
      const p = P.place(order, HOLO_BALL, { maxPx: 0.09 * h, minPx: 0.035 * h, onScreen: 0.95, maxScale: 1.2 }, spots[i]);
      if (p) out.push(p);
    }
    const key = JSON.stringify(out);
    if (key !== f.key) {
      f.key = key;
      setSpots(out);
    }
  });
  const geos = holoGeos();
  return (
    <group name="decor">
      {spots.map((p, i) => (
        <Holo key={i} pos={[p.x, HOLO_BALL.y * p.s, p.z]} s={p.s} geo={i % 2 ? geos.gyro : geos.ico} accent={accent} lite={false} seed={i * 2.4} />
      ))}
    </group>
  );
}
