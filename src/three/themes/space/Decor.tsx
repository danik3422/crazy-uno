import { Stars } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { canvasTex } from '../decorKit';
import type { DecorProps } from '../types';
import { glowTex, planetTex, ringTex, streakTex } from './textures';

/*
 * Space: a ringed planet with a moon on its orbit, an asteroid belt, a little UFO and shooting stars,
 * over a star field. The camera looks down at the table, so everything hangs low over the far edge.
 * Interactive (all well away from the hand and the pile):
 *   planet — hover glows, click spins it up and flashes the ring;
 *   moon — hover grows, click launches a shooting star;
 *   asteroid — hover lights it, click shatters it into pieces (it reforms a few seconds later);
 *   UFO — hover brightens, click beams down and zips away, then comes back.
 */

const ROCKS = 12;
const ROCKS_LITE = 6;
const SHARDS = 8;
const SHARD_POOL = 24;
const STREAKS = 2;

/** asteroid home spots: a belt across the far edge and two clusters at the sides, clear of the plates */
const ROCK_SPOTS: [number, number, number, number][] = [
  [-7.0, 0.9, -9, 0.45], [-1.9, 0.7, -10, 0.38], [8.4, 0.3, -8, 0.5], [-10.9, 0.6, -9, 0.6],
  [10.3, 0.4, -7.5, 0.55], [1.6, 0.5, -10.5, 0.3], [-9.6, 0.3, -6.8, 0.4], [-5.0, 0.9, -11, 0.3],
  [11.8, 0.6, -10, 0.45], [-4.6, 0.25, -8.5, 0.28], [3.2, 0.9, -12, 0.35], [-13, 0.8, -11, 0.7],
];

const PLANET_AT = new THREE.Vector3(5.4, -0.55, -11);
const UFO_HOME = new THREE.Vector3(-3.5, 0.75, -7.5);

let hovering = 0;
function hover(on: boolean) {
  hovering = Math.max(0, hovering + (on ? 1 : -1));
  document.body.style.cursor = hovering ? 'pointer' : '';
}

