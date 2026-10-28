import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../game/view';
import { sound } from '../audio/sound';
import { BOMB_FALL, METEOR_FALL, fxState, nowSec, shake } from './fxState';
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
    light.current.position.set(target.x, 1.5, target.z);
    const flicker = on && Math.sin(t * 70) > -0.3 ? 1 : 0.2;
    coreMat.current.opacity = flicker;
    glowMat.current.opacity = 0.35 * flicker;
    light.current.intensity = on ? 90 * flicker * (1 - t / 0.6) : 0;
  });

  return (
    <>
      <group ref={group}>
        <mesh geometry={geo.core}>
          <meshBasicMaterial ref={coreMat} color="#ffffff" transparent toneMapped={false} />
        </mesh>
        <mesh geometry={geo.glow}>
          <meshBasicMaterial ref={glowMat} color="#8fc8ff" transparent toneMapped={false} depthWrite={false} />
        </mesh>
      </group>
      {/* outside the group that hides: the number of lights must never change (see Bomb in Scene.tsx) */}
      <pointLight ref={light} color="#bfe0ff" distance={12} intensity={0} />
    </>
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

/**
 * The bomber's bomb: falls from the plane in an arc onto the victim (spinning, nose down),
 * then blows up with a flash, a shock ring and a shower of sparks. The penalty cards burst out of it.
 */
export function BombDrop() {
  const bomb = useRef<THREE.Group>(null!);
  const flash = useRef<THREE.Mesh>(null!);
  const flashMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const sparks = useRef<THREE.InstancedMesh>(null!);
  const boomed = useRef(-1);
  const N = 46;
  const dirs = useMemo(
    () => Array.from({ length: N }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.3, Math.random() - 0.5).normalize().multiplyScalar(2.5 + Math.random() * 3.5)),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const look = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const b = fxState.bombFall;
    const t = nowSec() - b.at;
    const [fx, fy, fz] = b.from;
    const [tx, ty, tz] = b.to;
    // falling
    const falling = t >= 0 && t < BOMB_FALL;
    bomb.current.visible = falling;
    if (falling) {
      const p = t / BOMB_FALL;
      bomb.current.position.set(fx + (tx - fx) * p, fy + (ty - fy) * p * p, fz + (tz - fz) * p);
      // nose along the velocity: forward speed constant, falling faster and faster
      vel.set(tx - fx, (ty - fy) * 2 * p, tz - fz);
      look.copy(bomb.current.position).add(vel);
      bomb.current.lookAt(look);
      bomb.current.rotateZ(t * 14);
    }
    // impact
    const e = t - BOMB_FALL;
    if (e >= 0 && boomed.current !== b.at) {
      boomed.current = b.at;
      shake(1.0, 0.7);
      sound.play('boom');
    }
    const on = e >= 0 && e < 0.9;
    flash.current.visible = ring.current.visible = sparks.current.visible = on;
    light.current.intensity = on ? 90 * Math.max(0, 1 - e / 0.5) : 0;
    if (!on) return;
    flash.current.position.set(tx, ty + 0.2, tz);
    flash.current.scale.setScalar(0.3 + Math.sqrt(e) * 2.6);
    flashMat.current.opacity = Math.max(0, 1 - e / 0.55);
    ring.current.position.set(tx, 0.05, tz);
    ring.current.scale.setScalar(0.4 + e * 7);
    ringMat.current.opacity = 0.9 * (1 - e / 0.9);
    light.current.position.set(tx, ty + 1, tz);
    dirs.forEach((d, i) => {
      dummy.position.set(tx + d.x * e, Math.max(0.05, ty + d.y * e - 5 * e * e), tz + d.z * e);
      dummy.scale.setScalar(Math.max(0, 1 - e / 0.9));
      dummy.updateMatrix();
      sparks.current.setMatrixAt(i, dummy.matrix);
    });
    sparks.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <group ref={bomb} visible={false}>
        <mesh rotation-x={Math.PI / 2}>
          <capsuleGeometry args={[0.2, 0.4, 6, 14]} />
          <meshStandardMaterial color="#26262c" metalness={0.5} roughness={0.35} />
        </mesh>
        <mesh position-z={-0.42} rotation-x={-Math.PI / 2}>
          <coneGeometry args={[0.22, 0.26, 4]} />
          <meshStandardMaterial color="#e5413a" />
        </mesh>
      </group>
      <mesh ref={flash} visible={false}>
        <sphereGeometry args={[0.6, 24, 16]} />
        <meshBasicMaterial ref={flashMat} color="#ffb23a" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} visible={false}>
        <ringGeometry args={[0.5, 0.68, 48]} />
        <meshBasicMaterial ref={ringMat} color="#fff2a8" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <instancedMesh ref={sparks} args={[undefined, undefined, N]} visible={false} frustumCulled={false}>
        <sphereGeometry args={[0.07, 6, 4]} />
        <meshBasicMaterial color="#ffd04a" toneMapped={false} />
      </instancedMesh>
      <pointLight ref={light} color="#ff9a3c" distance={12} intensity={0} />
    </>
  );
}
