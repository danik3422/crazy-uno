import { useFrame } from '@react-three/fiber';
import { useRef, type RefObject } from 'react';
import * as THREE from 'three';

const PI = Math.PI;
const FUR = '#fbf8f1';
const TAN = '#c98a4b';
const WOOD = '#b8783e';
const ROOF = '#d2402f';
const VEST = '#55603a';
/** the doghouse: walls from y WALL_B to WALL_T, 0.9 wide, 1.1 long; the roof ridge along z */
const WALL_B = -0.45;
const WALL_T = 0.08;
const RIDGE = WALL_T + 0.42;
const SLOPE = Math.atan2(0.42, 0.45);

/**
 * The sapper dog: a small white-and-tan terrier in a sapper's vest, riding astride the roof of a flying wooden
 * doghouse with a propeller on its gable (the spinning `prop`). Ears flap in the wind, the tail wags.
 */
export function Dog({ prop }: { prop: RefObject<THREE.Group> }) {
  const earL = useRef<THREE.Group>(null!);
  const earR = useRef<THREE.Group>(null!);
  const tail = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    earL.current.rotation.x = -0.35 + Math.sin(t * 15) * 0.35;
    earR.current.rotation.x = -0.35 + Math.sin(t * 15 + 1.3) * 0.35;
    tail.current.rotation.z = Math.sin(t * 17) * 0.65;
    head.current.rotation.z = Math.sin(t * 2.2) * 0.12;
  });
  const blade = <boxGeometry args={[0.09, 1.0, 0.03]} />;
  const wallH = WALL_T - WALL_B;

  return (
    <group position-y={-0.05}>
      {/* walls, the attic (a triangular prism), the red roof, the round door */}
      <mesh position-y={WALL_B + wallH / 2} castShadow>
        <boxGeometry args={[0.9, wallH, 1.1]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      <mesh position-y={WALL_T + 0.14} rotation-x={-PI / 2} scale={[1, 1, 0.54]}>
        <cylinderGeometry args={[0.52, 0.52, 1.1, 3]} />
        <meshStandardMaterial color={WOOD} roughness={0.85} />
      </mesh>
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * 0.24, WALL_T + 0.235, 0]} rotation-z={-s * SLOPE} castShadow>
          <boxGeometry args={[0.72, 0.06, 1.26]} />
          <meshStandardMaterial color={ROOF} roughness={0.6} />
        </mesh>
      ))}
      {/* plank seams along the sides */}
      {[-1, 1].map(s => (
        <mesh key={s} position={[s * 0.452, WALL_B + wallH / 2, 0]}>
          <boxGeometry args={[0.01, 0.025, 1.1]} />
          <meshStandardMaterial color="#8a5527" roughness={0.9} />
        </mesh>
      ))}
      <group position={[0, WALL_B + 0.2, 0.552]}>
        <mesh>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial color="#2a1a10" roughness={1} />
        </mesh>
        <mesh position-y={0.1}>
          <circleGeometry args={[0.15, 20, 0, PI]} />
          <meshStandardMaterial color="#2a1a10" roughness={1} />
        </mesh>
      </group>
      {/* stubby plank wings through the house */}
      <mesh position={[0, WALL_B + 0.18, 0.05]} castShadow>
        <boxGeometry args={[2.6, 0.05, 0.42]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.8} />
      </mesh>

      {/* propeller on the front gable, above the door */}
      <mesh position={[0, WALL_T + 0.02, 0.6]} rotation-x={PI / 2}>
        <coneGeometry args={[0.08, 0.16, 14]} />
        <meshStandardMaterial color="#d8dbe2" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={prop} position={[0, WALL_T + 0.02, 0.66]}>
        <mesh>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
        <mesh rotation-z={PI / 2}>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
      </group>

      {/* the dog, astride the ridge */}
      <group position={[0, RIDGE - 0.02, -0.1]} scale={1.35}>
        {/* haunches over both slopes, body in the vest, front paws on the ridge */}
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * 0.15, 0.04, -0.08]} scale={[0.75, 0.75, 1]}>
            <sphereGeometry args={[0.13, 14, 10]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
        ))}
        <mesh position-y={0.2} scale={[0.85, 1, 0.95]} castShadow>
          <sphereGeometry args={[0.21, 18, 14]} />
          <meshStandardMaterial color={FUR} roughness={0.85} />
        </mesh>
        <mesh position-y={0.19} scale={[0.88, 0.62, 0.92]}>
          <sphereGeometry args={[0.215, 18, 14]} />
          <meshStandardMaterial color={VEST} roughness={0.75} />
        </mesh>
        {/* reflective stripe and a pouch on each side of the vest */}
        <mesh position-y={0.19} rotation-x={PI / 2} scale={[0.88, 0.92, 1]}>
          <torusGeometry args={[0.215, 0.018, 6, 24]} />
          <meshStandardMaterial color="#f5d43a" emissive="#c9a400" emissiveIntensity={0.25} roughness={0.4} />
        </mesh>
        {[-1, 1].map(s => (
          <mesh key={s} position={[s * 0.18, 0.14, 0.02]}>
            <boxGeometry args={[0.05, 0.08, 0.1]} />
            <meshStandardMaterial color="#3f4729" roughness={0.8} />
          </mesh>
        ))}
        {[-0.08, 0.08].map(x => (
          <mesh key={x} position={[x, 0.02, 0.2]} scale={[1, 0.8, 1.2]}>
            <sphereGeometry args={[0.055, 10, 8]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
        ))}

        <group ref={head} position={[0, 0.44, 0.1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.19, 20, 16]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
          {/* a tan patch over one eye, the muzzle, the nose, the tongue out */}
          <mesh position={[0.08, 0.05, 0.1]} scale={[1, 1, 0.8]}>
            <sphereGeometry args={[0.12, 14, 10]} />
            <meshStandardMaterial color={TAN} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.05, 0.17]} scale={[1, 0.8, 1.15]}>
            <sphereGeometry args={[0.1, 14, 10]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
          <mesh position={[0, -0.01, 0.285]}>
            <sphereGeometry args={[0.04, 10, 8]} />
            <meshStandardMaterial color="#141414" roughness={0.3} />
          </mesh>
          <mesh position={[0.025, -0.12, 0.23]} rotation-x={0.5} scale={[1, 0.35, 1.3]}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshStandardMaterial color="#ff7a8a" roughness={0.5} />
          </mesh>
          {[-1, 1].map(s => (
            <mesh key={s} position={[s * 0.075, 0.06, 0.165]}>
              <sphereGeometry args={[0.032, 10, 8]} />
              <meshStandardMaterial color="#141414" roughness={0.25} />
            </mesh>
          ))}
          {/* floppy tan ears streaming back in the wind */}
          {[-1, 1].map(s => (
            <group key={s} ref={s < 0 ? earL : earR} position={[s * 0.13, 0.12, 0.02]} rotation-z={s * -0.5}>
              <mesh position-z={-0.1} scale={[1, 0.3, 1]}>
                <sphereGeometry args={[0.1, 12, 8]} />
                <meshStandardMaterial color={TAN} roughness={0.85} />
              </mesh>
            </group>
          ))}
        </group>

        {/* the tail, wagging */}
        <group ref={tail} position={[0, 0.14, -0.2]} rotation-x={-0.6}>
          <mesh position-y={0.1}>
            <capsuleGeometry args={[0.035, 0.16, 4, 8]} />
            <meshStandardMaterial color={FUR} roughness={0.85} />
          </mesh>
          <mesh position-y={0.2}>
            <sphereGeometry args={[0.04, 8, 6]} />
            <meshStandardMaterial color={TAN} roughness={0.85} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
