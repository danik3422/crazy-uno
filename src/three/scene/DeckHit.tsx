import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

export function DeckHit({ active, onClick, pending, at }: { active: boolean; onClick: () => void; pending: number; at: [number, number, number] }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(st => {
    ring.current.opacity = active ? 0.55 + Math.sin(st.clock.elapsedTime * 5) * 0.3 : 0;
  });
  return (
    <group position={at}>
      <mesh
        position-y={0.4}
        visible={false}
        onClick={e => { if (!active) return; e.stopPropagation(); onClick(); }}
        onPointerOver={() => { if (active) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[1.5, 1, 1.9]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
        <ringGeometry args={[0.92, 1.04, 48]} />
        <meshBasicMaterial ref={ring} color={pending ? '#ff6b5e' : '#ffffff'} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}
