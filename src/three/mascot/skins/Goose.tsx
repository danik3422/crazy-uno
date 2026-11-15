import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';

const PI = Math.PI;
const WHITE = '#f7f5ef';
const ORANGE = '#ff8a1e';
const OLIVE = '#5d6338';

/** One wing: a long flat feathered oval with grey tips and a blue-and-yellow armband near the shoulder. */
function Wing({ side, wing }: { side: 1 | -1; wing: RefObject<THREE.Group> }) {
  return (
    <group ref={wing} position={[side * 0.34, 0.14, 0.02]}>
      <mesh position-x={side * 0.62} scale={[0.66, 0.07, 0.3]} castShadow>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial color={WHITE} roughness={0.75} />
      </mesh>
      <mesh position={[side * 1.05, -0.01, -0.06]} scale={[0.3, 0.06, 0.2]}>
        <sphereGeometry args={[1, 14, 10]} />
        <meshStandardMaterial color="#b9c0ca" roughness={0.8} />
      </mesh>
      {/* the armband: a blue and a yellow stripe wrapped round the wing */}
      <mesh position-x={side * 0.24}>
        <boxGeometry args={[0.08, 0.16, 0.5]} />
        <meshStandardMaterial color="#2f6bd8" roughness={0.5} />
      </mesh>
      <mesh position-x={side * 0.32}>
        <boxGeometry args={[0.08, 0.16, 0.48]} />
        <meshStandardMaterial color="#f5c518" roughness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * The combat goose: a chunky white goose in a little olive helmet with aviator goggles, flapping hard,
 * with a beanie-copter on the helmet (that is the spinning `prop`) and an armband on each wing.
 */
export function Goose({ prop }: { prop: RefObject<THREE.Group> }) {
  const left = useRef<THREE.Group>(null!);
  const right = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    const flap = Math.sin(t * 9) * 0.5 + 0.1;
    left.current.rotation.z = -flap;
    right.current.rotation.z = flap;
    head.current.rotation.x = Math.sin(t * 9 + 1) * 0.04;
  });
  const blade = <boxGeometry args={[0.95, 0.09, 0.025]} />;

  return (
    <group position-y={-0.05}>
      {/* body, tail, neck */}
      <mesh scale={[0.46, 0.4, 0.68]} rotation-x={-0.08} castShadow>
        <sphereGeometry args={[1, 28, 20]} />
        <meshStandardMaterial color={WHITE} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.12, -0.66]} rotation-x={-1.15} scale={[1, 1, 0.45]}>
        <coneGeometry args={[0.22, 0.38, 14]} />
        <meshStandardMaterial color={WHITE} roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.42, 0.5]} rotation-x={0.42} castShadow>
        <capsuleGeometry args={[0.135, 0.42, 6, 16]} />
        <meshStandardMaterial color={WHITE} roughness={0.75} />
      </mesh>

      <Wing side={1} wing={left} />
      <Wing side={-1} wing={right} />

      {/* legs and webbed feet, tucked back in flight */}
      {[-0.17, 0.17].map(x => (
        <group key={x}>
          <mesh position={[x, -0.36, -0.28]} rotation-x={-0.9}>
            <cylinderGeometry args={[0.035, 0.035, 0.26, 6]} />
            <meshStandardMaterial color={ORANGE} roughness={0.6} />
          </mesh>
          <mesh position={[x, -0.45, -0.5]} rotation-x={PI / 2 + 0.25} scale={[1, 1, 0.25]}>
            <coneGeometry args={[0.15, 0.28, 3]} />
            <meshStandardMaterial color={ORANGE} roughness={0.6} />
          </mesh>
        </group>
      ))}

      {/* head: beak, eyes, helmet, goggles, beanie-copter */}
      <group ref={head} position={[0, 0.86, 0.66]}>
        <mesh castShadow>
          <sphereGeometry args={[0.22, 24, 18]} />
          <meshStandardMaterial color={WHITE} roughness={0.75} />
        </mesh>
        <mesh position={[0, -0.05, 0.31]} rotation-x={PI / 2} scale={[1.3, 1, 0.6]}>
          <coneGeometry args={[0.12, 0.36, 14]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        <mesh position={[0, -0.04, 0.18]} scale={[1.25, 0.75, 0.7]}>
          <sphereGeometry args={[0.12, 14, 10]} />
          <meshStandardMaterial color={ORANGE} roughness={0.5} />
        </mesh>
        {[-1, 1].map(s => (
          <group key={s} position={[s * 0.12, 0.02, 0.16]}>
            <mesh>
              <sphereGeometry args={[0.058, 12, 10]} />
              <meshStandardMaterial color="#ffffff" roughness={0.4} />
            </mesh>
            <mesh position={[s * 0.008, 0, 0.042]}>
              <sphereGeometry args={[0.03, 10, 8]} />
              <meshStandardMaterial color="#141414" roughness={0.3} />
            </mesh>
            {/* a stern brow: this goose means business */}
            <mesh position={[0, 0.07, 0.03]} rotation-z={s * -0.45}>
              <boxGeometry args={[0.1, 0.022, 0.03]} />
              <meshStandardMaterial color="#141414" />
            </mesh>
          </group>
        ))}
        <mesh position-y={0.08}>
          <sphereGeometry args={[0.24, 24, 12, 0, PI * 2, 0, PI / 2]} />
          <meshStandardMaterial color={OLIVE} roughness={0.7} />
        </mesh>
        <mesh position-y={0.08} rotation-x={PI / 2}>
          <torusGeometry args={[0.245, 0.03, 8, 28]} />
          <meshStandardMaterial color="#4a4f2c" roughness={0.7} />
        </mesh>
        {/* aviator goggles pushed up onto the helmet */}
        {[-0.085, 0.085].map(x => (
          <group key={x} position={[x, 0.2, 0.17]} rotation-x={-0.55}>
            <mesh>
              <torusGeometry args={[0.06, 0.02, 8, 18]} />
              <meshStandardMaterial color="#7a5232" roughness={0.6} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.05, 16]} />
              <meshStandardMaterial color="#8fe3ff" emissive="#2fa8e0" emissiveIntensity={0.5} metalness={0.3} roughness={0.1} />
            </mesh>
          </group>
        ))}
        <mesh position-y={0.36}>
          <cylinderGeometry args={[0.018, 0.018, 0.1, 6]} />
          <meshStandardMaterial color="#3a3f48" metalness={0.6} />
        </mesh>
        <group ref={prop} position-y={0.41} rotation-x={-PI / 2}>
          <mesh>
            <sphereGeometry args={[0.035, 10, 8]} />
            <meshStandardMaterial color="#e5413a" />
          </mesh>
          <mesh>{blade}<meshStandardMaterial color="#2f6bd8" /></mesh>
          <mesh rotation-z={PI / 2}>{blade}<meshStandardMaterial color="#f5c518" /></mesh>
        </group>
      </group>
    </group>
  );
}
