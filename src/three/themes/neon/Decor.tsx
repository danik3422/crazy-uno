import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
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
 * really has room for them beside the side seats (ultrawide monitors; never on phones, whose bigger plates
 * fill the edges). Hover:
 * brighten; click: a spin and a colour of their own for a moment.
 * No glow sprites or soft blobs: thin unlit tubes and rings, so nothing reads as blur.
 * Draw calls: 4 when shown (2 holograms + 2 pads), 0 otherwise (always 0 on lite).
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

function Holo({ pos, geo, accent, lite, seed }: { pos: [number, number, number]; geo: THREE.BufferGeometry; accent: string; lite: boolean; seed: number }) {
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
    g.current.position.y = pos[1] + Math.sin(t * 1.1 + seed) * 0.08;
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
    <group position={[pos[0], 0, pos[2]]}>
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
        position-y={pos[1]}
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
