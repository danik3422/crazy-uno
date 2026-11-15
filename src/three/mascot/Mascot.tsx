import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { debugValue, exposeDebug } from '../../lib/debug';
import { sound } from '../../audio/sound';
import { BOMBER_TIME, BOMB_RELEASE, fxState, nowSec, summonMascot } from '../effects/fxState';
import { bomberRoute, pickRoute, type Route } from './mascotRoutes';
import { spawn } from '../layout';
import { MASCOT_ANCHORS, MascotBody, type MascotPose } from './skins';
import { useSkins, type MascotSkin } from '../../game/skins';

interface Props {
  /** auto: shows up when fxState.mascot says so; orbit: keeps circling (menu screen) */
  mode?: 'auto' | 'orbit';
  scale?: number;
  /** orbit radii (x, z) */
  orbit?: [number, number];
  /** narrow screens get a tighter swoop */
  portrait?: boolean;
  /** this look instead of the one the player picked (the skins menu previews) */
  skin?: MascotSkin;
}

const LOOP_TIME = 10;
const ORBIT_TILT = 0.42; // the menu ring dips in front of the cards and rises behind them
/** the victory laps: a flat ellipse above and behind the podium (centre y, z; radii x, z) */
const LAPS = { y: 3.4, z: -2.4, rx: 3.4, rz: 1.4 };
/** ...kept inside this much of the screen (normalized device coords), whatever the camera does */
const LAPS_EDGE = 0.86;
const LAPS_TOP = 0.78;
/** the mascot's size for fitting routes to the screen: centre to wing tip, at scale 1 */
const RADIUS = 1.4;
const PUFFS = 40;
const PUFF_LIFE = 1.3;

// debug: window.__summon('fly' | 'bomber' | 'loop', delay, target, seed) brings the mascot in now;
// window.__mascotRoute = 'loop' forces the next fly-by's route (see mascotRoutes.ts)
exposeDebug('__summon', summonMascot);

const Y_UP = new THREE.Vector3(0, 1, 0);
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const damp = (dt: number, k: number) => 1 - Math.exp(-dt * k);

/** A point on the menu's tilted ring. */
const orbitAt = (a: number, ox: number, oz: number, out: THREE.Vector3) =>
  out.set(Math.cos(a) * ox, -Math.sin(a) * oz * Math.sin(ORBIT_TILT), Math.sin(a) * oz * Math.cos(ORBIT_TILT));
/** A point on the victory laps (k: x radius factor, y: centre height, as fitted to the screen). */
const lapAt = (a: number, k: number, y: number, out: THREE.Vector3) =>
  out.set(Math.cos(a) * LAPS.rx * k, y + Math.sin(a * 2) * 0.3, Math.sin(a) * LAPS.rz + LAPS.z);

/** Stunts: a barrel roll (spin around the nose) or a loop (a full vertical circle). */
interface Stunt { kind: 'roll' | 'loop'; at: number; dur: number }

/**
 * The plane always flies nose-first along its path, banks into turns like a real plane,
 * and now and then throws in a barrel roll or a loop.
 */
