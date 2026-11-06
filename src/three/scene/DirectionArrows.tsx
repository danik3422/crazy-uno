import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fxState, nowSec } from '../effects/fxState';
import { RING_R, RING_Z } from '../layout';

/** Two big glowing arrows sweeping around the pile in the direction of play. */
/**
 * One arrow of the direction ring, flat on the table: a band along the circle that ends in a broad,
 * sharp head. Built in the ring's own plane (XY), so the squash of the ring keeps it a clean shape.
 */
function ringArrowGeometry(R: number, arc: number, w = 0.15, headW = 0.4, headLenAbs = 0.62) {
  const headLen = headLenAbs / R; // in radians
  const s = new THREE.Shape();
  const steps = 40;
  const end = arc - headLen;
  const at = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  // outer edge forward, head, inner edge back
  s.moveTo(at(R + w, 0).x, at(R + w, 0).y);
  for (let i = 1; i <= steps; i++) {
    const p = at(R + w, (end * i) / steps);
    s.lineTo(p.x, p.y);
  }
  const o = at(R + headW, end);
  const tip = at(R, arc);
  const inn = at(R - headW, end);
  s.lineTo(o.x, o.y);
  s.lineTo(tip.x, tip.y);
  s.lineTo(inn.x, inn.y);
  for (let i = steps; i >= 0; i--) {
    const p = at(R - w, (end * i) / steps);
    s.lineTo(p.x, p.y);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * The ring of arrows around the pile that shows which way the turn goes. It drifts slowly that way;
 * on a reverse the arrows fold over and come back pointing the other way, with a brief flash.
 */
export function DirectionArrows({ dir, at }: { dir: 1 | -1; at: [number, number, number] }) {
  const spin = useRef<THREE.Group>(null!);
  const flipG = useRef<THREE.Group>(null!);
  const R = RING_R;
  const ARC = 1.9;
  const geo = useMemo(() => ringArrowGeometry(R, ARC), [R]);
  // a wider, faint copy under each arrow: a soft halo, so the arrows glow on the floor
  const haloGeo = useMemo(() => ringArrowGeometry(R, ARC + 0.04, 0.34, 0.64, 0.78), [R]);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );
  const halo = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.22, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const speed = useRef(0);
  const flip = useRef<{ from: number; to: number; t0: number } | null>(null);
  const shown = useRef<number>(dir);
  useEffect(() => {
    if (dir === shown.current && !flip.current) return;
    flip.current = { from: flipG.current ? flipG.current.scale.y : shown.current, to: dir, t0: nowSec() };
    shown.current = dir;
  }, [dir]);
  useFrame((_, dt) => {
    const now = nowSec();
    const racing = now < fxState.carouselUntil;
    speed.current += (dir * (racing ? 7 : 0.7) - speed.current) * Math.min(1, dt * (racing ? 6 : 2));
    spin.current.rotation.y -= speed.current * dt;
    let pulse = 0;
    const f = flip.current;
    if (f) {
      const p = Math.min(1, (now - f.t0) / 0.55);
      flipG.current.scale.y = f.from + (f.to - f.from) * easeInOutCubic(p);
      pulse = Math.sin(Math.PI * p);
      if (p >= 1) flip.current = null;
    } else flipG.current.scale.y = dir;
    mat.opacity = 0.8 + pulse * 0.2;
    halo.opacity = 0.2 + pulse * 0.35;
  });
  return (
    <group position={[at[0], 0.035, at[2]]} scale={[1, 1, RING_Z]}>
      <group ref={spin}>
        {/* the shape lies in XY; +90° about X maps its angles onto the seat angles (x = cos a, z = sin a) */}
        <group ref={flipG} rotation-x={Math.PI / 2} scale={[1, dir, 1]}>
          {[0, 1].map(k => (
            <group key={k} rotation-z={k * Math.PI}>
              <mesh geometry={haloGeo} material={halo} position-z={0.004} />
              <mesh geometry={geo} material={mat} />
            </group>
          ))}
        </group>
      </group>
    </group>
  );
}
