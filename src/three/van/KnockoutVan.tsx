import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { avatarUrl } from '../../art/avatarArt';
import { sound } from '../../audio/sound';
import { avatarOf } from '../../game/avatars';
import type { GameView } from '../../game/view';
import { debugValue, exposeDebug } from '../../lib/debug';
import { nowSec } from '../effects/fxState';
import type { View } from '../layout';
import { BigGuy, DOOR_W, DOOR_X, Van, VAN_D, Victim, WHEEL_R, limbs, makePrint } from './models';
import { ARRIVE, DOOR_T, add, along, clamp01, hold, lerp2, plan, road, roadAt, sideOf, smooth, span, type P2, type Run } from './plan';

/*
 * No Mercy knock-out: an olive van pulls up behind the player, two big guys in uniform come out and take the
 * player away, one of six ways (see van/plan), and it drives off. It starts from the game state (the moment the
 * player is out) and every choice in it follows from that state, so everyone at the table sees the same scene
 * at the same time.
 */

const WALK = 2.5;
const PI = Math.PI;
/** shortest turn from angle a to b */
const turn = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
/** a figure faces its local +z: the yaw that points it along `d` */
const yawOf = (d: P2) => Math.atan2(d[0], d[1]);
const toward = (from: P2, to: P2) => yawOf([to[0] - from[0], to[1] - from[1]]);
const backOut = (x: number) => {
  const c = 1.9;
  return x <= 0 ? 0 : x >= 1 ? 1 : 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2;
};
/** along a path, and backwards past its start in the first segment's line (for whoever trails behind the lead) */
function alongExt(path: P2[], dist: number) {
  if (dist >= 0) return along(path, dist);
  const first = along(path, 0);
  return { p: add(first.p, first.dir, dist), dir: first.dir, done: false };
}

interface Guy {
  p: P2;
  y: number;
  face: number;
  moving: boolean;
  /** walking rhythm (radians) */
  phase: number;
  /** 0..1 lying flat on his front (a dive) */
  prone: number;
  /** arms forward (negative) or back (positive), or null to swing them */
  arms: number | null;
  tiptoe: boolean;
  shown: boolean;
}

