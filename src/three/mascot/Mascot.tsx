import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { exposeDebug } from '../../lib/debug';
import { sound } from '../../audio/sound';
import { BOMBER_TIME, BOMB_RELEASE, fxState, nowSec } from '../effects/fxState';
import { bomberRoute, pickRoute, type Route } from './mascotRoutes';
import { spawn } from '../layout';

const PI = Math.PI;

/** The barrel plane: a blue-and-yellow barrel with plank wings, a propeller and a cartoon pilot. */
function BarrelPlane({ prop }: { prop: RefObject<THREE.Group> }) {
  const scarf = useRef<THREE.Mesh>(null!);
  useFrame(st => {
    scarf.current.rotation.x = -0.5 + Math.sin(st.clock.elapsedTime * 18) * 0.25;
  });
  const half = (start: number) => {
    const g = new THREE.CylinderGeometry(0.42, 0.42, 1.25, 28, 1, true, start, PI);
    g.rotateX(PI / 2);
    return g;
  };
  const top = useMemo(() => half(PI / 2), []);
  const bottom = useMemo(() => half(-PI / 2), []);
  const blade = <boxGeometry args={[0.09, 1.15, 0.03]} />;

  return (
    <group>
      {/* barrel body */}
      <mesh geometry={top} castShadow>
        <meshStandardMaterial color="#2f6bd8" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={bottom} castShadow>
        <meshStandardMaterial color="#f5c518" roughness={0.45} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {[0.625, -0.625].map(z => (
        <group key={z} position-z={z}>
          <mesh rotation-y={z > 0 ? 0 : PI}>
            <circleGeometry args={[0.42, 28]} />
            <meshStandardMaterial color="#f4f1ea" roughness={0.6} />
          </mesh>
          <mesh>
            <torusGeometry args={[0.42, 0.035, 8, 32]} />
            <meshStandardMaterial color="#3a3f48" metalness={0.6} roughness={0.35} />
          </mesh>
        </group>
      ))}
      {[0.25, -0.25].map(z => (
        <mesh key={z} position-z={z}>
          <torusGeometry args={[0.425, 0.02, 6, 32]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* plank wings with struts */}
      <mesh position={[0, 0.32, 0.12]} castShadow>
        <boxGeometry args={[3, 0.06, 0.55]} />
        <meshStandardMaterial color="#e9e3d6" roughness={0.8} />
      </mesh>
      {[-1.1, 1.1].map(x => (
        <mesh key={x} position={[x * 0.55, 0.12, 0.12]} rotation-z={x > 0 ? -0.5 : 0.5}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
          <meshStandardMaterial color="#555b66" metalness={0.6} />
        </mesh>
      ))}

      {/* tail */}
      <mesh position={[0, 0.5, -0.78]} rotation-x={-0.25} castShadow>
        <boxGeometry args={[0.05, 0.75, 0.45]} />
        <meshStandardMaterial color="#141414" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.12, -0.8]}>
        <boxGeometry args={[1.05, 0.04, 0.3]} />
        <meshStandardMaterial color="#141414" roughness={0.5} />
      </mesh>

      {/* propeller */}
      <mesh position-z={0.7} rotation-x={PI / 2}>
        <coneGeometry args={[0.1, 0.22, 16]} />
        <meshStandardMaterial color="#d8dbe2" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={prop} position-z={0.74}>
        <mesh>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
        <mesh rotation-z={PI / 2}>{blade}<meshStandardMaterial color="#2a2a2a" /></mesh>
      </group>

      {/* skids like a sled */}
      {[-0.36, 0.36].map(x => (
        <group key={x}>
          <mesh position={[x, -0.78, 0.05]}>
            <boxGeometry args={[0.06, 0.05, 1.7]} />
            <meshStandardMaterial color="#d9d4c7" roughness={0.7} />
          </mesh>
          {[0.45, -0.35].map(z => (
            <mesh key={z} position={[x * 0.8, -0.56, z]} rotation-z={x > 0 ? 0.25 : -0.25}>
              <cylinderGeometry args={[0.022, 0.022, 0.45, 6]} />
              <meshStandardMaterial color="#555b66" metalness={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* cartoon pilot: leather cap, big goggles, wide grin */}
      <group position={[0, 0.38, -0.2]}>
        <mesh position-y={0.12}>
          <cylinderGeometry args={[0.2, 0.24, 0.3, 16]} />
          <meshStandardMaterial color="#7a5232" roughness={0.8} />
        </mesh>
        <mesh ref={scarf} position={[0.08, 0.26, -0.2]}>
          <boxGeometry args={[0.1, 0.03, 0.45]} />
          <meshStandardMaterial color="#e5413a" />
        </mesh>
        <mesh position-y={0.46} castShadow>
          <sphereGeometry args={[0.21, 24, 18]} />
          <meshStandardMaterial color="#f2c597" roughness={0.7} />
        </mesh>
        <mesh position-y={0.49}>
          <sphereGeometry args={[0.225, 24, 12, 0, PI * 2, 0, PI / 2.1]} />
          <meshStandardMaterial color="#6b3f1e" roughness={0.6} />
        </mesh>
        {[-0.08, 0.08].map(x => (
          <group key={x} position={[x, 0.55, 0.17]}>
            <mesh>
              <torusGeometry args={[0.065, 0.022, 8, 20]} />
              <meshStandardMaterial color="#3a3f48" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh>
              <circleGeometry args={[0.055, 16]} />
              <meshStandardMaterial color="#8fe3ff" emissive="#2fa8e0" emissiveIntensity={0.5} metalness={0.3} roughness={0.1} />
            </mesh>
          </group>
        ))}
        {[-0.07, 0.07].map(x => (
          <mesh key={x} position={[x, 0.45, 0.19]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        ))}
        <mesh position={[0, 0.38, 0.17]} rotation-z={PI}>
          <torusGeometry args={[0.07, 0.016, 6, 16, PI]} />
          <meshStandardMaterial color="#8a2a1a" />
        </mesh>
      </group>
    </group>
  );
}

interface Props {
  /** auto: shows up when fxState.mascot says so; orbit: keeps circling (menu screen) */
  mode?: 'auto' | 'orbit';
  scale?: number;
  /** orbit radii (x, z) */
  orbit?: [number, number];
  /** narrow screens get a tighter swoop */
  portrait?: boolean;
}

const LOOP_TIME = 10;
const ORBIT_TILT = 0.42; // the menu ring dips in front of the cards and rises behind them


const Y_UP = new THREE.Vector3(0, 1, 0);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** Stunts: a barrel roll (spin around the nose) or a loop (a full vertical circle). */
interface Stunt { kind: 'roll' | 'loop'; at: number; dur: number }

/**
 * The plane always flies nose-first along its path, banks into turns like a real plane,
 * and now and then throws in a barrel roll or a loop.
 */
export function Mascot({ mode = 'auto', scale = 1, orbit = [3.2, 1.4], portrait = false }: Props) {
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const prop = useRef<THREE.Group>(null!);
  const puffs = useRef<THREE.InstancedMesh>(null!);
  const PUFFS = 40;
  const puffData = useMemo(() => Array.from({ length: PUFFS }, () => ({ p: new THREE.Vector3(), born: -10 })), []);
  const next = useRef(0);
  const lastPuff = useRef(0);
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(), ahead: new THREE.Vector3(), behind: new THREE.Vector3(),
      fwd: new THREE.Vector3(), up: new THREE.Vector3(), toC: new THREE.Vector3(), tmp: new THREE.Vector3(),
      m: new THREE.Matrix4(), side: new THREE.Vector3(),
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const stunt = useRef<Stunt | null>(null);
  const nextStunt = useRef(4 + Math.random() * 3);
  const bank = useRef(0);
  const route = useRef<Route | null>(null);
  const routeFor = useRef(-1);
  const bombed = useRef(false);
  /** first frame of a new appearance: jump straight to the pose instead of turning into it */
  const snap = useRef(true);
  const bombRef = useRef<THREE.Group>(null!);
  const targetQ = useMemo(() => new THREE.Quaternion(), []);

  useFrame((st, dt) => {
    const now = nowSec();
    const clock = st.clock.elapsedTime;
    prop.current.rotation.z += dt * 45;
    let active = false;
    let onGround = false;
    let bankTarget = 0;
    let growScale = 1;
    let carrying = false;
    // where the plane is on its base path, a point a bit ahead, and a bit behind (for curvature)
    const { pos, ahead, behind, fwd, up, toC, tmp, m, side } = v;
    up.set(0, 1, 0);

    if (mode === 'orbit') {
      const [ox, oz] = orbit;
      const at = (a: number, out: THREE.Vector3) =>
        out.set(Math.cos(a) * ox, -Math.sin(a) * oz * Math.sin(ORBIT_TILT), Math.sin(a) * oz * Math.cos(ORBIT_TILT));
      // clockwise from above, so it crosses in front of the cards left to right
      const a = -clock * 0.62;
      at(a, pos);
      at(a - 0.06, ahead);
      at(a + 0.06, behind);
      // the ring's own "up", leaning toward the middle: a proper banked turn
      up.set(0, Math.cos(ORBIT_TILT), Math.sin(ORBIT_TILT));
      toC.copy(pos).negate().normalize();
      up.addScaledVector(toC, 0.55).normalize();
      active = true;
    } else {
      const f = fxState.mascot;
      const t = now - f.at;
      const isBomber = f.mode === 'bomber';
      if ((f.mode === 'fly' || isBomber) && t >= 0) {
        if (routeFor.current !== f.at) {
          // a new appearance: pick a route (or build the bombing run toward the victim)
          routeFor.current = f.at;
          bombed.current = false;
          snap.current = true;
          stunt.current = null;
          const deck = spawn.pos;
          if (isBomber) {
            const T = spawn.seats[f.target] ?? ([0, 0.6, 0] as [number, number, number]);
            route.current = { name: 'bomber', curve: bomberRoute(T, portrait), dur: BOMBER_TIME, warp: (p: number) => p, stunts: [] };
          } else {
            route.current = pickRoute(Math.floor(f.seed * 233280), { w: portrait ? 0.55 : 1, portrait, deck: [deck[0], 0.45, deck[2]], pile: [0.25, 0, -0.15] });
          }
        }
        const R = route.current!;
        if (t < R.dur) {
          const p = t / R.dur;
          const u = THREE.MathUtils.clamp(R.warp(p), 0, 1);
          R.curve.getPointAt(u, pos);
          R.curve.getTangentAt(u, fwd);
          ahead.copy(pos).add(fwd);
          onGround = !!R.ground && p > R.ground[0] && p < R.ground[1];
          // bank into the turn: how the path bends sideways a little further on
          R.curve.getTangentAt(Math.min(1, u + 0.015), tmp);
          side.crossVectors(fwd, Y_UP).normalize();
          bankTarget = onGround ? 0 : THREE.MathUtils.clamp(tmp.sub(fwd).dot(side) * 22, -0.95, 0.95);
          // straight up out of the deck: "up" can't be the sky then
          if (Math.abs(fwd.y) > 0.92) up.set(0, 0, 1);
          // scripted stunts along the route
          for (const st of R.stunts) {
            const start = st.at * R.dur;
            if (!stunt.current && t >= start && t < start + 0.1) stunt.current = { kind: st.kind, at: clock, dur: st.dur };
          }
          if (R.growIn) growScale = smooth(p / R.growIn);
          if (isBomber) {
            carrying = !bombed.current;
            if (!bombed.current && t >= BOMB_RELEASE) {
              // bombs away: it keeps the plane's speed and falls onto the victim
              bombed.current = true;
              const T = spawn.seats[f.target] ?? ([0, 0.6, 0] as [number, number, number]);
              fxState.bombFall = { at: now, from: [pos.x, pos.y - 0.5 * scale, pos.z], to: [T[0], T[1] + 0.3, T[2]] };
              sound.play('whistle');
            }
            // the plane is lighter after the drop: a little hop
            if (bombed.current) pos.y += Math.min(1, (t - BOMB_RELEASE) / 0.4) * 0.35;
          }
          active = true;
        }
      } else if (f.mode === 'loop' && t >= 0 && t < LOOP_TIME) {
        // victory laps: a tight circle above and behind the podium, clear of the camera
        const at = (a: number, out: THREE.Vector3) => out.set(Math.cos(a) * 3.4, 3.4 + Math.sin(a * 2) * 0.3, Math.sin(a) * 1.4 - 2.4);
        const a = -t * 1.0;
        at(a, pos);
        at(a - 0.06, ahead);
        pos.y += Math.max(0, 1 - t / 1.2) * 6;
        toC.set(-pos.x, 0, -pos.z - 0.5).normalize();
        up.set(0, 1, 0).addScaledVector(toC, 0.6).normalize();
        active = true;
      }
    }

    root.current.visible = active;
    if (!active) snap.current = true;
    // the propeller gets louder the closer the plane is to the camera
    if (mode === 'auto') sound.propeller(active ? 1.4 - st.camera.position.distanceTo(pos) / 16 : 0);
    if (import.meta.env.DEV && mode === 'auto') {
      exposeDebug('__mascot', { active, route: route.current?.name, p: pos.toArray().map(x => +x.toFixed(2)) });
    }
    if (!active) {
      if (mode === 'auto') stunt.current = null;
    } else {
      // stunts on the menu: every few seconds
      if (mode === 'orbit' && !stunt.current && clock > nextStunt.current) {
        stunt.current = { kind: Math.random() < 0.5 ? 'roll' : 'loop', at: clock, dur: 1.5 };
        nextStunt.current = clock + 5 + Math.random() * 4;
      }
      let roll = 0;
      let pitch = 0;
      const sNow = stunt.current;
      if (sNow) {
        const p = (clock - sNow.at) / sNow.dur;
        if (p >= 1) stunt.current = null;
        else if (p > 0) {
          const e = smooth(p);
          if (sNow.kind === 'roll') roll = e * Math.PI * 2;
          else {
            // a vertical circle: climb, go over the top, come back down onto the path
            pitch = -e * Math.PI * 2;
            fwd.subVectors(ahead, pos).normalize();
            const r = 0.9 * scale;
            pos.addScaledVector(up, (1 - Math.cos(e * Math.PI * 2)) * r).addScaledVector(fwd, Math.sin(e * Math.PI * 2) * r * 0.6);
          }
        }
      }
      // nose along the path: Matrix4.lookAt(target, eye) points +z from eye to target.
      // The heading is eased (not set) every frame, so sharp bits of a path never jerk the plane round.
      m.lookAt(ahead, pos, up);
      targetQ.setFromRotationMatrix(m);
      if (snap.current) root.current.quaternion.copy(targetQ);
      else root.current.quaternion.slerp(targetQ, 1 - Math.exp(-dt * 9));
      snap.current = false;
      root.current.position.copy(pos);
      // smaller on victory laps, so it decorates the podium instead of hiding it
      root.current.scale.setScalar((mode === 'auto' && fxState.mascot.mode === 'loop' ? scale * 0.7 : scale) * growScale);
      bank.current += (bankTarget - bank.current) * (1 - Math.exp(-dt * 4));
      body.current.rotation.set(pitch, 0, roll + bank.current);
      // a gentle bob in the air; dead still while taxiing on the table
      body.current.position.y = onGround ? 0 : Math.sin(now * 5) * 0.04;
      bombRef.current.visible = carrying;
      if (mode === 'auto' && !onGround && now - lastPuff.current > 0.07) {
        lastPuff.current = now;
        const d = puffData[next.current++ % PUFFS];
        body.current.localToWorld(d.p.set(0, 0, -1.05));
        d.born = now;
      }
    }
    if (mode === 'auto') {
      puffData.forEach((d, i) => {
        const age = now - d.born;
        const s = age < 1.3 ? (0.12 + age * 0.35) * (1 - age / 1.3) : 0;
        dummy.position.copy(d.p);
        dummy.position.y += age * 0.3;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        puffs.current.setMatrixAt(i, dummy.matrix);
      });
      puffs.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={root} scale={scale} visible={false}>
        <group ref={body}>
          <BarrelPlane prop={prop} />
          {/* the bomb it carries on a bombing run */}
          <group ref={bombRef} position={[0, -0.62, 0.05]} visible={false}>
            <mesh rotation-x={Math.PI / 2}>
              <capsuleGeometry args={[0.16, 0.32, 6, 14]} />
              <meshStandardMaterial color="#26262c" metalness={0.5} roughness={0.35} />
            </mesh>
            <mesh position-z={-0.36} rotation-x={Math.PI / 2}>
              <coneGeometry args={[0.17, 0.2, 4]} />
              <meshStandardMaterial color="#e5413a" />
            </mesh>
          </group>
        </group>
      </group>
      {mode === 'auto' && (
        <instancedMesh ref={puffs} args={[undefined, undefined, PUFFS]} frustumCulled={false}>
          <sphereGeometry args={[1, 10, 8]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.75} roughness={1} />
        </instancedMesh>
      )}
    </>
  );
}
