import type * as THREE from 'three';
import type { GameView } from '../../game/view';
import { DEBUG } from '../fxState';
import { arena, spawn, type View } from '../layout';
import { DOOR_X, VAN_D } from './models';

/*
 * The knock-out scene worked out in advance: where the van parks, which way it drives, how the player is taken
 * (one of six ways) and when each step happens. Everything here follows from the game state, so every screen at
 * the table plans the same scene.
 */

export type P2 = [number, number];
export const add = (a: P2, b: P2, s = 1): P2 => [a[0] + b[0] * s, a[1] + b[1] * s];
const sub = (a: P2, b: P2): P2 => [a[0] - b[0], a[1] - b[1]];
const unit = (a: P2): P2 => {
  const l = Math.hypot(a[0], a[1]) || 1;
  return [a[0] / l, a[1] / l];
};
export const lerp2 = (a: P2, b: P2, q: number): P2 => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q];

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
export const smooth = (x: number) => x * x * (3 - 2 * x);

/** a walk along a polyline: the point `dist` along it and the way it heads there */
export function along(r: P2[], dist: number): { p: P2; dir: P2; done: boolean } {
  let left = Math.max(0, dist);
  for (let i = 1; i < r.length; i++) {
    const dx = r[i][0] - r[i - 1][0], dz = r[i][1] - r[i - 1][1];
    const len = Math.hypot(dx, dz);
    if (len < 1e-6) continue;
    if (left <= len) return { p: [r[i - 1][0] + (dx * left) / len, r[i - 1][1] + (dz * left) / len], dir: [dx / len, dz / len], done: false };
    left -= len;
  }
  const n = r.length;
  const last = r.length > 1 ? unit(sub(r[n - 1], r[n - 2])) : ([0, 1] as P2);
  return { p: r[n - 1], dir: last, done: true };
}
export const lengthOf = (r: P2[]) => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);

// ---- timing (seconds) and speeds (in scene-scale units per second) ----
export const ARRIVE = 1.6;
export const DOOR_T = 0.4;
export const LEAVE = 1.7;
const WALK = 2.5;
const SNEAK = 1.15;
const DASH = 3.4;
const CARRY = 1.9;
const GRAB = 0.5;
/** how far away the van comes from and goes to, and how much its road bends away from the table */
export const DRIVE = 18;
const BEND = 0.045;

/**
 * How the player is taken:
 * - stretcher: the two walk up and carry them off between them
 * - runner: the player bolts; one of the two dives at them from the side, then they are carried off
 * - flop: the player freezes, hands up; one of the two belly-flops onto them, then they are carried off
 * - shoulder: one throws them over his shoulder and walks in; the other keeps watch at the door
 * - drag: the player drops on their back and refuses; one drags them in by the ankles, the other walks alongside
 * - sneak: the player whistles, looking around; the two tiptoe up, grab them and rush them in
 */
export const VARIANTS = ['stretcher', 'runner', 'flop', 'shoulder', 'drag', 'sneak'] as const;
export type Variant = (typeof VARIANTS)[number];

/** where the two hold a stretcher: [along it toward the van, to the side] for the head end and the knees */
export const HOLD: P2[] = [[0.8, 0.58], [-0.42, -0.64]];

/** One of the two diving onto the player: from a run-up point onto them, a moment flat on top, then up again. */
export interface Pounce {
  who: 0 | 1;
  from: P2;
  /** where his feet are when he lies on top of the player (his belly over them) */
  land: P2;
  /** where he stands once up again */
  stand: P2;
  arc: number;
  t0: number;
  tLand: number;
  tUp: number;
  tStand: number;
}

