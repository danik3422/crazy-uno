import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';

const PI = Math.PI;
const RED = '#d8352a';
const GREEN = '#2f8f3a';
const TYRE = '#1d1d1f';
const HUB = '#f5c518';
/** the tow rope: from the hook, down and back at this angle, this long */
const ROPE_A = 0.95;
const ROPE_L = 0.8;

/** The captured tank: grey, a bit battered, turret askew, hanging off the rope by its turret. */
function Tank() {
  return (
    <group position-y={-0.2}>
      <mesh castShadow>
        <boxGeometry args={[0.56, 0.17, 0.82]} />
        <meshStandardMaterial color="#7d8288" roughness={0.75} />
      </mesh>
      {[-0.33, 0.33].map(x => (
        <mesh key={x} position={[x, -0.04, 0]}>
          <boxGeometry args={[0.14, 0.2, 0.9]} />
          <meshStandardMaterial color="#3b3d40" roughness={0.9} />
        </mesh>
      ))}
      <group position-y={0.14} rotation-y={0.5}>
        <mesh>
          <cylinderGeometry args={[0.19, 0.22, 0.13, 14]} />
          <meshStandardMaterial color="#6f747a" roughness={0.75} />
        </mesh>
        {/* the gun droops, sadly */}
        <mesh position={[0, -0.04, 0.38]} rotation-x={PI / 2 + 0.3}>
          <cylinderGeometry args={[0.03, 0.035, 0.55, 8]} />
          <meshStandardMaterial color="#5c6066" roughness={0.6} metalness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Tractor troops: a little red-and-green farm tractor with big back wheels, flying under a helicopter rotor
 * (the spinning `prop`), towing a captured tank on a rope. The tank swings and sways behind it.
 */
export function Tractor({ prop }: { prop: RefObject<THREE.Group> }) {
  const arm = useRef<THREE.Group>(null!);
  const tank = useRef<THREE.Group>(null!);
  const flag = useRef<THREE.Group>(null!);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    const swing = Math.sin(t * 1.9) * 0.14 + Math.sin(t * 3.1) * 0.04;
    arm.current.rotation.x = ROPE_A + swing;
    arm.current.rotation.z = Math.sin(t * 1.3) * 0.16;
    // the tank hangs from its turret: roughly level, lagging the swing, spinning a little on the rope
    tank.current.rotation.set(-ROPE_A - swing * 0.4 + 0.12, Math.sin(t * 0.9) * 0.35, -arm.current.rotation.z * 0.5);
    flag.current.rotation.y = Math.sin(t * 14) * 0.3;
  });
  const blade = <boxGeometry args={[2.5, 0.12, 0.025]} />;

  return (
    <group position-y={-0.05}>
      {/* chassis, red bonnet with a grille and headlights, exhaust stack */}
      <mesh position={[0, -0.12, 0.05]}>
        <boxGeometry args={[0.42, 0.12, 1.3]} />
        <meshStandardMaterial color="#2c2e33" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, 0.08, 0.36]} castShadow>
        <boxGeometry args={[0.46, 0.36, 0.66]} />
        <meshStandardMaterial color={RED} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.06, 0.695]}>
        <boxGeometry args={[0.36, 0.26, 0.02]} />
        <meshStandardMaterial color="#26262a" roughness={0.5} metalness={0.4} />
      </mesh>
      {[-0.17, 0.17].map(x => (
        <mesh key={x} position={[x, 0.2, 0.7]} rotation-x={PI / 2}>
          <cylinderGeometry args={[0.05, 0.05, 0.03, 12]} />
          <meshStandardMaterial color="#fff6c2" emissive="#ffd84a" emissiveIntensity={0.7} />
        </mesh>
      ))}
      <mesh position={[0.13, 0.42, 0.5]}>
        <cylinderGeometry args={[0.035, 0.035, 0.36, 8]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* the green cab: lower body, four posts, roof */}
      <mesh position={[0, 0.1, -0.3]} castShadow>
        <boxGeometry args={[0.6, 0.32, 0.58]} />
        <meshStandardMaterial color={GREEN} roughness={0.5} />
      </mesh>
      {[-0.27, 0.27].map(x =>
        [-0.05, -0.55].map(z => (
          <mesh key={`${x}${z}`} position={[x, 0.48, z]}>
            <boxGeometry args={[0.04, 0.48, 0.04]} />
            <meshStandardMaterial color="#e9e3d6" roughness={0.6} />
          </mesh>
        )),
      )}
      <mesh position={[0, 0.74, -0.3]} castShadow>
        <boxGeometry args={[0.72, 0.07, 0.68]} />
        <meshStandardMaterial color={GREEN} roughness={0.5} />
      </mesh>
      {/* the farmer: overalls and a straw hat (no face needed, the hat says it all) */}
      <mesh position={[0, 0.38, -0.33]}>
        <sphereGeometry args={[0.15, 16, 12]} />
        <meshStandardMaterial color="#3d64b0" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.58, -0.3]}>
        <sphereGeometry args={[0.1, 16, 12]} />
        <meshStandardMaterial color="#f2c597" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.65, -0.3]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 20]} />
        <meshStandardMaterial color="#e8c35a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.69, -0.3]}>
        <cylinderGeometry args={[0.09, 0.1, 0.08, 16]} />
        <meshStandardMaterial color="#e8c35a" roughness={0.9} />
      </mesh>

      {/* big back wheels with mudguards, small front wheels */}
      {[-1, 1].map(s => (
        <group key={s}>
          <mesh position={[s * 0.42, -0.06, -0.34]} rotation-z={PI / 2} castShadow>
            <cylinderGeometry args={[0.38, 0.38, 0.2, 22]} />
            <meshStandardMaterial color={TYRE} roughness={0.9} />
          </mesh>
          <mesh position={[s * 0.53, -0.06, -0.34]} rotation-z={PI / 2}>
            <cylinderGeometry args={[0.17, 0.17, 0.04, 16]} />
            <meshStandardMaterial color={HUB} roughness={0.5} metalness={0.2} />
          </mesh>
          <mesh position={[s * 0.42, -0.06, -0.34]} rotation={[0, 0, PI / 2]}>
            <cylinderGeometry args={[0.43, 0.43, 0.24, 18, 1, true, 0, PI]} />
            <meshStandardMaterial color={GREEN} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[s * 0.28, -0.22, 0.48]} rotation-z={PI / 2}>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 16]} />
            <meshStandardMaterial color={TYRE} roughness={0.9} />
          </mesh>
          <mesh position={[s * 0.35, -0.22, 0.48]} rotation-z={PI / 2}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
            <meshStandardMaterial color={HUB} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* rotor mast on the roof, with a little flag */}
      <mesh position={[0, 0.88, -0.3]}>
        <cylinderGeometry args={[0.035, 0.05, 0.22, 8]} />
        <meshStandardMaterial color="#3a3f48" metalness={0.6} roughness={0.35} />
      </mesh>
      <group ref={flag} position={[0, 0.88, -0.36]}>
        <mesh position={[0, 0.03, -0.12]}>
          <boxGeometry args={[0.01, 0.06, 0.22]} />
          <meshStandardMaterial color="#2f6bd8" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.03, -0.12]}>
          <boxGeometry args={[0.01, 0.06, 0.22]} />
          <meshStandardMaterial color="#f5c518" side={THREE.DoubleSide} />
        </mesh>
      </group>
      <group ref={prop} position={[0, 1.0, -0.3]} rotation-x={-PI / 2}>
        <mesh rotation-x={PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh>{blade}<meshStandardMaterial color="#2a2a2a" roughness={0.5} /></mesh>
        <mesh rotation-z={PI / 2}>{blade}<meshStandardMaterial color="#2a2a2a" roughness={0.5} /></mesh>
      </group>

      {/* tow hook, rope and the tank swinging on it */}
      <group ref={arm} position={[0, -0.12, -0.68]} rotation-x={ROPE_A}>
        <mesh position-y={-ROPE_L / 2}>
          <cylinderGeometry args={[0.014, 0.014, ROPE_L, 5]} />
          <meshStandardMaterial color="#c8a86a" roughness={0.9} />
        </mesh>
        <group ref={tank} position-y={-ROPE_L}>
          <Tank />
        </group>
      </group>
    </group>
  );
}
