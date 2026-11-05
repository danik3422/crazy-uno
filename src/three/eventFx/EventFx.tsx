import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sound } from '../../audio/sound';
import { HEX } from '../../game/content';
import type { ThemeId } from '../../game/types';
import type { GameView } from '../../game/view';
import { isPhone } from '../../ui/hooks/phone';
import { cardFaceGeometry } from '../cardShape';
import { CELL_ID } from '../cardFx/atlas';
import { CardPool, Kit, QuadPool, type Spot } from '../cardFx/kit';
import { raw, rnd } from '../cardFx/shapes';
import { BOMB_FALL, DEBUG, METEOR_FALL, fxState, nowSec, shake } from '../fxState';
import { arena, seatPos, type View } from '../layout';
import { THEMES } from '../themes';
import { eventLook } from './look';
import * as scene from './scenes';
import type { Run } from './scenes';

/**
 * Every random event on the table, in the table's own style (see look.ts): the meteor, the lightning,
 * the jackpot fountain, the bomber's blast, the colour wave, the carousel, the fog of the blind round…
 *
 * Quads (glows, rings, smoke, icons) go through three pooled instanced meshes like the card effects;
 * the bolt, the coins and the bomb are a few meshes made once. Everything is hidden when idle, so an idle
 * table draws nothing extra, and nothing is allocated per frame.
 */

/** where an effect aimed at player i happens: in front of their cards (for you: just above your hand) */
function seatSpot(game: GameView, i: number, view: View, out: Spot) {
  if (i === game.seat()) {
    const A = arena(view);
    out.x = 0;
    out.y = 0.2;
    out.z = A.hand.z - (view.portrait ? 2.3 : 1.6);
    return out;
  }
  const [x, , z] = seatPos(game, i, view);
  out.x = x * 0.88;
  out.y = 0.2;
  out.z = z * 0.88;
  return out;
}

const COINS_MAX = 60;
const BOLT_TOP = 12;

/** a jagged bolt from the sky down to (0, 0, 0) with two side branches, as one core and one glow geometry */
function boltGeometry(seed: number) {
  const main: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const k = 1 - i / 10;
    const j = i === 10 ? 0 : 0.5 + k * 0.5;
    main.push(new THREE.Vector3((rnd(seed, i) - 0.5) * 1.3 * j, BOLT_TOP - i * (BOLT_TOP / 10), (rnd(seed, i + 20) - 0.5) * 1.3 * j));
  }
  const curves = [new THREE.CatmullRomCurve3(main, false, 'catmullrom', 0.1)];
  for (const b of [3, 6]) {
    const pts = [main[b].clone()];
    const ang = rnd(seed, b + 40) * Math.PI * 2;
    for (let i = 1; i <= 4; i++) {
      const p = pts[i - 1];
      pts.push(new THREE.Vector3(p.x + Math.cos(ang) * 0.55 + (rnd(seed, b * 9 + i) - 0.5) * 0.5, p.y - 0.75, p.z + Math.sin(ang) * 0.4));
    }
    curves.push(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1));
  }
  const tube = (r: number, rb: number) =>
    mergeGeometries(curves.map((c, i) => new THREE.TubeGeometry(c, i ? 16 : 70, i ? rb : r, 6)));
  return { core: tube(0.055, 0.03), glow: tube(0.22, 0.12) };
}

interface Props {
  game: GameView;
  view: View;
  theme: ThemeId;
}

