import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Card } from '../../game/types';
import { Mascot } from '../../three/mascot/Mascot';
import { useGlRecovery } from '../../three/hooks/useGlRecovery';
import { cardFaceGeometry } from '../../three/cards/cardShape';
import { cardTexture } from '../../three/cards/textures';
import './MascotStage.css';

const HERO: Card[] = [
  { id: 1, color: 'red', type: 'num', value: 7 },
  { id: 2, color: 'yellow', type: 'bomb' },
  { id: 3, color: 'wild', type: 'chaos' },
  { id: 4, color: 'green', type: 'dare' },
  { id: 5, color: 'blue', type: 'draw2' },
];
const plane = cardFaceGeometry();

/** One card of the menu fan: deals in from below, then sways; spreads wider while the pointer is over the stage. */
function FanCard({ card, i }: { card: Card; i: number }) {
  const g = useRef<THREE.Group>(null!);
  const tex = useMemo(() => cardTexture(card), [card]);
  const back = useMemo(() => cardTexture(null), []);
  const off = i - 2;
  useFrame(st => {
    const t = st.clock.elapsedTime;
    const dealt = THREE.MathUtils.clamp((t - 0.15 * i) / 0.6, 0, 1);
    const ease = 1 - Math.pow(1 - dealt, 3);
    const spread = 0.24 + Math.abs(st.pointer.x) * 0.06 + Math.sin(t * 0.8) * 0.02;
    const ang = -off * spread * ease;
    // rotate around a pivot below the cards, like a hand of cards
    const pivotY = -1.9;
    // each card sits clearly in front of the one to its left; only in-plane rotation, so they never cut through each other
    g.current.position.set(Math.sin(-ang) * 2.6, pivotY + Math.cos(ang) * 2.6 - (1 - ease) * 3, off * 0.09);
    g.current.rotation.set(0, 0, ang);
  });
  return (
    <group ref={g}>
      <mesh geometry={plane} position-z={0.002}>
        <meshStandardMaterial map={tex} roughness={0.4} />
      </mesh>
      <mesh geometry={plane} position-z={-0.002} rotation-y={Math.PI}>
        <meshStandardMaterial map={back} roughness={0.4} />
      </mesh>
    </group>
  );
}

/** The whole fan rocks gently as one piece. */
function SwayingFan() {
  const g = useRef<THREE.Group>(null!);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    g.current.rotation.set(Math.sin(t * 0.7) * 0.06, Math.sin(t * 0.5) * 0.18, Math.sin(t * 0.6) * 0.03);
  });
  return (
    <group ref={g} position={[0, -0.35, 0]} scale={1.3}>
      {HERO.map((c, i) => <FanCard key={c.id} card={c} i={i} />)}
    </group>
  );
}

/** Menu hero: a 3D fan of cards with the barrel-plane mascot doing laps around it. */
export default function MascotStage() {
  const { glKey, onCreated } = useGlRecovery();
  return (
    <div className="mascot-stage" aria-hidden>
      <Canvas key={glKey} onCreated={onCreated} camera={{ fov: 30, position: [0, 0.9, 8.5] }} gl={{ alpha: true, antialias: true }} dpr={[1, 3]}>
        <ambientLight intensity={0.95} />
        <directionalLight position={[3, 5, 6]} intensity={1.7} />
        <hemisphereLight args={['#fff4dc', '#7a1a10', 0.5]} />
        <SwayingFan />
        {/* circles the fan like a satellite: dips in front of the cards, rises behind them */}
        <group position={[0, 0.55, 0]}>
          <Mascot mode="orbit" scale={0.55} orbit={[3.5, 2.3]} />
        </group>
      </Canvas>
    </div>
  );
}
