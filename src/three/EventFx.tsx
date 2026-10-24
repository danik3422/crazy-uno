import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../game/view';
import { METEOR_FALL, fxState, nowSec } from './fxState';
import { arena, seatPos, type View } from './layout';

/** Where an effect aimed at player i lands on the table. */
export function seatWorld(game: GameView, i: number, view: View, out = new THREE.Vector3()) {
  if (i === game.seat()) return out.set(0, 0.3, arena(view).hand.z - 0.4);
  const [x, , z] = seatPos(game, i, view);
  return out.set(x, 0.2, z);
}

interface FxProps {
  game: GameView;
  view: View;
}

/** A burning rock that drops from the sky onto the unlucky player, then explodes. */
export function Meteor({ game, view }: FxProps) {
  const rock = useRef<THREE.Group>(null!);
  const blast = useRef<THREE.Mesh>(null!);
  const blastMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const target = useMemo(() => new THREE.Vector3(), []);
  const from = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = nowSec() - fxState.meteor.at;
    seatWorld(game, fxState.meteor.target, view, target);
    from.copy(target).add(tmp.set(-5, 13, -7));
    const falling = t >= 0 && t < METEOR_FALL;
    rock.current.visible = falling;
    if (falling) {
      const k = t / METEOR_FALL;
      rock.current.position.lerpVectors(from, target, k * k);
      rock.current.lookAt(target);
      rock.current.rotateZ(t * 20);
    }
    const bt = t - METEOR_FALL;
    const exploding = bt >= 0 && bt < 0.8;
    blast.current.visible = ring.current.visible = exploding;
    light.current.intensity = falling ? 30 : exploding ? 120 * (1 - bt / 0.8) : 0;
    light.current.position.copy(falling ? rock.current.position : target);
    if (exploding) {
      blast.current.position.copy(target);
      blast.current.scale.setScalar(0.4 + bt * 5);
      blastMat.current.opacity = 1 - bt / 0.8;
      ring.current.position.set(target.x, 0.05, target.z);
      ring.current.scale.setScalar(0.5 + bt * 9);
      ringMat.current.opacity = 0.9 * (1 - bt / 0.8);
    }
  });

  return (
    <>
      <group ref={rock}>
        <mesh>
          <icosahedronGeometry args={[0.45, 1]} />
          <meshStandardMaterial color="#3a2a22" emissive="#ff5a1a" emissiveIntensity={1.6} roughness={0.9} flatShading />
        </mesh>
        {/* fiery tail pointing back along the flight path */}
        <mesh position-z={-1.6} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.42, 3.2, 16, 1, true]} />
          <meshBasicMaterial color="#ffb03a" transparent opacity={0.55} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <mesh ref={blast}>
        <sphereGeometry args={[0.6, 24, 16]} />
        <meshBasicMaterial ref={blastMat} color="#ff7a2a" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2}>
        <ringGeometry args={[0.5, 0.65, 48]} />
        <meshBasicMaterial ref={ringMat} color="#ffd04a" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#ff8a3a" distance={14} />
    </>
  );
}

/** A jagged bolt from the sky onto the target seat. */
export function Lightning({ game, view }: FxProps) {
  const group = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null!);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null!);
  const target = useMemo(() => new THREE.Vector3(), []);
  const at = fxState.lightning.at;
  // a fresh zig-zag every strike
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const y = 12 - i * 1.2;
      pts.push(new THREE.Vector3(i === 10 ? 0 : (Math.random() - 0.5) * 1.2, y, i === 10 ? 0 : (Math.random() - 0.5) * 1.2));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1);
    return { core: new THREE.TubeGeometry(curve, 80, 0.05, 6), glow: new THREE.TubeGeometry(curve, 80, 0.2, 8) };
  }, [at]);

  useFrame(() => {
    const t = nowSec() - fxState.lightning.at;
    const on = t >= 0 && t < 0.6;
    group.current.visible = on;
    seatWorld(game, fxState.lightning.target, view, target);
    group.current.position.set(target.x, 0, target.z);
    const flicker = on && Math.sin(t * 70) > -0.3 ? 1 : 0.2;
    coreMat.current.opacity = flicker;
    glowMat.current.opacity = 0.35 * flicker;
    light.current.intensity = on ? 90 * flicker * (1 - t / 0.6) : 0;
  });

  return (
    <group ref={group}>
      <mesh geometry={geo.core}>
        <meshBasicMaterial ref={coreMat} color="#ffffff" transparent toneMapped={false} />
      </mesh>
      <mesh geometry={geo.glow}>
        <meshBasicMaterial ref={glowMat} color="#8fc8ff" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} position={[0, 1.5, 0]} color="#bfe0ff" distance={12} />
    </group>
  );
}

/** Golden coins/sparkles fountain for the jackpot event. */
export function GoldBurst({ game, view }: FxProps) {
  const N = 90;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const origin = useMemo(() => new THREE.Vector3(), []);
  const parts = useMemo(
    () => Array.from({ length: N }, () => ({
      v: new THREE.Vector3((Math.random() - 0.5) * 4, 5 + Math.random() * 4, (Math.random() - 0.5) * 4),
      spin: (Math.random() - 0.5) * 20,
    })),
    [],
  );
  useFrame(() => {
    const t = nowSec() - fxState.burst.at;
    const on = t >= 0 && t < 1.8;
    ref.current.visible = on;
    if (!on) return;
    seatWorld(game, fxState.burst.target, view, origin);
    parts.forEach((p, i) => {
      dummy.position.set(origin.x + p.v.x * t, Math.max(0.05, origin.y + p.v.y * t - 6 * t * t), origin.z + p.v.z * t);
      dummy.rotation.set(p.spin * t, p.spin * t * 0.5, 0);
      dummy.scale.setScalar(1 - t / 1.8);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <cylinderGeometry args={[0.12, 0.12, 0.03, 16]} />
      <meshStandardMaterial color="#ffd04a" emissive="#c98a00" emissiveIntensity={0.6} metalness={0.8} roughness={0.25} />
    </instancedMesh>
  );
}
