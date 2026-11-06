import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { drag } from '../cards/drag';

/** While a card is being dragged: a glowing ring on the pile that brightens when the card is over it. */
export function DropZone({ at, radius }: { at: [number, number, number]; radius: number }) {
  const ring = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((st, dt) => {
    const on = drag.id !== null && drag.moved;
    const target = on ? (drag.over ? 0.95 : 0.35 + Math.sin(st.clock.elapsedTime * 6) * 0.12) : 0;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, dt * 12);
    ring.current.visible = mat.current.opacity > 0.01;
    const sc = on && drag.over ? 1.08 : 1;
    ring.current.scale.setScalar(ring.current.scale.x + (sc - ring.current.scale.x) * Math.min(1, dt * 10));
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.01, at[2]]} visible={false}>
      <ringGeometry args={[radius * 0.62, radius * 0.7, 64]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}