/** a shared, crude rock: an icosahedron with its vertices pushed around a bit */
function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(0.5, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.4;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

interface Rock { home: THREE.Vector3; s: number; rot: THREE.Euler; spin: number; deadUntil: number; bornAt: number }
interface Shard { p: THREE.Vector3; v: THREE.Vector3; rot: THREE.Euler; born: number; s: number }
interface Streak { at: number; from: THREE.Vector3; dir: THREE.Vector3 }

export function Decor({ accent, portrait, lite }: DecorProps) {
  const nRocks = lite ? ROCKS_LITE : ROCKS;
  const nStreaks = lite ? 1 : STREAKS;

  const planet = useRef<THREE.Group>(null!);
  const planetBody = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const atmo = useRef<THREE.Sprite>(null!);
  const atmoMat = useRef<THREE.SpriteMaterial>(null!);
  const moon = useRef<THREE.Mesh>(null!);
  const rocks = useRef<THREE.InstancedMesh>(null!);
  const shards = useRef<THREE.InstancedMesh>(null!);
  const ufo = useRef<THREE.Group>(null!);
  const ufoLights = useRef<THREE.MeshBasicMaterial>(null!);
  const beam = useRef<THREE.Mesh>(null!);
  const beamMat = useRef<THREE.MeshBasicMaterial>(null!);
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
      spinV: 0.06,
      planetHover: 0,
      planetHot: false,
      ringFlash: 0,
      moonHot: false,
      moonA: 0,
      rockHot: -1,
      rocks: ROCK_SPOTS.slice(0, ROCKS).map(([x, y, z, s], i): Rock => ({
        home: new THREE.Vector3(x, y, z),
        s,
        rot: new THREE.Euler(i, i * 2.1, i * 0.7),
        spin: 0.15 + (i % 4) * 0.08,
        deadUntil: 0,
        bornAt: -10,
      })),
      shards: Array.from({ length: SHARD_POOL }, (): Shard => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), rot: new THREE.Euler(), born: -10, s: 0 })),
      nextShard: 0,
      ufoHot: false,
      ufoBeamAt: -10,
      ufoAway: -10,
      ufoPos: UFO_HOME.clone(),
      streaks: Array.from({ length: STREAKS }, (): Streak => ({ at: -10, from: new THREE.Vector3(), dir: new THREE.Vector3() })),
      nextAuto: now + 3,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rockGeo = useMemo(rockGeometry, []);
  const shardGeo = useMemo(() => new THREE.TetrahedronGeometry(0.22, 0), []);
  const streakGeo = useMemo(() => new THREE.PlaneGeometry(3.2, 0.14), []);
  const pTex = useMemo(planetTex, []);
  const rTex = useMemo(ringTex, []);
  const gTex = useMemo(glowTex, []);
  const sTex = useMemo(streakTex, []);
  const streakMat = useMemo(
    () => new THREE.MeshBasicMaterial({ map: sTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    [sTex],
  );
  const moonTex = useMemo(
    () =>
      canvasTex(128, 64, c => {
        c.fillStyle = '#b8bccb';
        c.fillRect(0, 0, 128, 64);
        for (let i = 0; i < 26; i++) {
          c.fillStyle = `rgba(70,74,96,${0.2 + (i % 5) * 0.08})`;
          c.beginPath();
          c.arc((i * 47) % 128, (i * 29) % 64, 2 + (i % 4) * 2, 0, Math.PI * 2);
          c.fill();
        }
      }),
    [],
  );

  useEffect(() => () => {
    hovering = 0;
    document.body.style.cursor = '';
  }, []);

  // the hidden rock instances start out of sight
  useEffect(() => {
    const d = st.dummy;
    d.scale.setScalar(0);
    d.updateMatrix();
    for (let i = 0; i < SHARD_POOL; i++) shards.current.setMatrixAt(i, d.matrix);
    shards.current.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < nRocks; i++) rocks.current.setColorAt(i, st.white);
    if (rocks.current.instanceColor) rocks.current.instanceColor.needsUpdate = true;
  }, [st, nRocks]);

  const launchStreak = (now: number, fromMoon: boolean) => {
    const s = st.streaks.find(x => now - x.at > 1.3);
    if (!s || st.streaks.indexOf(s) >= nStreaks) return;
    s.at = now;
    const left = fromMoon ? true : Math.random() < 0.5;
    if (fromMoon && moon.current) moon.current.getWorldPosition(s.from);
    else s.from.set(left ? -15 + Math.random() * 6 : 9 + Math.random() * 6, 0.25 + Math.random() * 0.45, -11 - Math.random() * 2);
    s.dir.set(left ? 1 : -1, -0.015 - Math.random() * 0.02, 0).normalize();
    if (fromMoon) s.dir.set(-1, 0.02, 0).normalize();
  };

  useFrame((state, dt) => {
    const now = performance.now() / 1000;
    const t = state.clock.elapsedTime;
    dt = Math.min(dt, 0.1);

    // the accent colour eases in
    st.cur.lerp(st.target.set(accent), Math.min(1, dt * 2));

    // planet: spins, spins up when clicked, glows on hover
    st.spinV += (0.06 - st.spinV) * Math.min(1, dt * 0.6);
    planetBody.current.rotation.y += st.spinV * dt;
    st.planetHover += ((st.planetHot ? 1 : 0) - st.planetHover) * Math.min(1, dt * 6);
    st.ringFlash = Math.max(0, st.ringFlash - dt * 1.2);
    planet.current.scale.setScalar(1 + st.planetHover * 0.05);
    ringMat.current.color.copy(st.cur).lerp(st.white, 0.25 + st.ringFlash * 0.6);
    ringMat.current.opacity = 0.75 + st.ringFlash * 0.25;
    atmoMat.current.color.copy(st.cur);
    atmoMat.current.opacity = 0.42 + st.planetHover * 0.35 + st.ringFlash * 0.4;

    // moon: circles the planet, grows a little on hover
    st.moonA += dt * 0.35;
    moon.current.position.set(Math.cos(st.moonA) * 3.4, Math.sin(st.moonA) * 0.5, Math.sin(st.moonA) * 1.6);
    moon.current.rotation.y += dt * 0.2;
    const ms = moon.current.scale.x + ((st.moonHot ? 1.35 : 1) - moon.current.scale.x) * Math.min(1, dt * 8);
    moon.current.scale.setScalar(ms);

    // asteroids: tumble and bob; a shattered one reforms after a while
    const d = st.dummy;
    const rm = rocks.current;
    for (let i = 0; i < nRocks; i++) {
      const r = st.rocks[i];
      r.rot.x += r.spin * dt;
      r.rot.y += r.spin * 0.7 * dt;
      let s = r.s;
      if (now < r.deadUntil) s = 0;
      else if (now - r.deadUntil < 0.6) s *= THREE.MathUtils.smootherstep(now - r.deadUntil, 0, 0.6);
      if (i === st.rockHot) s *= 1.25;
      d.position.set(r.home.x * (portrait ? 0.6 : 1) + Math.sin(t * 0.13 + i) * 0.35, r.home.y + Math.sin(t * 0.5 + i * 1.7) * 0.12, r.home.z * (portrait ? 0.75 : 1));
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
      p.v.y -= dt * 0.8;
      p.p.addScaledVector(p.v, dt);
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

    // UFO: drifts lazily; when clicked it beams down, then zips off and comes back from the other side
    const u = ufo.current;
    const sinceBeam = now - st.ufoBeamAt;
    const awayFor = now - st.ufoAway;
    const hx = (portrait ? 0.6 : 1) * UFO_HOME.x + Math.sin(t * 0.31) * 1.1;
    const hy = UFO_HOME.y + Math.sin(t * 0.9) * 0.12;
    const hz = UFO_HOME.z + Math.cos(t * 0.31) * 0.5;
    if (awayFor >= 0 && awayFor < 5) {
      // off it goes: up and away, then glides back in
      const k = awayFor < 0.9 ? Math.pow(awayFor / 0.9, 2) : awayFor > 3.6 ? 1 - THREE.MathUtils.smootherstep(awayFor, 3.6, 5) : 1;
      u.position.set(hx - k * 12, hy + k * 3, hz - k * 6);
    } else u.position.set(hx, hy, hz);
    u.rotation.y += dt * (1.2 + (awayFor >= 0 && awayFor < 1 ? 10 : 0));
    u.rotation.z = Math.sin(t * 0.9) * 0.08;
    const us = u.scale.x + ((st.ufoHot ? 1.18 : 1) - u.scale.x) * Math.min(1, dt * 8);
    u.scale.setScalar(us);
    ufoLights.current.color.copy(st.cur).lerp(st.white, st.ufoHot ? 0.5 : 0.15 + 0.15 * Math.sin(t * 6));
    const beamOn = sinceBeam >= 0 && sinceBeam < 0.7;
    beam.current.visible = beamOn;
    if (beamOn) {
      beamMat.current.color.copy(st.cur).lerp(st.white, 0.3);
      beamMat.current.opacity = 0.55 * Math.sin((sinceBeam / 0.7) * Math.PI);
      beam.current.scale.set(1, 0.3 + 0.7 * Math.min(1, sinceBeam * 6), 1);
    }

    // shooting stars: now and then on their own, or when the moon is clicked
    if (now > st.nextAuto) {
      launchStreak(now, false);
      st.nextAuto = now + (lite ? 9 : 5) + Math.random() * 5;
    }
    streakMat.color.copy(st.cur).lerp(st.white, 0.6);
    for (let i = 0; i < nStreaks; i++) {
      const m = streakMeshes.current[i];
      if (!m) continue;
      const s = st.streaks[i];
      const age = now - s.at;
      const on = age >= 0 && age < 1.2;
      m.visible = on;
      if (!on) continue;
      m.position.copy(s.from).addScaledVector(s.dir, age * 15);
      m.rotation.z = Math.atan2(s.dir.y, s.dir.x);
      const k = Math.sin((age / 1.2) * Math.PI);
      m.scale.set(0.4 + k * 0.8, 1, 1);
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
    onClick: (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); st.spinV = 4.5; st.ringFlash = 1; },
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
        p.v.set(Math.random() - 0.5, Math.random() * 0.7 + 0.1, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 2);
        p.rot.set(Math.random() * 6, Math.random() * 6, 0);
      }
      r.deadUntil = now + 3.5;
      setRockHot(-1);
    },
  };
  const ufoEvents = {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.ufoHot = true; hover(true); },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); st.ufoHot = false; hover(false); },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      const now = performance.now() / 1000;
      if (now - st.ufoAway < 5 || now - st.ufoBeamAt < 0.7) return;
      st.ufoBeamAt = now;
      st.ufoAway = now + 0.6;
    },
  };

  const px = portrait ? 0.55 : 1;
  const pz = portrait ? 0.75 : 1;

  return (
    <>
      <Stars radius={70} depth={30} count={lite ? 700 : 2200} factor={4} saturation={0.15} fade speed={0.6} />

      {/* the ringed planet */}
      <group position={[PLANET_AT.x * px, PLANET_AT.y, PLANET_AT.z * pz]} scale={portrait ? 0.7 : 1}>
        <sprite ref={atmo} scale={5.2} renderOrder={-1}>
          <spriteMaterial ref={atmoMat} map={gTex} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
        <group ref={planet} rotation={[0.3, 0, 0.32]}>
          <mesh ref={planetBody} {...planetEvents}>
            <sphereGeometry args={[1.5, lite ? 24 : 32, lite ? 16 : 24]} />
            <meshLambertMaterial map={pTex} emissive="#3a1030" emissiveIntensity={0.6} />
          </mesh>
          <mesh rotation-x={Math.PI / 2.15}>
            <ringGeometry args={[1.9, 3.1, lite ? 48 : 72, 1]} />
            <meshBasicMaterial ref={ringMat} map={rTex} transparent side={THREE.DoubleSide} toneMapped={false} depthWrite={false} />
          </mesh>
          <mesh ref={moon} {...moonEvents}>
            <sphereGeometry args={[0.36, 16, 12]} />
            <meshLambertMaterial map={moonTex} emissive="#2a3050" emissiveIntensity={0.5} />
          </mesh>
        </group>
      </group>

      {/* asteroids and their shards */}
      <instancedMesh ref={rocks} args={[rockGeo, undefined, nRocks]} {...rockEvents}>
        <meshLambertMaterial color="#7a7286" emissive="#120e1c" flatShading />
      </instancedMesh>
      <instancedMesh ref={shards} args={[shardGeo, undefined, SHARD_POOL]} frustumCulled={false} visible={false}>
        <meshLambertMaterial color="#b8aec8" emissive="#3a2a40" flatShading />
      </instancedMesh>

      {/* the UFO */}
      <group ref={ufo} position={UFO_HOME} {...ufoEvents}>
        <mesh scale={[1, 0.26, 1]}>
          <sphereGeometry args={[0.85, 24, 10]} />
          <meshLambertMaterial color="#b9c2da" emissive="#2a3050" />
        </mesh>
        <mesh position-y={0.12}>
          <sphereGeometry args={[0.38, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshBasicMaterial color="#8ff0ff" transparent opacity={0.75} toneMapped={false} />
        </mesh>
        <mesh rotation-x={Math.PI / 2}>
          <torusGeometry args={[0.82, 0.05, 6, 28]} />
          <meshBasicMaterial ref={ufoLights} toneMapped={false} />
        </mesh>
        <mesh ref={beam} position-y={-1.1} visible={false}>
          <cylinderGeometry args={[0.25, 1.1, 2.2, 20, 1, true]} />
          <meshBasicMaterial ref={beamMat} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      </group>

      {/* shooting stars */}
      {Array.from({ length: nStreaks }, (_, i) => (
        <mesh key={i} ref={m => (streakMeshes.current[i] = m)} geometry={streakGeo} material={streakMat} visible={false} />
      ))}
    </>
  );
}
