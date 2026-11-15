import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/*
 * The stamp meme: a little grey warship going down stern first into a slab of blue sea on the roof,
 * rocking as it goes, bubbles coming up behind it.
 */

const ROOF = 1.44;
const SEA = ROOF + 0.16;
const PI = Math.PI;
/** choppy lumps on the sea: [x, z, size] */
const CHOP: [number, number, number][] = [
  [-0.55, 0.3, 0.16],
  [-0.4, -0.3, 0.13],
  [-0.1, 0.33, 0.12],
  [0.85, 0.28, 0.15],
  [0.95, -0.3, 0.14],
  [0.5, -0.35, 0.11],
  [1.02, 0.02, 0.12],
];
const BUBBLES = 4;

export function ShipRoof() {
  const ship = useRef<THREE.Group>(null!);
  const bubbles = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    ship.current.rotation.z = -0.36 + Math.sin(t * 1.1) * 0.05;
    ship.current.rotation.x = Math.sin(t * 0.8) * 0.07;
    ship.current.position.y = SEA - 0.02 + Math.sin(t * 1.4) * 0.015;
    bubbles.current.children.forEach((b, i) => {
      const q = (t * 0.7 + i / BUBBLES) % 1;
      b.position.set(0.55 + Math.sin(i * 2.7) * 0.12 + Math.sin(q * 9 + i) * 0.02, SEA + q * 0.4, Math.cos(i * 1.9) * 0.12);
      const s = (0.5 + q) * (q > 0.92 ? (1 - q) / 0.08 : 1);
      b.scale.set(s, s, s);
    });
  });
  const grey = <meshStandardMaterial color="#7f8995" roughness={0.55} metalness={0.25} />;
  const dark = <meshStandardMaterial color="#4a515b" roughness={0.6} metalness={0.2} />;
  return (
    <group>
      {/* the sea: a blue slab with lighter chop, and foam where the ship goes in */}
      <RoundedBox args={[1.9, 0.16, 0.96]} radius={0.06} smoothness={2} position={[0.25, ROOF + 0.08, 0]}>
        <meshStandardMaterial color="#2a7fd4" roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {CHOP.map(([x, z, s], i) => (
        <mesh key={i} position={[x, SEA, z]} scale={[s * 1.4, s * 0.45, s]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={i % 2 ? '#5fb2f0' : '#8fcaf5'} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0.32, SEA + 0.004, 0]} rotation-x={-PI / 2} scale={[0.55, 0.26, 1]}>
        <ringGeometry args={[0.75, 1, 28]} />
        <meshStandardMaterial color="#f2fbff" roughness={0.6} />
      </mesh>
      {/* the ship, bow up (the bow points forward, to -x) */}
      <group ref={ship} position={[0.25, SEA, 0]}>
        <mesh position={[0.05, 0.05, 0]} castShadow>
          <boxGeometry args={[0.9, 0.2, 0.28]} />
          {grey}
        </mesh>
        <mesh position={[-0.4, 0.05, 0]} rotation-y={PI / 4} scale={[1, 1, 1]}>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          {grey}
        </mesh>
        <mesh position={[-0.05, 0.155, 0]}>
          <boxGeometry args={[1.0, 0.02, 0.26]} />
          {dark}
        </mesh>
        <mesh position={[-0.08, 0.04, 0.142]}>
          <boxGeometry args={[0.6, 0.025, 0.004]} />
          <meshStandardMaterial color="#b8343a" roughness={0.6} />
        </mesh>
        {/* superstructure, bridge with its dark windows, mast and funnel */}
        <mesh position={[0.05, 0.25, 0]} castShadow>
          <boxGeometry args={[0.34, 0.17, 0.2]} />
          {grey}
        </mesh>
        <mesh position={[-0.04, 0.38, 0]}>
          <boxGeometry args={[0.17, 0.1, 0.18]} />
          {grey}
        </mesh>
        <mesh position={[-0.04, 0.39, 0]}>
          <boxGeometry args={[0.175, 0.03, 0.185]} />
          <meshStandardMaterial color="#1b2228" roughness={0.3} />
        </mesh>
        <mesh position={[0.0, 0.57, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.3, 6]} />
          {dark}
        </mesh>
        <mesh position={[0.0, 0.64, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.18]} />
          {dark}
        </mesh>
        <mesh position={[0.18, 0.39, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.14, 10]} />
          {dark}
        </mesh>
        {/* two turrets, guns fore and aft */}
        {[-1, 1].map(s => (
          <group key={s} position={[s > 0 ? 0.33 : -0.28, 0.19, 0]}>
            <mesh>
              <cylinderGeometry args={[0.065, 0.075, 0.06, 10]} />
              {grey}
            </mesh>
            <mesh position={[s * 0.11, 0.01, 0]} rotation-z={PI / 2}>
              <cylinderGeometry args={[0.012, 0.012, 0.18, 6]} />
              {dark}
            </mesh>
          </group>
        ))}
      </group>
      {/* bubbles coming up behind it */}
      <group ref={bubbles}>
        {Array.from({ length: BUBBLES }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#e8f6ff" roughness={0.15} transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
