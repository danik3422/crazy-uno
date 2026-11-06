import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { fxState, nowSec } from './fxState';

export function Explosion() {
  const m = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const t = nowSec() - fxState.boomAt;
    const on = t >= 0 && t < 0.7;
    m.current.visible = on;
    light.current.intensity = on ? 60 * (1 - t / 0.7) : 0;
    if (on) {
      m.current.scale.setScalar(0.3 + t * 9);
      mat.current.opacity = 1 - t / 0.7;
    }
  });
  return (
    <group position={[0, 1.4, 2.2]}>
      <mesh ref={m}>
        <sphereGeometry args={[0.5, 24, 16]} />
        <meshBasicMaterial ref={mat} color="#ff8a2a" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#ff7a2a" distance={14} />
    </group>
  );
}
