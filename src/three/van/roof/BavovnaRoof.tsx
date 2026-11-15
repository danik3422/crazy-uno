import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * «Бавовна» (cotton: the meme word for a loud bang far away): a crate on the roof heaped with cotton bolls,
 * bobbing softly, and now and then a puff rising off the heap with a warm flash in it.
 */

const ROOF = 1.44;
const PI = Math.PI;

/** where the bolls sit: higher in the middle of the heap; [x, y above the roof, z, tilt] */
const BOLLS: [number, number, number, number][] = [
  [-0.55, 0.3, 0.22, 0.4],
  [-0.5, 0.28, -0.24, -0.3],
  [-0.12, 0.42, 0.05, 0.1],
  [0.1, 0.33, 0.3, 0.5],
  [0.2, 0.34, -0.28, -0.45],
  [0.42, 0.45, 0.02, -0.1],
  [0.72, 0.32, 0.25, 0.35],
  [0.78, 0.3, -0.22, -0.3],
  [1.05, 0.27, 0.0, 0.2],
];
const PUFFS = 3;
const PUFF_T = 3.2;

/** a cotton boll's fluff: five soft lobes around a sixth on top */
function makeFluff() {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * PI * 2;
    const s = new THREE.SphereGeometry(0.078, 10, 8);
    s.translate(Math.cos(a) * 0.065, 0.03, Math.sin(a) * 0.065);
    parts.push(s);
  }
  const top = new THREE.SphereGeometry(0.08, 10, 8);
  top.translate(0, 0.085, 0);
  parts.push(top);
  const g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return g;
}

export function BavovnaRoof() {
  const fluff = useMemo(makeFluff, []);
  useEffect(() => () => fluff.dispose(), [fluff]);
  const bolls = useRef<THREE.Group>(null!);
  const puffs = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    bolls.current.children.forEach((b, i) => {
      const base = BOLLS[i];
      b.position.y = ROOF + base[1] + Math.sin(t * 1.7 + i * 1.3) * 0.018;
      const sq = 1 + Math.sin(t * 2.3 + i) * 0.04;
      b.scale.set(sq, 2 - sq, sq);
    });
    puffs.current.children.forEach((p, i) => {
      const q = ((t / PUFF_T + i / PUFFS) % 1 + 1) % 1;
      const m = (p as THREE.Mesh).material as THREE.MeshStandardMaterial;
      p.position.set(-0.3 + i * 0.55 + Math.sin(q * 5 + i) * 0.05, ROOF + 0.5 + q * 0.75, Math.sin(i * 2.1) * 0.15);
      const s = 0.6 + q * 1.2;
      p.scale.set(s, s, s);
      m.opacity = q < 0.12 ? q / 0.12 : 1 - (q - 0.12) / 0.88;
      m.emissiveIntensity = Math.max(0, 1 - q * 3.5) * 0.9;
    });
  });
  const wood = <meshStandardMaterial color="#9a6b3e" roughness={0.9} />;
  const cotton = <meshStandardMaterial color="#fbfaf4" roughness={1} />;
  return (
    <group>
      {/* a low wooden crate */}
      <mesh position={[0.25, ROOF + 0.03, 0]}>
        <boxGeometry args={[1.95, 0.05, 0.98]} />
        {wood}
      </mesh>
      {[0.48, -0.48].map(z => (
        <mesh key={z} position={[0.25, ROOF + 0.1, z]}>
          <boxGeometry args={[1.95, 0.12, 0.04]} />
          {wood}
        </mesh>
      ))}
      {[-0.7, 1.2].map(x => (
        <mesh key={x} position={[x, ROOF + 0.1, 0]}>
          <boxGeometry args={[0.04, 0.12, 0.98]} />
          {wood}
        </mesh>
      ))}
      {/* the heap: a soft white mound */}
      <mesh position={[0.25, ROOF + 0.1, 0]} scale={[0.92, 0.22, 0.44]} castShadow>
        <sphereGeometry args={[1, 20, 12]} />
        {cotton}
      </mesh>
      {/* two dry stems sticking out */}
      {[[-0.3, -0.35, 0.5], [0.95, 0.3, -0.6]].map(([x, z, r]) => (
        <mesh key={x} position={[x, ROOF + 0.35, z]} rotation={[r * 0.5, 0, r]}>
          <cylinderGeometry args={[0.012, 0.018, 0.5, 5]} />
          <meshStandardMaterial color="#6a5a2c" roughness={0.9} />
        </mesh>
      ))}
      {/* the bolls: fluff on a brown star of a husk, on a short green-brown stalk */}
      <group ref={bolls}>
        {BOLLS.map(([x, y, z, tilt], i) => (
          <group key={i} position={[x, ROOF + y, z]} rotation={[tilt * 0.6, i, tilt * 0.4]}>
            <mesh position-y={-0.1}>
              <cylinderGeometry args={[0.012, 0.016, 0.14, 5]} />
              <meshStandardMaterial color="#5f6b2a" roughness={0.9} />
            </mesh>
            <mesh position-y={-0.015} rotation-x={PI}>
              <coneGeometry args={[0.13, 0.08, 5]} />
              <meshStandardMaterial color="#6b4527" roughness={0.9} flatShading />
            </mesh>
            <mesh geometry={fluff} castShadow>
              {cotton}
            </mesh>
          </group>
        ))}
      </group>
      {/* puffs rising off the heap */}
      <group ref={puffs}>
        {Array.from({ length: PUFFS }, (_, i) => (
          <mesh key={i} geometry={fluff}>
            <meshStandardMaterial color="#ffffff" emissive="#ff7a1a" roughness={1} transparent depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
