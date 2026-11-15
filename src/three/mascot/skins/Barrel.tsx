import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';

const PI = Math.PI;

/** The barrel plane: a blue-and-yellow barrel with plank wings, a propeller and a cartoon pilot. */
export function BarrelPlane({ prop }: { prop: RefObject<THREE.Group> }) {
  const scarf = useRef<THREE.Mesh>(null!);
  useFrame(st => {
    scarf.current.rotation.x = -0.5 + Math.sin(st.clock.elapsedTime * 18) * 0.25;
  });
  const half = (start: number) => {
    const g = new THREE.CylinderGeometry(0.42, 0.42, 1.25, 28, 1, true, start, PI);
    g.rotateX(PI / 2);
    return g;
  };
  const top = useMemo(() => half(PI / 2), []);
  const bottom = useMemo(() => half(-PI / 2), []);
  const blade = <boxGeometry args={[0.09, 1.15, 0.03]} />;

  return (
    <group>
      {/* barrel body */}
      <mesh geometry={top} castShadow>
        <meshStandardMaterial color="#2f6bd8" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={bottom} castShadow>
        <meshStandardMaterial color="#f5c518" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {[0.625, -0.625].map(z => (
        <group key={z} position-z={z}>
          <mesh rotation-y={z > 0 ? 0 : PI}>
            <circleGeometry args={[0.42, 28]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.42, 0.035, 8, 32]} />
            <meshStandardMaterial color="#3a3f48" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {[0.25, -0.25].map(z => (
        <mesh key={z} position-z={z}>
          <torusGeometry args={[0.425, 0.02, 6, 32]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* plank wings with struts */}
      <mesh position={[0, 0.32, 0.12]} castShadow>
        <boxGeometry args={[3, 0.06, 0.55]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.8} />
      </mesh>
      {[-1.1, 1.1].map(x => (
        <mesh key={x} position={[x * 0.55, 0.12, 0.12]} rotation-z={x > 0 ? -0.5 : 0.5}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          <meshStandardMaterial color="#555b66" metalness={0.6} />
        </mesh>
      ))}

      {/* tail */}
      <mesh position={[0, 0.5, -0.78]} rotation-x={-0.25} castShadow>
        <boxGeometry args={[0.05, 0.75, 0.45]} />
        <meshStandardMaterial color="#141414" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, -0.8]}>
        <boxGeometry args={[1.05, 0.04, 0.3]} />
        <meshStandardMaterial color="#141414" roughness={0.5} />
      </mesh>

      {/* propeller */}
      <mesh position-z={0.7} rotation-x={PI / 2}>
        <coneGeometry args={[0.1, 0.22, 16]} />
        <meshStandardMaterial color="#d8dbe2" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={prop} position-z={0.74}>
        <mesh>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
        <mesh rotation-z={PI / 2}>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
      </group>

      {/* skids like a sled */}
      {[-0.36, 0.36].map(x => (
        <group key={x}>
          <mesh position={[x, -0.78, 0.05]}>
            <boxGeometry args={[0.06, 0.05, 1.7]} />
            <meshStandardMaterial color="#d9d4c7" roughness={0.7} />
          </mesh>
          {[0.45, -0.35].map(z => (
            <mesh key={z} position={[x * 0.8, -0.56, z]} rotation-z={x > 0 ? 0.25 : -0.25}>
              <cylinderGeometry args={[0.022, 0.022, 0.45, 6]} />
              <meshStandardMaterial color="#555b66" metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* cartoon pilot: leather cap, big goggles, wide grin */}
      <group position={[0, 0.38, -0.2]}>
        <mesh position-y={0.12}>
          <cylinderGeometry args={[0.2, 0.24, 0.3, 16]} />
          <meshStandardMaterial color="#7a5232" roughness={0.8} />
        </mesh>
        <mesh ref={scarf} position={[0.08, 0.26, -0.2]}>
          <boxGeometry args={[0.1, 0.03, 0.45]} />
          <meshStandardMaterial color="#e5413a" />
        </mesh>
        <mesh position-y={0.46} castShadow>
          <sphereGeometry args={[0.21, 24, 18]} />
          <meshStandardMaterial color="#f2c597" roughness={0.7} />
        </mesh>
        <mesh position-y={0.49}>
          <sphereGeometry args={[0.225, 24, 12, 0, PI * 2, 0, PI / 2.1]} />
          <meshStandardMaterial color="#6b3f1e" roughness={0.6} />
        </mesh>
        {[-0.08, 0.08].map(x => (
          <group key={x} position={[x, 0.55, 0.17]}>
            <mesh>
              <torusGeometry args={[0.065, 0.022, 8, 20]} />
              <meshStandardMaterial color="#3a3f48" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.055, 16]} />
              <meshStandardMaterial color="#8fe3ff" emissive="#2fa8e0" emissiveIntensity={0.5} metalness={0.3} roughness={0.1} />
            </mesh>
          </group>
        ))}
        {[-0.07, 0.07].map(x => (
          <mesh key={x} position={[x, 0.45, 0.19]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        ))}
        <mesh position={[0, 0.38, 0.17]} rotation-z={PI}>
          <torusGeometry args={[0.07, 0.016, 6, 16, PI]} />
          <meshStandardMaterial color="#8a2a1a" />
        </mesh>
      </group>
    </group>
  );
}