export interface Run {
  at: number;
  k: number;
  variant: Variant;
  /** the player at the start, and where they are when they are grabbed */
  P: P2;
  G: P2;
  /** the van's parking spot, the direction from the player to the van, the side (along the van), the drive direction */
  C: P2;
  o: P2;
  side: P2;
  drive: P2;
  mirror: boolean;
  bend: number;
  /** the door's middle on the van's side */
  door: P2;
  /** the way each of the two walks out, when they start, how fast */
  routes: [P2[], P2[]];
  starts: [number, number];
  speeds: [number, number];
  /** runner: the player runs from P to G in this time */
  flee?: [number, number];
  pounce?: Pounce;
  /** drag: the player drops onto their back */
  tLie?: number;
  tGrab: number;
  grabFor: number;
  /** the load's way into the van: the stretcher's middle, the shoulder carrier, or the one dragging */
  path: P2[];
  pathLen: number;
  tCarry: number;
  carrySpeed: number;
  /** shoulder: the one at the door goes in after the carrier */
  guardIn?: number;
  guardRoute?: P2[];
  tClose: number;
  tLeave: number;
  tGone: number;
  tex: THREE.Texture | null;
  bg: string;
}

/** a small integer hash: the same pick on every screen */
function mix(x: number): number {
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** the way this player is taken: from the round, the seat and the order they went out in, so all screens agree */
export function pickVariant(round: number, seat: number, order: number): Variant {
  return VARIANTS[mix(round * 7919 + seat * 131 + order * 17 + 3) % VARIANTS.length];
}

/** the stretcher holding spot `n` around its middle `m` heading `u`, side offset scaled by `wide` (0: single file) */
export function hold(m: P2, u: P2, side: P2, k: number, n: number, wide: number): P2 {
  return add(add(m, u, HOLD[n][0] * k), sideOf(u, side), HOLD[n][1] * k * wide);
}

/** a sideways direction for heading `u`, on the same hand as `side` is for the heading toward the van */
export function sideOf(u: P2, side: P2): P2 {
  const a: P2 = [u[1], -u[0]];
  // `side` was made as one of the two perpendiculars of `o`; keep the same hand for any heading near it
  return a[0] * side[0] + a[1] * side[1] >= 0 ? a : [-a[0], -a[1]];
}

/** Where the van is `s` along its road (negative: still coming), and which way it points. */
export function road(r: Run, s: number): { x: number; z: number; yaw: number } {
  const x = r.C[0] + r.drive[0] * s + r.o[0] * r.bend * s * s;
  const z = r.C[1] + r.drive[1] * s + r.o[1] * r.bend * s * s;
  const nx = r.drive[0] + r.o[0] * 2 * r.bend * s;
  const nz = r.drive[1] + r.o[1] * 2 * r.bend * s;
  // the nose is local -x (local +x when mirrored); the yaw turns it onto the road
  const yaw = r.mirror ? Math.atan2(-nz, nx) : Math.atan2(nz, -nx);
  return { x, z, yaw };
}

/** how far along its road the van is at time t: rolls in and eases to a stop, then pulls away */
export function roadAt(r: Run, t: number) {
  if (t < ARRIVE) return -DRIVE * (1 - t / ARRIVE) ** 4;
  if (t < r.tLeave) return 0;
  return DRIVE * span(t, r.tLeave, r.tLeave + LEAVE) ** 3;
}

export function plan(game: GameView, view: View, i: number, at: number, tex: THREE.Texture | null, bg: string): Run {
  const A = arena(view);
  const s = game.s;
  const me = game.seat() === i;
  const seat = spawn.seats[i] ?? [0, 0.6, 0];
  const k = me ? 0.95 : view.portrait ? 1.0 : 1.15;
  // debug: window.__vanVariant forces one
  const forced = DEBUG ? (window as unknown as { __vanVariant?: Variant }).__vanVariant : undefined;
  const variant = forced && VARIANTS.includes(forced) ? forced : pickVariant(s.round, i, s.players[i]?.out ?? 1);
  const gap = 1.75 * k; // player to the van's side: room for a guy at each end of the stretcher
  // never on the deck or the pile
  const clear = (c: P2, r = 0.6 * k) =>
    [[spawn.pos[0], spawn.pos[2], 1.5], [A.discard[0], A.discard[2], 1.8]].every(([x, z, rr]) => Math.hypot(c[0] - x, c[1] - z) > rr + r);
  let o: P2;
  let P: P2;
  let bend = BEND;
  if (me) {
    // the own seat is low on the screen: the scene plays where the hand was, the van between the player and
    // the middle, clear of the pile, driving straight across
    o = [0, -1];
    P = [0, seat[2] - (view.portrait ? 1.2 : 0.15)];
    bend = 0;
    const vanZ = () => P[1] - gap - (VAN_D / 2) * k;
    for (let n = 0; n < 20 && vanZ() - (VAN_D / 2) * k < A.discard[2] + 1.45; n++) P = [0, P[1] + 0.1];
  } else {
    // outward from the table's middle (the ellipse's normal at the seat)
    const nx = seat[0] / (A.rx * A.rx), nz = seat[2] / (A.rz * A.rz);
    const n = Math.hypot(nx, nz);
    o = n > 1e-6 ? [nx / n, nz / n] : [0, -1];
    // a little in front of their (now empty) fan; further in when the van would park off the screen
    P = add([seat[0], seat[2]], o, -0.25);
    const fits = (c: P2) => (c[0] / (A.rx + 0.3)) ** 2 + (c[1] / (A.rz + 2.3)) ** 2 <= 1;
    for (let m = 0; m < 40 && !fits(add(P, o, gap + (VAN_D / 2) * k)); m++) P = add(P, o, -0.1);
    for (let m = 0; m < 30 && !clear(add(P, o, -0.3 * k)); m++) P = add(P, o, 0.1);
  }
  const C = add(P, o, gap + (VAN_D / 2) * k);
  // the door faces the player; along the van that leaves two ways to drive. Top and bottom seats: in from
  // their own side of the screen. Side seats: in from the back, out toward the front and away.
  const d: P2 = [o[1], -o[0]];
  const sideSeat = Math.abs(o[0]) > 0.6;
  const mirror = me ? false : sideSeat ? d[1] < 0 : -d[0] * seat[0] < 0;
  const drive: P2 = mirror ? [-d[0], -d[1]] : d;
  const side = d;
  const door = add(add(C, drive, -DOOR_X * k), o, -(VAN_D / 2) * k);
  const step = add(door, o, -0.32 * k);
  const inside = add(door, o, 0.45 * k);
  /** where a load lines up with the door before going in */
  const lineUp = add(door, o, -0.95 * k);

  // ---- where the player is grabbed
  let G = P;
  let flee: [number, number] | undefined;
  if (variant === 'runner') {
    // they bolt sideways, to whichever side is clear
    for (const sg of [1, -1]) {
      const g = add(add(P, side, 1.55 * k * sg), o, -0.35 * k);
      if (clear(g, 1.0 * k)) {
        G = g;
        break;
      }
    }
    flee = [1.05, 1.75];
  }
  const u0 = unit(sub(lineUp, G));
  const perp0 = sideOf(u0, side);

  // ---- the two walk out (the first, then the second a moment later) to their places
  const tOpen = ARRIVE + 0.1;
  const startA = tOpen + DOOR_T * 0.7;
  const startB = startA + 0.35;
  const out: P2[] = [inside, door, step];
  const sneaky = variant === 'sneak';
  const speeds: [number, number] = [(sneaky ? SNEAK : WALK) * k, (sneaky ? SNEAK : variant === 'runner' ? DASH : WALK) * k];
  const holdA = hold(G, u0, side, k, 0, 1);
  const holdB = hold(G, u0, side, k, 1, 1);
  // the second goes round the first, on the other side
  const roundB: P2[] = [add(step, perp0, -0.95 * k), add(G, perp0, -0.95 * k)];
  let routes: [P2[], P2[]];
  let pounce: Pounce | undefined;
  if (variant === 'shoulder') {
    // the carrier walks right up to them; the other keeps watch beside the door
    routes = [[...out, add(G, u0, 0.5 * k)], [...out, add(step, side, 0.85 * k)]];
  } else if (variant === 'drag') {
    // one to the ankles (between the player and the van), one beside them
    routes = [[...out, add(G, perp0, 0.8 * k)], [...out, add(G, u0, 0.9 * k)]];
  } else if (variant === 'flop') {
    // the first stops a run-up away in front of them and jumps; the second walks round to the knees
    const from = add(G, u0, 1.35 * k);
    routes = [[...out, from], [...out, ...roundB, holdB]];
    pounce = { who: 0, from, land: add(G, u0, 0.72 * k), stand: holdA, arc: 0.85 * k, t0: 0, tLand: 0, tUp: 0, tStand: 0 };
  } else if (variant === 'runner') {
    // the second dashes after them and dives in from the side; the first walks to the head end
    const from = add(G, perp0, -1.45 * k);
    routes = [[...out, holdA], [...out, add(step, perp0, -0.95 * k), from]];
    pounce = { who: 1, from, land: add(G, perp0, -0.72 * k), stand: holdB, arc: 0.45 * k, t0: 0, tLand: 0, tUp: 0, tStand: 0 };
  } else {
    routes = [[...out, holdA], [...out, ...roundB, holdB]];
  }
  const starts: [number, number] = [startA, startB];
  const arrive = (n: 0 | 1) => starts[n] + lengthOf(routes[n]) / speeds[n];
  let ready = Math.max(arrive(0), arrive(1));
  if (flee) ready = Math.max(ready, flee[1] + 0.2);
  if (pounce) {
    const p = pounce;
    // the diver waits for the other (and for the player to stop running) before he jumps
    p.t0 = Math.max(arrive(p.who) + 0.1, flee ? flee[1] + 0.25 : 0, variant === 'flop' ? arrive(1 - p.who as 0 | 1) - 0.4 : 0);
    p.tLand = p.t0 + (variant === 'flop' ? 0.55 : 0.4);
    p.tUp = p.tLand + 0.75;
    p.tStand = p.tUp + 0.45;
    ready = Math.max(ready, p.tStand);
  }
  const tLie = variant === 'drag' ? Math.max(ARRIVE + 0.2, Math.min(arrive(0), arrive(1)) - 0.9) : undefined;
  const tGrab = ready + 0.15;
  const grabFor = sneaky ? 0.25 : variant === 'shoulder' ? 0.6 : variant === 'drag' ? 0.3 : GRAB;
  const tCarry = tGrab + grabFor;

  // ---- the way in, and how long it takes
  let path: P2[];
  let carrySpeed = CARRY * k * (sneaky ? 1.9 : variant === 'runner' ? 1.15 : 1);
  let guardIn: number | undefined;
  let guardRoute: P2[] | undefined;
  let tIn: number;
  if (variant === 'shoulder') {
    path = [add(G, u0, 0.5 * k), lineUp, door, add(door, o, 0.6 * k)];
    carrySpeed = WALK * 0.85 * k;
    const done = tCarry + lengthOf(path) / carrySpeed;
    const guard = routes[1][routes[1].length - 1];
    guardRoute = [guard, step, door, inside];
    guardIn = done - 0.35;
    tIn = Math.max(done, guardIn + lengthOf(guardRoute) / (WALK * k));
  } else if (variant === 'drag') {
    // the one at the ankles walks in first, the player slides in after him, the other last
    const startD = routes[1][routes[1].length - 1];
    path = [startD, door, add(door, o, 1.65 * k)];
    carrySpeed = CARRY * 0.8 * k;
    tIn = tCarry + lengthOf(path) / carrySpeed;
  } else {
    // the stretcher's middle: in until the one at the knees is inside too
    path = [G, lineUp, door, add(door, o, (0.47 - HOLD[1][0]) * k)];
    tIn = tCarry + lengthOf(path) / carrySpeed;
  }
  const tClose = tIn + 0.05;
  const tLeave = tClose + DOOR_T + 0.15;
  return {
    at, k, variant, P, G, C, o, side, drive, mirror, bend, door,
    routes, starts, speeds, flee, pounce, tLie, tGrab, grabFor,
    path, pathLen: lengthOf(path), tCarry, carrySpeed, guardIn, guardRoute,
    tClose, tLeave, tGone: tLeave + LEAVE, tex, bg,
  };
}