export function KnockoutVan({ game, version, view }: { game: GameView; version: number; view: View }) {
  const root = useRef<THREE.Group>(null!);
  const vanAt = useRef<THREE.Group>(null!);
  const van = useRef<THREE.Group>(null!);
  const door = useRef<THREE.Group>(null!);
  const wheels = useRef<THREE.Group>(null!);
  const a = useRef<THREE.Group>(null!);
  const b = useRef<THREE.Group>(null!);
  const victim = useRef<THREE.Group>(null!);
  const face = useRef<THREE.MeshBasicMaterial>(null!);
  const body = useRef<THREE.MeshStandardMaterial>(null!);
  const printNear = useRef<THREE.MeshBasicMaterial>(null!);
  const printFar = useRef<THREE.MeshBasicMaterial>(null!);
  const printDoor = useRef<THREE.MeshBasicMaterial>(null!);
  const print = useMemo(() => makePrint(), []);
  const queue = useRef<{ seat: number; tex: THREE.Texture | null; bg: string }[]>([]);
  const run = useRef<Run | null>(null);
  const seen = useRef<{ game: GameView | null; outs: boolean[] }>({ game: null, outs: [] });
  const sfx = useRef(0);
  const yaw = useRef([0, 0]);
  const loader = useMemo(() => new THREE.TextureLoader(), []);
  const ctx = useRef({ game, view });
  ctx.current = { game, view };

  // a player who just went out: their van is on its way (anyone already out when the table opened is not)
  useEffect(() => {
    const s = game.s;
    const outs = s.players.map(p => !!p.out);
    if (seen.current.game !== game) {
      seen.current = { game, outs };
      return;
    }
    const before = seen.current.outs;
    seen.current.outs = outs;
    outs.forEach((out, i) => {
      if (!out || before[i]) return;
      const p = s.players[i];
      const av = avatarOf(p.avatar, p.name, p.bot);
      let tex: THREE.Texture | null = null;
      try {
        tex = loader.load(avatarUrl(av.id, 128));
        tex.colorSpace = THREE.SRGBColorSpace;
      } catch {
        tex = null;
      }
      queue.current.push({ seat: i, tex, bg: av.bg[0] });
    });
  }, [game, version, loader]);

  useFrame((_, dt) => {
    const now = nowSec();
    // debug: window.__vanT pins the scene at that second (for stills)
    const pin = debugValue<number>('__vanT');
    let r = run.current;
    if (r && (typeof pin === 'number' ? pin : now - r.at) > r.tGone) {
      r.tex?.dispose();
      r = run.current = null;
    }
    if (!r && queue.current.length) {
      const q = queue.current.shift()!;
      r = run.current = plan(ctx.current.game, ctx.current.view, q.seat, now, q.tex, q.bg);
      sfx.current = 0;
      face.current.map = q.tex;
      face.current.needsUpdate = true;
      body.current.color.set(q.bg);
      // a van flipped to drive the other way mirrors its print: show the mirrored picture so it reads right
      const pr = r.mirror ? print.flipped : print.normal;
      printNear.current.map = pr.full;
      printFar.current.map = pr.full;
      printDoor.current.map = pr.door;
      for (const m of [printNear.current, printFar.current, printDoor.current]) m.needsUpdate = true;
      const f = yawOf([-r.o[0], -r.o[1]]);
      yaw.current = [f, f];
    }
    root.current.visible = !!r;
    if (!r) return;
    const t = typeof pin === 'number' ? pin : now - r.at;
    exposeDebug('__van', r);
    const { k, o, variant } = r;
    const pc = r.pounce;

    const cue = (n: number, when: number, play: () => void) => {
      if (sfx.current < n && t >= when) {
        sfx.current = n;
        play();
      }
    };
    cue(1, 0.25, () => sound.play('whoosh'));
    cue(2, ARRIVE + 0.1, () => sound.play('click'));
    if (pc) cue(3, pc.tLand, () => sound.play('stack'));
    cue(4, r.tClose + DOOR_T * 0.8, () => sound.play('click'));
    cue(5, r.tLeave, () => sound.play('whoosh'));

    // ---- the van: along its bent road, nose first; leans back when it pulls away, dips when it brakes
    const s = roadAt(r, t);
    const h = 1 / 60;
    const v = (roadAt(r, t + h) - roadAt(r, t - h)) / (2 * h);
    const acc = (roadAt(r, t + h) - 2 * s + roadAt(r, t - h)) / (h * h);
    const at = road(r, s);
    vanAt.current.position.set(at.x, 0, at.z);
    vanAt.current.rotation.y = at.yaw;
    vanAt.current.scale.set(r.mirror ? -k : k, k, k);
    const settle = t > ARRIVE ? Math.exp(-(t - ARRIVE) * 5) * Math.sin((t - ARRIVE) * 13) * 0.035 : 0;
    const going = Math.min(1, Math.abs(v) / 4);
    van.current.rotation.z = THREE.MathUtils.clamp(-acc * 0.006, -0.07, 0.07) + settle;
    van.current.rotation.x = Math.sin(t * 17) * 0.008 * going;
    van.current.position.y = Math.abs(Math.sin(t * 21)) * 0.025 * going;
    for (const w of wheels.current.children) w.rotation.z = s / (WHEEL_R * k);
    const tOpen = ARRIVE + 0.1;
    const open = smooth(span(t, tOpen, tOpen + DOOR_T)) - smooth(span(t, r.tClose, r.tClose + DOOR_T));
    door.current.position.x = DOOR_X + open * DOOR_W * 0.96;
    // out a little before it slides, back in at the end: it never cuts through the body
    door.current.position.z = VAN_D / 2 + 0.02 + Math.min(1, open * 5) * 0.05;

    // how far a point is inside the van past the door (negative: outside), and ducking through it
    const depth = (p: P2) => (p[0] - r.door[0]) * o[0] + (p[1] - r.door[1]) * o[1];
    const duck = (p: P2) => smooth(clamp01((depth(p) + 0.45 * k) / (0.4 * k)));

    // ---- the load on its way in: the stretcher's middle, the one with the player on his shoulder, or the one dragging
    const carry = t < r.tCarry ? 0 : smooth(span(t, r.tCarry, r.tCarry + r.pathLen / r.carrySpeed)) * r.pathLen;
    const lead = along(r.path, carry);
    const stretcher = variant === 'stretcher' || variant === 'runner' || variant === 'flop' || variant === 'sneak';

    // ---- the two
    const guys: Guy[] = [0, 1].map(n => {
      const route = r.routes[n];
      const start = r.starts[n];
      const end = route[route.length - 1];
      const g: Guy = { p: end, y: 0, face: toward(end, r.G), moving: false, phase: 0, prone: 0, arms: null, tiptoe: false, shown: t >= start };
      const guarding = variant === 'shoulder' && n === 1;
      if (t < r.tCarry || (guarding && (r.guardIn === undefined || t < r.guardIn))) {
        const dist = Math.max(0, t - start) * r.speeds[n];
        const w = along(route, dist);
        g.p = w.p;
        g.phase = (dist / (0.32 * k)) * PI + n;
        if (!w.done && t >= start) {
          g.moving = true;
          g.face = yawOf(w.dir);
          g.tiptoe = variant === 'sneak';
        }
        if (guarding && w.done) g.face = yawOf([-o[0], -o[1]]);
        // the dive: up, over and flat onto the player, a moment there, then back on his feet
        if (pc && pc.who === n && t >= pc.t0) {
          g.face = toward(pc.from, r.G);
          g.moving = false;
          if (t < pc.tLand) {
            const q = span(t, pc.t0, pc.tLand);
            g.p = lerp2(pc.from, pc.land, q);
            g.y = pc.arc * Math.sin(PI * q) + 0.6 * k * q;
            g.prone = smooth(Math.min(1, q * 1.5));
            g.arms = -2.8;
          } else if (t < pc.tUp) {
            g.p = pc.land;
            g.y = 0.6 * k + Math.sin((t - pc.tLand) * 30) * Math.exp(-(t - pc.tLand) * 8) * 0.06 * k;
            g.prone = 1;
            g.arms = -2.8;
          } else {
            const q = smooth(span(t, pc.tUp, pc.tStand));
            g.p = lerp2(pc.land, pc.stand, q);
            g.y = 0.6 * k * (1 - q);
            g.prone = 1 - q;
            if (q >= 1) g.face = toward(pc.stand, r.G);
          }
        }
        // reaching out for the player
        if (t > r.tGrab - 0.2 && !guarding) g.arms = -1.15;
      } else if (stretcher) {
        // both face the way in and walk in step; at the door they close up into single file
        const u = lead.dir;
        const wide = hold(lead.p, u, r.side, k, n, 1);
        g.p = hold(lead.p, u, r.side, k, n, 1 - duck(wide));
        g.face = yawOf(u);
        g.moving = carry < r.pathLen;
        g.phase = ((carry * 1.4) / (0.32 * k)) * PI + n;
        g.arms = -1.0;
      } else if (variant === 'shoulder') {
        if (n === 0) {
          g.p = lead.p;
          g.face = yawOf(lead.dir);
          g.moving = carry < r.pathLen;
          g.phase = (carry / (0.32 * k)) * PI;
          g.arms = -2.7;
        } else {
          const gone = (t - r.guardIn!) * WALK * k;
          const w = along(r.guardRoute!, gone);
          g.p = w.p;
          g.face = yawOf(w.dir);
          g.moving = !w.done;
          g.phase = (gone / (0.32 * k)) * PI + 1;
        }
      } else {
        // drag: one walks in first with the ankles; the other walks beside, a step behind, summons held out
        const w = n === 1 ? lead : alongExt(r.path, carry - 1.25 * k);
        const off = n === 1 ? 0 : 0.7 * k * (1 - duck(w.p));
        g.p = add(w.p, sideOf(w.dir, r.side), off);
        g.face = yawOf(w.dir);
        g.moving = carry < r.pathLen;
        g.phase = (carry / (0.32 * k)) * PI + n;
        g.arms = n === 1 ? 0.9 : -1.3;
      }
      g.shown = g.shown && depth(g.p) < 0.42 * k;
      return g;
    });
    [a.current, b.current].forEach((obj, n) => {
      const g = guys[n];
      obj.visible = g.shown;
      if (!g.shown) return;
      // turn smoothly toward where they go
      yaw.current[n] += turn(yaw.current[n], g.face) * Math.min(1, dt * 9);
      const bow = Math.max(duck(g.p), g.tiptoe ? 0.7 : 0);
      const bob = g.moving ? Math.abs(Math.sin(g.phase)) * (g.tiptoe ? 0.09 : 0.045) * k * (1 - duck(g.p)) : 0;
      obj.position.set(g.p[0], g.y + bob, g.p[1]);
      obj.rotation.set(bow * 0.3 + g.prone * (PI / 2), yaw.current[n], g.moving && !g.tiptoe ? Math.sin(g.phase) * 0.08 : 0, 'YXZ');
      obj.scale.set(k, k * (1 - 0.1 * duck(g.p)), k);
      limbs(obj, g.phase, g.moving ? (g.tiptoe ? 0.85 : 0.55) : 0);
      if (g.arms !== null) {
        for (const c of obj.children) if (c.name === 'armL' || c.name === 'armR') c.rotation.x = g.arms;
      }
    });

    // ---- the player
    const vic = victim.current;
    const kv = k * 0.85;
    const len = 0.53 * k; // half their length lying down
    // before the grab: standing where they are (or running off, frozen with hands up, whistling, flat on their back)
    let feet: P2 = r.P;
    let vy = 0;
    let rx = 0;
    let vyaw = 0;
    let sy = 1;
    let legs = 0.15;
    let legSpeed = 10;
    let armsUp = 0;
    let shiver = t < r.tGrab ? Math.sin(t * 38) * 0.012 : 0;
    if (r.flee) {
      const q = span(t, r.flee[0], r.flee[1]);
      feet = lerp2(r.P, r.G, smooth(q));
      if (q > 0 && q < 1) {
        legs = 0.95;
        legSpeed = 26;
        vyaw = toward(r.P, r.G);
        shiver = 0;
      } else if (q >= 1) armsUp = 0.5;
    }
    if (variant === 'flop') armsUp = smooth(span(t, ARRIVE - 0.2, ARRIVE + 0.3));
    if (variant === 'sneak' && t < r.tGrab) {
      // whistling, looking this way and that, not a clue
      vyaw = Math.sin(t * 1.7) * 0.7;
      legs = 0;
      shiver = 0;
    }
    if (r.tLie !== undefined) {
      // flat on their back, feet to the van, kicking
      const l = smooth(span(t, r.tLie, r.tLie + 0.35));
      const u0 = along(r.path, 0).dir;
      rx = (-PI / 2) * l;
      vyaw = turn(0, yawOf(u0)) * l;
      feet = add(r.G, u0, 0.5 * k * l);
      vy = 0.12 * k * l;
      legs = 0.15 + 0.6 * l;
      legSpeed = 10 + 8 * l;
    }
    if (pc) {
      // squashed under him, then back up and dizzy
      const sq = smooth(span(t, pc.tLand - 0.06, pc.tLand + 0.04)) * (1 - smooth(span(t, pc.tUp, pc.tUp + 0.3)));
      sy = 1 - 0.55 * sq;
      if (sq > 0) shiver = 0;
      vyaw += 2 * PI * smooth(span(t, pc.tUp + 0.1, pc.tUp + 0.75));
    }
    if (variant === 'sneak' && t >= r.tGrab) vy += Math.sin(PI * span(t, r.tGrab, r.tGrab + 0.3)) * 0.25 * k; // jumps out of their skin

    // once grabbed: on the stretcher, over the shoulder, or dragged by the ankles
    let cFeet = feet;
    let cy = vy;
    let crx = rx;
    let cyaw = vyaw;
    let tail: P2 = feet; // the last part of them to go through the door
    if (stretcher) {
      // lying on their back, head first toward the van
      const u = lead.dir;
      cFeet = add(lead.p, u, -len);
      cy = 0.62 * k + (carry > 0 && carry < r.pathLen ? Math.abs(Math.sin(carry * 6)) * 0.03 * k : 0);
      crx = -PI / 2;
      cyaw = yawOf([-u[0], -u[1]]);
      tail = cFeet;
    } else if (variant === 'shoulder') {
      // across his shoulders, head on his left
      const g = guys[0];
      const ya = yaw.current[0];
      const right: P2 = [Math.cos(ya), -Math.sin(ya)];
      cFeet = add(g.p, right, len);
      cy = 1.02 * k + (g.moving ? Math.abs(Math.sin(g.phase)) * 0.045 * k : 0);
      crx = -PI / 2;
      cyaw = yawOf(right);
      tail = g.p;
    } else {
      // dragged by the ankles: feet first, head trailing
      const w = alongExt(r.path, carry - 0.4 * k);
      cFeet = w.p;
      cy = 0.12 * k;
      crx = -PI / 2;
      cyaw = yawOf(w.dir);
      tail = add(w.p, w.dir, -2 * len);
    }
    const gq = smooth(span(t, r.tGrab, r.tGrab + r.grabFor));
    const vf = lerp2(feet, cFeet, gq);
    vic.visible = depth(t >= r.tGrab ? tail : feet) < 0 && (variant !== 'shoulder' || t < r.tCarry || guys[0].shown);
    if (vic.visible) {
      const pop = backOut(Math.min(1, t / 0.35));
      const sc = kv * Math.max(0.001, pop);
      vic.scale.set(sc, sc * (sy + (1 - sy) * gq), sc);
      vic.position.set(vf[0] + shiver, vy + (cy - vy) * gq, vf[1]);
      vic.rotation.set(rx + (crx - rx) * gq, vyaw + turn(vyaw, cyaw) * gq, 0, 'YXZ');
      const carried = t >= r.tGrab;
      limbs(vic, t * (carried ? 17 : legSpeed), carried ? (variant === 'drag' ? 0.5 : 0.75) : legs);
      if (armsUp > 0 && !carried) for (const c of vic.children) if (c.name === 'armL' || c.name === 'armR') c.rotation.x = -2.7 * armsUp + Math.sin(t * 20) * 0.1;
    }
  });

  return (
    <group ref={root} visible={false}>
      <group ref={vanAt}>
        <Van g={van} door={door} wheels={wheels} print={{ near: printNear, far: printFar, door: printDoor }} />
      </group>
      <BigGuy g={a} paper />
      <BigGuy g={b} moustache />
      <Victim g={victim} face={face} body={body} />
    </group>
  );
}
