import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../../game/view';
import { arena, oppWall, type View } from '../layout';

let glowTex: THREE.CanvasTexture | null = null;
/** A soft round glow that fades to nothing at the edge (no hard ellipse on the floor). */
function softGlow() {
  if (glowTex) return glowTex;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,240,190,0.9)');
  g.addColorStop(0.45, 'rgba(255,220,140,0.35)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Whose turn it is: a soft pool of light under them and a thin ring of light dashes going round. */
export function TurnMarker({ game, view, version }: { game: GameView; view: View; version: number }) {
  const ref = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const s = game.s;
  const seat = game.seat();
  const target = useMemo(() => {
    const A = arena(view);
    if (s.cur === seat) return new THREE.Vector3(0, 0.012, A.hand.z - 0.9);
    const w = oppWall(game, s.cur, view);
    return new THREE.Vector3(w.pos[0], 0.012, w.pos[2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version: the game changed in place
  }, [version, view]);
  const mine = s.cur === seat;
  useFrame((st, dt) => {
    ref.current.position.lerp(target, 1 - Math.exp(-dt * 6));
    const k = 1 - Math.exp(-dt * 8);
    const show = s.phase === 'over' ? 0 : 1;
    const breathe = 0.5 + Math.sin(st.clock.elapsedTime * 2.4) * 0.5;
    glow.current.opacity += ((mine ? 0.42 : 0.55) * show * (0.75 + breathe * 0.25) - glow.current.opacity) * k;
    ringMat.current.opacity += (0.5 * show - ringMat.current.opacity) * k;
    ring.current.rotation.z -= dt * 0.6;
    const sc = mine ? 1.35 : 1;
    ref.current.scale.x += (sc * 1.7 - ref.current.scale.x) * k;
    ref.current.scale.z += (sc - ref.current.scale.z) * k;
  });
  return (
    <group ref={ref} scale={[1.7, 1, 1]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial ref={glow} map={softGlow()} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[1.02, 1.07, 64, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial ref={ringMat} color="#fff6d0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
