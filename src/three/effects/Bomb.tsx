import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/**
 * The ticking bomb over the table while a bomb countdown runs (`deadline`, server ms; null: no bomb).
 * Always mounted with its light, which only dims to 0: adding or removing a light makes three.js
 * recompile every lit material on screen, a visible stall.
 */
export function Bomb({ deadline, offset }: { deadline: number | null; offset: number }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(st => {
    body.current.visible = deadline !== null;
    if (deadline === null) {
      light.current.intensity = 0;
      return;
    }
    const t = st.clock.elapsedTime;
    const left = Math.max(0, (deadline - Date.now() - offset) / 1000);
    const panic = left < 3 ? 3 : 1;
    g.current.position.y = 1.4 + Math.sin(t * 3 * panic) * 0.12;
    g.current.rotation.z = Math.sin(t * 8 * panic) * 0.08 * panic;
    const f = 0.7 + Math.random() * 0.6;
    spark.current.scale.setScalar(f);
    light.current.intensity = 6 * f;
  });
  return (
    <group ref={g} position={[0, 1.4, 2.2]}>
      <group ref={body} visible={false}>
        <mesh castShadow>
          <sphereGeometry args={[0.42, 32, 24]} />
          <meshStandardMaterial color="#1b1b20" roughness={0.3} metalness={0.4} />
        </mesh>
        <mesh position={[0.22, 0.36, 0]} rotation-z={-0.6}>
          <cylinderGeometry args={[0.1, 0.12, 0.16, 16]} />
          <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0.36, 0.52, 0]} rotation-z={-0.8}>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
          <meshStandardMaterial color="#c9a46a" />
        </mesh>
        <mesh ref={spark} position={[0.47, 0.63, 0]}>
          <sphereGeometry args={[0.07, 12, 8]} />
          <meshBasicMaterial color="#ffcf4a" toneMapped={false} />
        </mesh>
      </group>
      <pointLight ref={light} position={[0.47, 0.63, 0.1]} color="#ff9a3c" distance={4} intensity={0} />
    </group>
  );
}