export function Mascot({ mode = 'auto', scale = 1, orbit = [3.2, 1.4], portrait = false, skin }: Props) {
  const chosen = useSkins().mascot;
  const look = skin ?? chosen;
  const anchors = MASCOT_ANCHORS[look];
  const root = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const prop = useRef<THREE.Group>(null!);
  const puffs = useRef<THREE.InstancedMesh>(null!);
  const puffData = useMemo(() => Array.from({ length: PUFFS }, () => ({ p: new THREE.Vector3(), born: -10 })), []);
  const next = useRef(0);
  const lastPuff = useRef(0);
  const v = useMemo(
    () => ({
      pos: new THREE.Vector3(), ahead: new THREE.Vector3(), fwd: new THREE.Vector3(), up: new THREE.Vector3(),
      toC: new THREE.Vector3(), tmp: new THREE.Vector3(), m: new THREE.Matrix4(), side: new THREE.Vector3(),
      ndc: new THREE.Vector3(),
    }),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pose = useMemo<MascotPose>(() => ({ active: false, furl: 0 }), []);
  const stunt = useRef<Stunt | null>(null);
  /** how many of the route's stunts have started */
  const stuntsDone = useRef(0);
  /** the loop's climb angle last frame, so it turns all the way round instead of jumping back */
  const loopAngle = useRef(0);
  const nextStunt = useRef(4 + Math.random() * 3);
  const bank = useRef(0);
  const route = useRef<Route | null>(null);
  const routeFor = useRef(-1);
  const bombed = useRef(false);
  /** first frame of a new appearance: jump straight to the pose instead of turning into it */
  const snap = useRef(true);
  const bombRef = useRef<THREE.Group>(null!);
  const targetQ = useMemo(() => new THREE.Quaternion(), []);
  /** victory laps fitted to the screen: x radius factor and centre height (eased as the finale camera moves) */
  const laps = useRef({ k: 1, y: LAPS.y });
  /** a puff is still in the air (true at first: the instances start as unit spheres until the first update) */
  const puffsLive = useRef(true);

  useFrame((st, dt) => {
    const now = nowSec();
    const clock = st.clock.elapsedTime;
    const cam = st.camera;
    let active = false;
    let onGround = false;
    let bankTarget = 0;
    let growScale = 1;
    let carrying = false;
    let lapping = false;
    /** world speed along the base path, for the loop's nose */
    let speed = 0;
    const { pos, ahead, fwd, up, toC, tmp, m, side, ndc } = v;
    up.set(0, 1, 0);

    if (mode === 'orbit') {
      const [ox, oz] = orbit;
      // clockwise from above, so it crosses in front of the cards left to right
      const a = -clock * 0.62;
      orbitAt(a, ox, oz, pos);
      orbitAt(a - 0.06, ox, oz, ahead);
      speed = (pos.distanceTo(ahead) / 0.06) * 0.62;
      fwd.subVectors(ahead, pos).normalize();
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
          // a new appearance: pick a route (or build the bombing run toward the victim), fitted to this screen
          routeFor.current = f.at;
          bombed.current = false;
          snap.current = true;
          stunt.current = null;
          stuntsDone.current = 0;
          cam.updateMatrixWorld();
          const framing = { camera: cam, radius: RADIUS * scale };
          const deck = spawn.pos;
          if (isBomber) {
            const T = spawn.seats[f.target] ?? ([0, 0.6, 0] as [number, number, number]);
            route.current = bomberRoute(T, portrait, BOMBER_TIME, BOMB_RELEASE, framing);
          } else {
            route.current = pickRoute(
              Math.floor(f.seed * 233280),
              { force: debugValue<string>('__mascotRoute'), w: portrait ? 0.55 : 1, portrait, deck: [deck[0], 0.45, deck[2]], pile: [0.25, 0, -0.15] },
              framing,
            );
          }
        }
        const R = route.current!;
        const p = R.p0 + t / R.full;
        if (p < R.p1) {
          const u = THREE.MathUtils.clamp(R.warp(p), 0, 1);
          R.curve.getPointAt(u, pos);
          R.curve.getTangentAt(u, fwd);
          ahead.copy(pos).add(fwd);
          speed = (R.length * (THREE.MathUtils.clamp(R.warp(p + 0.01), 0, 1) - u)) / (0.01 * R.full);
          onGround = !!R.ground && p > R.ground[0] && p < R.ground[1];
          // bank into the turn: how the path bends sideways a little further on
          R.curve.getTangentAt(Math.min(1, u + 0.015), tmp);
          side.crossVectors(fwd, Y_UP).normalize();
          bankTarget = onGround ? 0 : THREE.MathUtils.clamp(tmp.sub(fwd).dot(side) * 22, -0.95, 0.95);
          // straight up out of the deck: "up" can't be the sky then
          if (Math.abs(fwd.y) > 0.92) up.set(0, 0, 1);
          // scripted stunts along the route (one that starts before the visible part is skipped)
          const sNext = R.stunts[stuntsDone.current];
          if (sNext && p >= sNext.at) {
            stuntsDone.current++;
            if (p < sNext.at + 0.1 / R.full) stunt.current = { kind: sNext.kind, at: clock - (p - sNext.at) * R.full, dur: sNext.dur };
          }
          if (R.growIn) growScale = smooth(p / R.growIn);
          if (isBomber) {
            carrying = !bombed.current;
            if (!bombed.current && t >= BOMB_RELEASE) {
              // bombs away: it falls from where it hangs on the body onto the victim
              bombed.current = true;
              const T = spawn.seats[f.target] ?? ([0, 0.6, 0] as [number, number, number]);
              bombRef.current.getWorldPosition(tmp);
              fxState.bombFall = { at: now, from: [tmp.x, tmp.y, tmp.z], to: [T[0], T[1] + 0.3, T[2]] };
              sound.play('whistle');
            }
            // the plane is lighter after the drop: a little hop
            if (bombed.current) pos.y += Math.min(1, (t - BOMB_RELEASE) / 0.4) * 0.35;
          }
          active = true;
        }
      } else if (f.mode === 'loop' && t >= 0 && t < LOOP_TIME) {
        // victory laps: a flat circle above and behind the podium, clear of the camera, and inside the frame
        // (the finale camera keeps moving, so the fit is redone every frame and eased)
        const L = laps.current;
        cam.updateMatrixWorld();
        let kT = 1;
        ndc.set(LAPS.rx, L.y, LAPS.z).project(cam);
        if (Math.abs(ndc.x) > LAPS_EDGE) kT = LAPS_EDGE / Math.abs(ndc.x);
        let yT = LAPS.y;
        // the far side of the circle is the highest on screen
        if (ndc.set(0, LAPS.y + 0.3, LAPS.z - LAPS.rz).project(cam).y > LAPS_TOP) {
          let lo = 1.6;
          let hi = LAPS.y;
          for (let i = 0; i < 10; i++) {
            const mid = (lo + hi) / 2;
            if (ndc.set(0, mid + 0.3, LAPS.z - LAPS.rz).project(cam).y > LAPS_TOP) hi = mid;
            else lo = mid;
          }
          yT = lo;
        }
        const ease = routeFor.current !== f.at ? 1 : damp(dt, 3);
        routeFor.current = f.at;
        L.k += (kT - L.k) * ease;
        L.y += (yT - L.y) * ease;
        const a = -t * 1.0;
        lapAt(a, L.k, L.y, pos);
        lapAt(a - 0.06, L.k, L.y, ahead);
        speed = pos.distanceTo(ahead) / 0.06;
        // it comes down out of the sky first
        const drop = Math.max(0, 1 - t / 1.2) * 6;
        pos.y += drop;
        ahead.y += Math.max(0, 1 - (t + 0.06) / 1.2) * 6;
        fwd.subVectors(ahead, pos).normalize();
        toC.set(-pos.x, 0, -pos.z - 0.5).normalize();
        up.set(0, 1, 0).addScaledVector(toC, 0.6).normalize();
        lapping = true;
        active = true;
      }
    }

    root.current.visible = active;
    pose.active = active;
    if (!active) snap.current = true;
    // the propeller gets louder the closer the plane is to the camera
    if (mode === 'auto') sound.propeller(active ? 1.4 - cam.position.distanceTo(pos) / 16 : 0);
    if (!active) {
      if (mode === 'auto') stunt.current = null;
    } else {
      prop.current.rotation.z += dt * 45;
      // stunts on the menu: every few seconds
      if (mode === 'orbit' && !stunt.current && clock > nextStunt.current) {
        stunt.current = { kind: Math.random() < 0.5 ? 'roll' : 'loop', at: clock, dur: 1.5 };
        nextStunt.current = clock + 5 + Math.random() * 4;
      }
      // nose along the path: Matrix4.lookAt(target, eye) points +z from eye to target.
      // The heading is eased (not set) every frame, so sharp bits of a path never jerk the plane round.
      m.lookAt(ahead, pos, up);
      targetQ.setFromRotationMatrix(m);
      let roll = 0;
      let pitch = 0;
      const sNow = stunt.current;
      if (sNow) {
        const q = (clock - sNow.at) / sNow.dur;
        if (q >= 1) stunt.current = null;
        else if (q > 0) {
          const e = smooth(q);
          if (sNow.kind === 'roll') roll = e * Math.PI * 2;
          else {
            // a vertical circle on top of the path: climb, over the top, back down onto the path
            const th = e * Math.PI * 2;
            const thDot = (6 * q * (1 - q) * Math.PI * 2) / sNow.dur;
            const r = 0.9 * scale;
            const rh = r * 0.6;
            pos.addScaledVector(up, (1 - Math.cos(th)) * r).addScaledVector(fwd, Math.sin(th) * rh);
            // the nose follows where it is really going: the path's own speed plus the circle's
            let ang = Math.atan2(r * Math.sin(th) * thDot, speed + rh * Math.cos(th) * thDot);
            while (ang < loopAngle.current - Math.PI) ang += Math.PI * 2;
            while (ang > loopAngle.current + Math.PI) ang -= Math.PI * 2;
            loopAngle.current = ang;
            pitch = -ang;
          }
        }
      }
      if (!stunt.current || stunt.current.kind !== 'loop') loopAngle.current = 0;
      const first = snap.current;
      if (first) root.current.quaternion.copy(targetQ);
      else root.current.quaternion.slerp(targetQ, damp(dt, 9));
      snap.current = false;
      root.current.position.copy(pos);
      // smaller on victory laps, so it decorates the podium instead of hiding it
      root.current.scale.setScalar((lapping ? scale * 0.7 : scale) * growScale);
      bank.current += (bankTarget - bank.current) * damp(dt, 4);
      body.current.rotation.set(pitch, 0, roll + bank.current);
      // a gentle bob in the air; dead still while taxiing on the table
      body.current.position.y = onGround ? 0 : Math.sin(now * 5) * 0.04;
      bombRef.current.visible = carrying;
      // low over the table, or over the player's hand: long trailing parts (the blimp's banner) fold away
      let furl = 0;
      if (mode === 'auto' && !lapping) {
        ndc.copy(pos).project(cam);
        furl = Math.max(smooth((2.0 - pos.y) / 0.8), smooth((-0.15 - ndc.y) / 0.3));
      }
      pose.furl += (furl - pose.furl) * (first ? 1 : damp(dt, 5));
      if (mode === 'auto' && !onGround && now - lastPuff.current > 0.07) {
        lastPuff.current = now;
        const d = puffData[next.current++ % PUFFS];
        body.current.updateWorldMatrix(true, false);
        body.current.localToWorld(d.p.set(anchors.smoke[0], anchors.smoke[1], anchors.smoke[2]));
        d.born = now;
      }
    }
    if (import.meta.env.DEV && mode === 'auto') {
      ndc.copy(pos).project(cam);
      exposeDebug('__mascot', { active, stunt: stunt.current?.kind, pitch: +body.current.rotation.x.toFixed(2), route: route.current?.name, vis: route.current && (route.current.p1 - route.current.p0) * route.current.full, p: pos.toArray().map(x => +x.toFixed(2)), ndc: [+ndc.x.toFixed(2), +ndc.y.toFixed(2)] });
    }
    // the trail: only worked on while a puff is still in the air
    if (mode === 'auto' && (active || puffsLive.current)) {
      puffsLive.current = now - lastPuff.current < PUFF_LIFE;
      for (let i = 0; i < PUFFS; i++) {
        const d = puffData[i];
        const age = now - d.born;
        const s = age < PUFF_LIFE ? (0.12 + age * 0.35) * (1 - age / PUFF_LIFE) : 0;
        dummy.position.copy(d.p);
        dummy.position.y += age * 0.3;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        puffs.current.setMatrixAt(i, dummy.matrix);
      }
      puffs.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={root} scale={scale} visible={false}>
        <group ref={body}>
          <MascotBody skin={look} prop={prop} pose={pose} />
          {/* the bomb it carries on a bombing run, hung where this body holds it */}
          <group ref={bombRef} position={anchors.bomb} visible={false}>
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
