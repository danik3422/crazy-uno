import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DecorProps } from '../types';
import { GIANT, MOON, bodyMaterial, ringMaterial } from './bodies';
import { streakTex } from './textures';

/*
 * Space: the table is a station deck (drawn by the floor shader) adrift in a nebula. Out beyond it hang a
 * ringed gas giant with its moon, a sparse drift of asteroids far past the opponents, and now and then a
 * shooting star. The camera looks down at the table, so the only open sky is the band past the far edge:
 * the planet is pinned to a top corner of the screen (worked out from the camera, so it sits right on any
 * aspect ratio, from a portrait tablet to 21:9) and is partly cut off by it, which keeps it clear of the
 * plates and the cards. Interactive (all far from the hand and the pile):
 *   planet — hover glows, click spins it up and flashes the rings;
 *   moon — hover grows, click launches a shooting star;
 *   asteroid — hover lights it, click shatters it (it drifts back in a few seconds later).
 */

const ROCKS = 14;
const ROCKS_LITE = 7;
const SHARDS = 8;
const SHARD_POOL = 24;
const STREAKS = 2;
/** the moon's radius, the planet's being 1 */
const MOON_R = 0.2;

/**
 * The planet's anchor: a point on screen (NDC) and how far along that ray it floats. The radius is a share of
 * the screen's half-height at that distance, so it is the same size on screen whatever the field of view.
 */
const ANCHOR = {
  landscape: { x: 0.97, y: 0.97, dist: 46, size: 0.22 },
  portrait: { x: 0.95, y: 0.97, dist: 46, size: 0.16 },
};

/** the asteroid drift: an arc far past the opponents, below the deck's level (seen "through" the void) */
const BELT = { rx: 17, rz: 12, y: -3.2, from: Math.PI * 1.25, to: Math.PI * 1.75 };

/** frame-rate independent easing: the share of the way to cover this frame (the same glide at 30 or 144 fps) */
const damp = (dt: number, k: number) => 1 - Math.exp(-dt * k);

let hovering = 0;
function hover(on: boolean) {
  hovering = Math.max(0, hovering + (on ? 1 : -1));
  document.body.style.cursor = hovering ? 'pointer' : '';
}

/** a shared, chunky rock: an icosahedron with its vertices pushed in and out a little */
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(0.5, 1);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    // same vertex position -> same push, so the shared vertices of the flat faces stay together
    const k = 0.78 + Math.abs(Math.sin(v.x * 12.9898 + v.y * 78.233 + v.z * 37.719) * 43758.5453 % 1) * 0.36;
    p.setXYZ(i, v.x * k, v.y * k * 0.8, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}

interface Rock { u: number; lane: number; s: number; rot: THREE.Euler; spin: number; deadUntil: number }
interface Shard { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; born: number; s: number }
interface Streak { at: number; from: THREE.Vector3; dir: THREE.Vector3 }

