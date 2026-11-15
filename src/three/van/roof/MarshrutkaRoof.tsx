import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { DISPLAY, Unmirror, useCanvasTexture } from './label';

/* The marshrutka's roof: a route board «№ 13» up front and a rack piled with luggage, the famous plaid bag on top. */

const ROOF = 1.44;

function drawBoard(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = '#fbfaf4';
  c.beginPath();
  c.roundRect(4, 4, w - 8, h - 8, 18);
  c.fill();
  c.lineWidth = 10;
  c.strokeStyle = '#d42b22';
  c.stroke();
  c.fillStyle = '#16181c';
  c.font = `900 ${h * 0.62}px ${DISPLAY}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('№ 13', w / 2, h * 0.54);
}

/** the plaid of the big market bag: red and blue stripes crossing on off-white */
function drawPlaid(c: CanvasRenderingContext2D, w: number, h: number) {
  c.fillStyle = '#f1ede2';
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 0.85;
  c.fillStyle = '#c9302a';
  c.fillRect(w * 0.1, 0, w * 0.3, h);
  c.fillStyle = '#2a4fa6';
  c.fillRect(0, h * 0.55, w, h * 0.3);
  c.globalAlpha = 1;
  c.fillStyle = '#1d2b55';
  c.fillRect(w * 0.6, 0, w * 0.04, h);
  c.fillRect(0, h * 0.2, w, h * 0.04);
}

export function MarshrutkaRoof() {
  const board = useCanvasTexture(256, 128, drawBoard);
  const plaid = useCanvasTexture(128, 128, drawPlaid, 2.5, 1.5);
  const load = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    // the pile wobbles a little under its ropes
    const t = clock.elapsedTime;
    load.current.rotation.z = Math.sin(t * 7.3) * 0.012;
    load.current.rotation.x = Math.sin(t * 5.1) * 0.01;
  });
  const rail = <meshStandardMaterial color="#3b3d42" metalness={0.5} roughness={0.45} />;
  return (
    <group>
      {/* the route board on two posts, readable from both sides */}
      <group position={[-0.93, ROOF, 0]}>
        {[-0.22, 0.22].map(x => (
          <mesh key={x} position={[x, 0.07, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.14, 6]} />
            {rail}
          </mesh>
        ))}
        <mesh position-y={0.3}>
          <boxGeometry args={[0.66, 0.34, 0.03]} />
          <meshStandardMaterial color="#d42b22" roughness={0.6} />
        </mesh>
        <Unmirror position-y={0.3}>
          {[1, -1].map(s => (
            <mesh key={s} position-z={s * 0.017} rotation-y={s > 0 ? 0 : Math.PI}>
              <planeGeometry args={[0.64, 0.32]} />
              <meshStandardMaterial map={board} roughness={0.7} />
            </mesh>
          ))}
        </Unmirror>
      </group>
      {/* the rack: two rails on four feet, three cross bars */}
      {[0.44, -0.44].map(z => (
        <mesh key={z} position={[0.45, ROOF + 0.08, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 1.85, 8]} />
          {rail}
        </mesh>
      ))}
      {[-0.35, 0.45, 1.25].map(x => (
        <mesh key={x} position={[x, ROOF + 0.06, 0]}>
          <boxGeometry args={[0.04, 0.04, 0.92]} />
          {rail}
        </mesh>
      ))}
      <group ref={load} position={[0, ROOF + 0.09, 0]}>
        {/* the plaid market bag, strapped down */}
        <group position={[0.78, 0.2, 0.02]} rotation-y={0.08}>
          <mesh castShadow>
            <boxGeometry args={[0.78, 0.38, 0.52]} />
            <meshStandardMaterial map={plaid} roughness={0.85} />
          </mesh>
          <mesh position-y={0.195}>
            <boxGeometry args={[0.7, 0.012, 0.03]} />
            <meshStandardMaterial color="#222" roughness={0.5} />
          </mesh>
          {[-0.2, 0.2].map(x => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.035, 0.41, 0.55]} />
              <meshStandardMaterial color="#2f2a24" roughness={0.9} />
            </mesh>
          ))}
        </group>
        {/* a brown suitcase lying flat, with a sack of potatoes on it */}
        <mesh position={[0.02, 0.09, 0.04]} rotation-y={-0.12} castShadow>
          <boxGeometry args={[0.6, 0.17, 0.44]} />
          <meshStandardMaterial color="#8a4b25" roughness={0.65} />
        </mesh>
        <mesh position={[0.02, 0.185, -0.17]} rotation-y={-0.12}>
          <boxGeometry args={[0.16, 0.03, 0.04]} />
          <meshStandardMaterial color="#c9a94a" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0.06, 0.34, 0.02]} scale={[1.15, 0.85, 1]} castShadow>
          <sphereGeometry args={[0.2, 14, 10]} />
          <meshStandardMaterial color="#b89b62" roughness={1} />
        </mesh>
        <mesh position={[0.06, 0.53, 0.02]}>
          <cylinderGeometry args={[0.04, 0.07, 0.08, 8]} />
          <meshStandardMaterial color="#a2854f" roughness={1} />
        </mesh>
        {/* a taped cardboard box up front */}
        <mesh position={[-0.42, 0.15, 0.18]} rotation-y={0.3} castShadow>
          <boxGeometry args={[0.3, 0.28, 0.3]} />
          <meshStandardMaterial color="#c99a5a" roughness={0.9} />
        </mesh>
        <mesh position={[-0.42, 0.292, 0.18]} rotation-y={0.3}>
          <boxGeometry args={[0.31, 0.006, 0.07]} />
          <meshStandardMaterial color="#e8d7a8" roughness={0.6} />
        </mesh>
        {/* and a rolled-up carpet across the back */}
        <mesh position={[1.32, 0.09, 0]} rotation-x={Math.PI / 2} castShadow>
          <cylinderGeometry args={[0.09, 0.09, 1.0, 12]} />
          <meshStandardMaterial color="#a3302a" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