export function EventFx({ game, view, theme }: Props) {
  const lite = useMemo(() => isPhone(), []);
  const look = useMemo(() => eventLook(THEMES[theme].events), [theme]);
  const P = useMemo(() => scene.palOf(look), [look]);
  const camera = useThree(s => s.camera);

  const kit = useMemo(() => {
    const glow = new QuadPool(lite ? 150 : 280, true, 12);
    const solid = new QuadPool(lite ? 70 : 120, false, 11, true);
    const icons = new QuadPool(lite ? 16 : 24, false, 13);
    // (the kit's card pool stays empty: events fly no cards)
    const k = new Kit(glow, solid, icons, new CardPool(cardFaceGeometry(), 1), []);
    k.lite = lite;
    for (const m of [glow.mesh, solid.mesh, icons.mesh]) m.userData.fit = 'fx';
    return k;
  }, [lite]);

  // the bolt: a few jagged shapes made once (one is picked per strike), or a straight beam of light
  const bolts = useMemo(() => [11, 23, 37].map(boltGeometry), []);
  const beam = useMemo(() => ({ core: new THREE.CylinderGeometry(0.1, 0.16, BOLT_TOP, 12, 1, true).translate(0, BOLT_TOP / 2, 0), glow: new THREE.CylinderGeometry(0.42, 0.7, BOLT_TOP, 16, 1, true).translate(0, BOLT_TOP / 2, 0) }), []);
  useEffect(
    () => () => {
      for (const b of [...bolts, beam]) {
        b.core.dispose();
        b.glow.dispose();
      }
    },
    [bolts, beam],
  );
  const boltCore = useRef<THREE.Mesh>(null!);
  const boltGlow = useRef<THREE.Mesh>(null!);
  const coreMat = useRef<THREE.MeshBasicMaterial>(null!);
  const glowMat = useRef<THREE.MeshBasicMaterial>(null!);
  const coins = useRef<THREE.InstancedMesh>(null!);
  const coinMat = useRef<THREE.MeshStandardMaterial>(null!);
  const bomb = useRef<THREE.Group>(null!);
  const light = useRef<THREE.PointLight>(null!);
  const lightColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    coreMat.current.color.set(look.bolt.core);
    glowMat.current.color.set(look.bolt.glow);
    coinMat.current.color.set(look.coin.color);
    coinMat.current.emissive.set(look.coin.emissive);
    lightColor.set(look.light);
  }, [look, lightColor]);

  const coinN = lite ? 30 : COINS_MAX;
  const coinData = useMemo(
    () =>
      Array.from({ length: COINS_MAX }, (_, i) => ({
        delay: rnd(5, i) * 0.4,
        a: rnd(6, i) * Math.PI * 2,
        v: 0.9 + rnd(7, i) * 1.6,
        up: 6 + rnd(8, i) * 3,
        spin: 8 + rnd(9, i) * 14,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const run = useRef<Run & { seq: number; id: string | null; at: number; bolt: number; boomed: number }>({
    seq: -1,
    id: null,
    at: -100,
    bolt: 0,
    boomed: -1,
    seed: 1,
    target: { x: 0, y: 0.2, z: 0 },
    other: { x: 0, y: 0.2, z: 0 },
    hasOther: false,
    pile: { x: 0, y: 0.1, z: 0 },
    seats: Array.from({ length: 12 }, () => ({ x: 0, y: 0.2, z: 0 })),
    nSeats: 0,
    rx: 6,
    rz: 3.5,
    dir: 1,
    color: new THREE.Color(),
  });
  const from = useMemo<Spot>(() => ({ x: 0, y: 0, z: 0 }), []);
  const bombTo = useMemo<Spot>(() => ({ x: 0, y: 0, z: 0 }), []);
  const vel = useMemo(() => new THREE.Vector3(), []);
  const look3 = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const now = nowSec();
    const r = run.current;
    const ev = fxState.event;
    const s = game.s;
    // a new event: work out where everything happens, once
    if (ev.seq !== r.seq) {
      r.seq = ev.seq;
      r.id = ev.id;
      r.at = ev.at;
      r.seed = (ev.seq * 7.31) % 97;
      const A = arena(view);
      r.pile.x = A.discard[0];
      r.pile.z = A.discard[2];
      r.rx = A.rx;
      r.rz = A.rz;
      r.dir = s.dir;
      // only the players still in the game: the knocked-out ones get no effects
      r.nSeats = 0;
      for (let i = 0; i < s.players.length && r.nSeats < r.seats.length; i++) {
        if (!s.players[i].out) seatSpot(game, i, view, r.seats[r.nSeats++]);
      }
      const ti = Math.min(Math.max(0, ev.target), s.players.length - 1);
      seatSpot(game, ti, view, r.target);
      // Robin Hood: the cards went to whoever has the most now
      let most = -1;
      for (let i = 0; i < s.players.length; i++) {
        const p = s.players[i];
        if (i !== ti && !p.out && (most < 0 || p.hand.length > s.players[most].hand.length)) most = i;
      }
      r.hasOther = ev.id === 'robin' && most >= 0 && s.players[most].hand.length > s.players[ti].hand.length;
      if (r.hasOther) seatSpot(game, most, view, r.other);
      raw(HEX[s.color], r.color);
      r.bolt = ev.seq % bolts.length;
    }

    kit.begin();
    const viewM = camera.matrixWorldInverse;
    let li = 0;
    const lp = look3;
    const t = now - r.at;
    if (t > -0.1 && t < 3.5) {
      scene.arrival(kit, r, t, P);
      switch (r.id) {
        case 'recolor':
        case 'mono':
          scene.recolor(kit, r, t, P, look, r.id === 'mono');
          break;
        case 'carousel':
          scene.carousel(kit, r, t, P, look, viewM);
          break;
        case 'upside':
          scene.upside(kit, r, t, P);
          break;
        case 'blind':
          scene.blind(kit, r, t, P);
          break;
        case 'blitz':
          scene.blitz(kit, r, t, P);
          break;
        case 'robin':
          scene.robin(kit, r, t, P, viewM);
          break;
        case 'group':
          scene.group(kit, r, t, P);
          break;
        case 'coin':
          scene.coin(kit, r, t, P);
          break;
      }
    }

    // meteor: the fall starts at meteor.at, the hit METEOR_FALL later
    const tm = now - fxState.meteor.at;
    if (tm > -0.7 && tm < METEOR_FALL + 1.9) {
      const m = look.meteor;
      const s0 = r.target;
      // it comes in from the outer side of its target (never from behind the event card in the middle)
      // (aimed at you, it swings in wide from the left, in full view under the card)
      const side = s0.x > 0.5 ? 1 : -1;
      const wide = Math.abs(s0.x) < 0.5 ? 1.6 : 1;
      const ox = m.beam ? 0 : side * (m.head === null ? 7 : 4.5) * wide;
      const oz = m.beam ? -0.4 : m.head === null ? -8 : -6;
      from.x = s0.x + ox;
      from.y = s0.y + (m.beam ? 13 : 12);
      from.z = s0.z + oz;
      const h = scene.meteor(kit, r, tm, METEOR_FALL, from, P, look, viewM);
      if (h) {
        li = 28;
        lp.set(h.x, h.y, h.z);
      } else if (tm >= METEOR_FALL) {
        li = 130 * Math.max(0, 1 - (tm - METEOR_FALL) / 0.6);
        lp.set(s0.x, 1.2, s0.z);
      }
    }

    // lightning: struck at lightning.at
    const tl = now - fxState.lightning.at;
    const striking = tl >= 0 && tl < 0.62;
    boltCore.current.visible = boltGlow.current.visible = striking;
    if (tl > -0.6 && tl < 2) {
      scene.lightning(kit, r, tl, P, look);
      if (striking) {
        const geo = look.bolt.beam ? beam : bolts[r.bolt];
        if (boltCore.current.geometry !== geo.core) {
          boltCore.current.geometry = geo.core;
          boltGlow.current.geometry = geo.glow;
        }
        const s0 = r.target;
        boltCore.current.position.set(s0.x, 0, s0.z);
        boltGlow.current.position.set(s0.x, 0, s0.z);
        const flick = Math.sin(tl * 70) > -0.3 ? 1 : 0.25;
        const fadeOut = 1 - Math.max(0, tl - 0.35) / 0.27;
        coreMat.current.opacity = flick * fadeOut;
        glowMat.current.opacity = 0.45 * flick * fadeOut;
        // the beam breathes, the bolt stays sharp
        const w = look.bolt.beam ? 0.6 + Math.min(1, tl / 0.08) * 0.4 + Math.sin(tl * 40) * 0.08 : 1;
        boltCore.current.scale.set(w, 1, w);
        boltGlow.current.scale.set(w, 1, w);
        li = 100 * flick * fadeOut;
        lp.set(s0.x, 1.5, s0.z);
      }
    }

    // jackpot: the coin fountain
    const tb = now - fxState.burst.at;
    const coinsOn = tb >= 0 && tb < 2.1;
    coins.current.visible = coinsOn;
    if (tb > -0.5 && tb < 2.1) scene.jackpot(kit, r, tb, P);
    if (coinsOn) {
      const o = r.target;
      for (let i = 0; i < coinN; i++) {
        const c = coinData[i];
        const tt = tb - c.delay;
        if (tt < 0) {
          dummy.scale.setScalar(0);
        } else {
          const y = o.y + 0.3 + c.up * tt - 7 * tt * tt;
          const landed = y < 0.06;
          dummy.position.set(o.x + Math.cos(c.a) * c.v * tt, Math.max(0.06, y), o.z + Math.sin(c.a) * c.v * tt * 0.8);
          dummy.rotation.set(landed ? 0 : c.spin * tt, c.a, landed ? 0 : c.spin * tt * 0.4);
          const out = Math.min(1, Math.max(0, (2.1 - tb) / 0.35));
          dummy.scale.setScalar(Math.min(1, tt / 0.12) * out * (landed ? 0.85 : 1));
        }
        dummy.updateMatrix();
        coins.current.setMatrixAt(i, dummy.matrix);
      }
      coins.current.count = coinN;
      coins.current.instanceMatrix.needsUpdate = true;
      if (li < 20) {
        li = 40 * Math.max(0, 1 - tb / 2);
        lp.set(o.x, 2, o.z);
      }
    }

    // the bomber's bomb: falls from the plane, then blows up in the table's colours
    const b = fxState.bombFall;
    const te = now - b.at;
    const falling = te >= 0 && te < BOMB_FALL;
    bomb.current.visible = falling;
    const [fx, fy, fz] = b.from;
    const [tx, ty, tz] = b.to;
    if (falling) {
      const p = te / BOMB_FALL;
      bomb.current.position.set(fx + (tx - fx) * p, fy + (ty - fy) * p * p, fz + (tz - fz) * p);
      vel.set(tx - fx, (ty - fy) * 2 * p, tz - fz);
      look3.copy(bomb.current.position).add(vel);
      bomb.current.lookAt(look3);
      bomb.current.rotateZ(te * 14);
      const bp = bomb.current.position;
      // the lit fuse
      kit.g(CELL_ID.glow, bp.x, bp.y + 0.25, bp.z, 0.6, 0, false, P.hot, 0.6);
      kit.g(CELL_ID.spark, bp.x, bp.y + 0.25, bp.z, 0.45, te * 20, false, P.sparks[0], 1);
    }
    const e = te - BOMB_FALL;
    if (e >= 0 && r.boomed !== b.at) {
      r.boomed = b.at;
      shake(1.0, 0.7);
      sound.play('boom');
    }
    if (e > -0.6 && e < 1.9) {
      bombTo.x = tx;
      bombTo.y = ty;
      bombTo.z = tz;
      if (e < 0) scene.aim(kit, bombTo, e + 0.6, 0.6, P.hot, P.dark);
      scene.impact(kit, bombTo, e, P, look, 31, 0.85);
      if (e >= 0 && e < 0.6) {
        li = Math.max(li, 100 * (1 - e / 0.6));
        lp.set(tx, ty + 1, tz);
      }
    }

    kit.end();
    if (DEBUG) {
      // draw calls the events add this frame (read by the e2e checks)
      let calls = 0;
      for (const o of [kit.glow.mesh, kit.solid.mesh, kit.icons.mesh, boltCore.current, boltGlow.current, coins.current]) if (o.visible) calls++;
      if (bomb.current.visible) calls += 2;
      (window as unknown as { __eventCalls?: number }).__eventCalls = calls;
    }
    light.current.intensity = li;
    if (li > 0) {
      light.current.position.copy(lp);
      light.current.color.copy(lightColor);
    }
  });

  return (
    <>
      <primitive object={kit.solid.mesh} />
      <primitive object={kit.glow.mesh} />
      <primitive object={kit.icons.mesh} />
      <mesh ref={boltGlow} geometry={bolts[0].glow} visible={false} frustumCulled={false} renderOrder={12}>
        <meshBasicMaterial ref={glowMat} transparent toneMapped={false} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={boltCore} geometry={bolts[0].core} visible={false} frustumCulled={false} renderOrder={12}>
        <meshBasicMaterial ref={coreMat} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <instancedMesh ref={coins} args={[undefined, undefined, COINS_MAX]} visible={false} frustumCulled={false}>
        <cylinderGeometry args={[0.15, 0.15, 0.035, 18]} />
        <meshStandardMaterial ref={coinMat} metalness={0.85} roughness={0.25} emissiveIntensity={0.55} />
      </instancedMesh>
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
      {/* one light for every event; it stays in the scene (the number of lights must never change, see Bomb in Scene.tsx) */}
      <pointLight ref={light} distance={14} intensity={0} />
    </>
  );
}