export function Decor({ accent, portrait, lite }: DecorProps) {
  const nRocks = lite ? ROCKS_LITE : ROCKS;
  const nStreaks = lite ? 1 : STREAKS;
  const camera = useThree(s => s.camera) as THREE.PerspectiveCamera;
  const gl = useThree(s => s.gl);

  const system = useRef<THREE.Group>(null!);
  const planet = useRef<THREE.Group>(null!);
  const planetBody = useRef<THREE.Mesh>(null!);
  const moon = useRef<THREE.Mesh>(null!);
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const shards = useRef<THREE.InstancedMesh>(null!);
  const streakMeshes = useRef<(THREE.Mesh | null)[]>([]);

  // all the mutable state of the scene, touched only in the render loop and in click handlers
  const st = useMemo(() => {
    const now = performance.now() / 1000;
    return {
      cur: new THREE.Color(accent),
      target: new THREE.Color(),
      white: new THREE.Color('#ffffff'),
      tmp: new THREE.Color(),
      dummy: new THREE.Object3D(),
      v: new THREE.Vector3(),
      w: new THREE.Vector3(),
      spinV: 0.05,
      planetHover: 0,
      planetHot: false,
      ringFlash: 0,
      moonHot: false,
      moonA: 0.6,
      rockHot: -1,
      rocks: Array.from({ length: ROCKS }, (_, i): Rock => ({
        // spread along the arc, in three lanes at different depths, some big and slow, most small
        u: (i + 0.5) / ROCKS + Math.sin(i * 7.31) * 0.025,
        lane: (i * 5) % 3,
        s: 0.22 + ((i * 7) % 5) * 0.07 + (i % 6 === 0 ? 0.2 : 0),
        rot: new THREE.Euler(i, i * 2.1, i * 0.7),
        spin: 0.12 + (i % 4) * 0.07,
        deadUntil: 0,
      })),
      shards: Array.from({ length: SHARD_POOL }, (): Shard => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), born: -10, s: 0 })),
      nextShard: 0,
      streaks: Array.from({ length: STREAKS }, (): Streak => ({ at: -10, from: new THREE.Vector3(), dir: new THREE.Vector3() })),
      nextAuto: now + 4,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rockGeo = useMemo(rockGeometry, []);
  const shardGeo = useMemo(() => new THREE.TetrahedronGeometry(0.22, 0), []);
  const streakGeo = useMemo(() => new THREE.PlaneGeometry(3.4, 0.09), []);
  const giantMat = useMemo(() => bodyMaterial(GIANT), []);
  const moonMat = useMemo(() => bodyMaterial(MOON), []);
  const ringMat = useMemo(() => ringMaterial(1.35, 2.35), []);
  const streakMat = useMemo(() => {
    const t = streakTex();
    t.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  }, [gl]);

  useEffect(() => () => {
    for (const m of [giantMat, moonMat, ringMat, streakMat]) m.dispose();
    streakMat.map?.dispose();
    for (const g of [rockGeo, shardGeo, streakGeo]) g.dispose();
    hovering = 0;
    document.body.style.cursor = '';
  }, [giantMat, moonMat, ringMat, streakMat, rockGeo, shardGeo, streakGeo]);

  // the shard instances start out of sight; the rocks start unlit
  useEffect(() => {
    const d = st.dummy;
    d.scale.setScalar(0);
    d.updateMatrix();
    for (let i = 0; i < SHARD_POOL; i++) shards.current.setMatrixAt(i, d.matrix);
    shards.current.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < nRocks; i++) rocks.current.setColorAt(i, st.white);
    if (rocks.current.instanceColor) rocks.current.instanceColor.needsUpdate = true;
  }, [st, nRocks]);

  /** a shooting star across the open sky past the far edge (or from the moon, when it is clicked) */
  const launchStreak = (now: number, fromMoon: boolean) => {
    const i = st.streaks.findIndex(x => now - x.at > 1.3);
    if (i < 0 || i >= nStreaks) return;
    const s = st.streaks[i];
    s.at = now;
    const left = Math.random() < 0.5;
    if (fromMoon) {
      moon.current.getWorldPosition(s.from);
      s.dir.set(-1, -0.06, 0.15).normalize();
      return;
    }
    s.from.set(left ? -24 + Math.random() * 6 : 18 + Math.random() * 6, -2 - Math.random() * 3, -22 - Math.random() * 6);
    s.dir.set(left ? 1 : -1, -0.05 - Math.random() * 0.05, 0.08).normalize();
  };

  useFrame((state, dt) => {
    const now = performance.now() / 1000;
    const t = state.clock.elapsedTime;
    dt = Math.min(dt, 0.1);

    // the planet is pinned to a corner of the screen; worked out again every frame (a few multiplies),
    // so it stays put through the camera's intro move, a resize or a turn of the device
    const A = portrait ? ANCHOR.portrait : ANCHOR.landscape;
    st.v.set(A.x, A.y, 0.5).unproject(camera).sub(camera.position).normalize();
    system.current.position.copy(camera.position).addScaledVector(st.v, A.dist);
    system.current.scale.setScalar(A.dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * A.size);
    // the system turns to face the camera, so its rings always open up towards the player
    system.current.quaternion.copy(camera.quaternion);

    // the accent colour eases in
    st.cur.lerp(st.target.set(accent), damp(dt, 2));

    // planet: turns slowly, spins up when clicked, its atmosphere glows on hover
    st.spinV += (0.05 - st.spinV) * damp(dt, 0.6);
    planetBody.current.rotation.y += st.spinV * dt;
    st.planetHover += ((st.planetHot ? 1 : 0) - st.planetHover) * damp(dt, 6);
    st.ringFlash = Math.max(0, st.ringFlash - dt * 1.2);
    planet.current.scale.setScalar(1 + st.planetHover * 0.04);
    giantMat.uniforms.uAccent.value.copy(st.cur);
    giantMat.uniforms.uGlow.value = 1 + st.planetHover * 0.8 + st.ringFlash;
    moonMat.uniforms.uAccent.value.copy(st.cur);
    ringMat.uniforms.uTint.value.copy(st.cur);
    ringMat.uniforms.uFlash.value = st.ringFlash;

    // moon: circles the planet on a tilted orbit, grows a little on hover
    st.moonA += dt * 0.22;
    moon.current.position.set(Math.cos(st.moonA) * 3.1, Math.sin(st.moonA) * 0.55, Math.sin(st.moonA) * 1.4);
    moon.current.rotation.y += dt * 0.15;
    const ms = moon.current.scale.x + ((st.moonHot ? 1.3 : 1) * MOON_R - moon.current.scale.x) * damp(dt, 8);
    moon.current.scale.setScalar(ms);

    // asteroids: drift slowly along the arc, tumbling; one that drifts off an end comes back in at the other
    const d = st.dummy;
    const rm = rocks.current;
    for (let i = 0; i < nRocks; i++) {
      const r = st.rocks[i];
      r.u = (r.u + dt * 0.0035 * (1 + r.lane * 0.4)) % 1;
      r.rot.x += r.spin * dt;
      r.rot.y += r.spin * 0.7 * dt;
      const ang = BELT.from + (BELT.to - BELT.from) * r.u;
      let s = r.s * Math.min(1, r.u / 0.06, (1 - r.u) / 0.06);
      if (now < r.deadUntil) s = 0;
      else if (now - r.deadUntil < 0.8) s *= THREE.MathUtils.smootherstep(now - r.deadUntil, 0, 0.8);
      if (i === st.rockHot) s *= 1.2;
      // the lanes lie one behind the other (deeper, lower), not wider: the belt never reaches the side plates
      d.position.set(Math.cos(ang) * BELT.rx, BELT.y - r.lane * 0.9 + Math.sin(t * 0.4 + i * 1.7) * 0.15, Math.sin(ang) * BELT.rz * (1 + r.lane * 0.15));
      d.rotation.copy(r.rot);
      d.scale.setScalar(s);
      d.updateMatrix();
      rm.setMatrixAt(i, d.matrix);
    }
    rm.instanceMatrix.needsUpdate = true;

    // shards fly apart, tumble and shrink away
    let alive = false;
    for (let i = 0; i < SHARD_POOL; i++) {
      const p = st.shards[i];
      const age = now - p.born;
      if (age > 1.3) {
        if (p.s !== 0) {
          p.s = 0;
          d.scale.setScalar(0);
          d.updateMatrix();
          shards.current.setMatrixAt(i, d.matrix);
        }
        continue;
      }
      alive = true;
      p.p.addScaledVector(p.v, dt);
      p.v.multiplyScalar(1 - dt * 0.8);
      p.rot.x += dt * 4;
      p.rot.z += dt * 3;
      d.position.copy(p.p);
      d.rotation.copy(p.rot);
      d.scale.setScalar(p.s * (1 - age / 1.3));
      d.updateMatrix();
      shards.current.setMatrixAt(i, d.matrix);
    }
    shards.current.visible = alive;
    shards.current.instanceMatrix.needsUpdate = true;

    // shooting stars: now and then on their own, or when the moon is clicked
    if (now > st.nextAuto) {
      launchStreak(now, false);
      st.nextAuto = now + (lite ? 11 : 6) + Math.random() * 6;
    }
    streakMat.color.copy(st.cur).lerp(st.white, 0.65);
    for (let i = 0; i < nStreaks; i++) {
      const m = streakMeshes.current[i];
      if (!m) continue;
      const s = st.streaks[i];
      const age = now - s.at;
      const on = age >= 0 && age < 1.4;
      m.visible = on;
      if (!on) continue;
      m.position.copy(s.from).addScaledVector(s.dir, age * 16);
      // lie along the direction of flight, facing the camera
      st.w.copy(s.dir).transformDirection(camera.matrixWorldInverse);
      m.quaternion.copy(camera.quaternion);
      m.rotateZ(Math.atan2(st.w.y, st.w.x));
      const k = Math.sin((age / 1.4) * Math.PI);
      m.scale.set(0.3 + k * 0.9, 1, 1);
    }
  });

  /* ---------- pointer handlers ---------- */
  /** lights up the asteroid under the pointer (-1: none) */
  const setRockHot = (id: number) => {
    if (id === st.rockHot) return;
    const m = rocks.current;
    if (st.rockHot >= 0) m.setColorAt(st.rockHot, st.white);
    if (st.rockHot < 0) hover(true);
    else if (id < 0) hover(false);
    st.rockHot = id;
    if (id >= 0) m.setColorAt(id, st.tmp.copy(st.cur).lerp(st.white, 0.4).multiplyScalar(1.8));
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  const planetEvents = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.planetHot = true; hover(true); },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.planetHot = false; hover(false); },
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); st.spinV = 3.5; st.ringFlash = 1; },
  };
  const moonEvents = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.moonHot = true; hover(true); },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.moonHot = false; hover(false); },
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); launchStreak(performance.now() / 1000, true); },
  };
  const rockEvents = {
    onPointerMove: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      const id = e.instanceId ?? -1;
      setRockHot(id >= 0 && performance.now() / 1000 >= st.rocks[id].deadUntil ? id : -1);
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setRockHot(-1);
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const id = e.instanceId;
      if (id === undefined) return;
      const r = st.rocks[id];
      const now = performance.now() / 1000;
      if (now < r.deadUntil) return;
      rocks.current.getMatrixAt(id, st.dummy.matrix);
      st.v.setFromMatrixPosition(st.dummy.matrix);
      for (let k = 0; k < SHARDS; k++) {
        const p = st.shards[st.nextShard];
        st.nextShard = (st.nextShard + 1) % SHARD_POOL;
        p.born = now;
        p.s = r.s * (0.7 + Math.random() * 0.6);
        p.p.copy(st.v);
        p.v.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 2);
        p.rot.set(Math.random() * 6, Math.random() * 6, 0);
      }
      r.deadUntil = now + 4;
      setRockHot(-1);
    },
  };

  return (
    <>
      {/* the ringed planet and its moon, pinned to a top corner of the screen (see ANCHOR) */}
      <group ref={system}>
        <group ref={planet} rotation={[0.38, 0, 0.42]}>
          <mesh ref={planetBody} material={giantMat} {...planetEvents}>
            <sphereGeometry args={[1, lite ? 40 : 64, lite ? 24 : 40]} />
          </mesh>
          {/* drawn before the shadow catcher (renderOrder 0), whose depth would otherwise hide it: the planet hangs below the table's level */}
          <mesh material={ringMat} rotation-x={-Math.PI / 2} renderOrder={-1}>
            <ringGeometry args={[1.35, 2.35, lite ? 72 : 128, 1]} />
          </mesh>
          <mesh ref={moon} material={moonMat} scale={MOON_R} {...moonEvents}>
            <sphereGeometry args={[1, 24, 16]} />
          </mesh>
        </group>
      </group>

      {/* asteroids and their shards */}
      {/* a portrait screen has hardly any open sky past the far plates: no belt there */}
      <instancedMesh ref={rocks} args={[rockGeo, undefined, nRocks]} visible={!portrait} {...rockEvents}>
        <meshLambertMaterial color="#6a6478" emissive="#0c0a14" flatShading />
      </instancedMesh>
      <instancedMesh ref={shards} args={[shardGeo, undefined, SHARD_POOL]} frustumCulled={false} visible={false}>
        <meshLambertMaterial color="#b8aec8" emissive="#3a2a40" flatShading />
      </instancedMesh>

      {/* shooting stars */}
      {Array.from({ length: nStreaks }, (_, i) => (
        <mesh key={i} ref={m => (streakMeshes.current[i] = m)} geometry={streakGeo} material={streakMat} visible={false} frustumCulled={false} />
      ))}
    </>
  );
}
