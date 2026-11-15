import * as THREE from 'three';
import type { GameView } from '../../game/view';
import { debugValue } from '../../lib/debug';
import { arena, dockSize, handRoom, handTop, insetsOf, PARALLAX_X, PARALLAX_Y, pileScale, lastPlace, restCamera, spawn, viewSize, type Rect, type View } from '../layout';
import { CARD_H, CARD_W } from '../cards/cardShape';
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
const lengthOf = (r: P2[]) => r.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - r[i][0], p[1] - r[i][1]), 0);

// ---- timing (seconds) and speeds (in scene-scale units per second) ----
export const ARRIVE = 1.6;
export const DOOR_T = 0.4;
const LEAVE = 1.7;
export const WALK = 2.5;
const SNEAK = 1.15;
const DASH = 3.4;
const CARRY = 1.9;
const GRAB = 0.5;
/** how far away the van comes from and goes to, and how much its road bends away from the table */
const DRIVE = 18;
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

// ---- framing: the whole scene on the screen

/** the van's outline in its own space (scale 1): nose to tail, wheels to the top of the tallest roof load
 * (the eggs van's rocking golden egg), and its sides with the door slid open */
const VAN_HALF_L = 1.9;
const VAN_TOP = 2.45;
const VAN_HALF_D = VAN_D / 2 + 0.08;
/** room around a spot where one of the two (or the player) stands: his width, and his height with arms up
 * or the player across his shoulders */
const BODY_R = 0.5;
const BODY_H = 1.75;
/** an opponent's seat: their fan, and their name plate over it */
const SEAT_HALF = 0.8;
const SEAT_H = 2.3;
/** what turning the van a radian away from right behind the player costs, in table units the player steps */
const TURN_COST = 1.5;
/** the scene may come a little smaller where the screen is tight; shrinking it by a tenth costs as much as the
 * player stepping 1.2 table units from their seat */
const SHRINK = [1, 0.9, 0.8, 0.7];
const SHRINK_COST = 12;
/** any of the scene off the screen (`px` pixels of it) costs more than anything else, and the more the worse */
const offCost = (S: Screen, px: number) => (px > 0.5 ? 100 + (px / S.h) * 400 : 0);
/** the player to the van's side: room for a guy at each end of the stretcher */
const GAP = 1.75;

const emptyRect = (): Rect => ({ x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });
const area = (r: Rect) => Math.max(0, r.x1 - r.x0) * Math.max(0, r.y1 - r.y0);
const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/** The screen as the camera at rest sees it: its size and the camera at every extreme of the mouse parallax. */
export interface Screen {
  w: number;
  h: number;
  /** projection × view of each camera, as plain arrays */
  mats: number[][];
  /** where the scene must stay: the screen less the safe area and a small margin */
  frame: Rect;
}

export function screenOf(view: View): Screen {
  const { w, h } = viewSize(view);
  const offs = view.compact ? [[0, 0]] : [[-PARALLAX_X, -PARALLAX_Y], [PARALLAX_X, -PARALLAX_Y], [-PARALLAX_X, PARALLAX_Y], [PARALLAX_X, PARALLAX_Y]];
  const mats = offs.map(([dx, dy]) => {
    const c = restCamera(view, dx, dy);
    return new THREE.Matrix4().multiplyMatrices(c.projectionMatrix, c.matrixWorldInverse).elements.slice();
  });
  const ins = insetsOf(view);
  const m = Math.max(6, h * 0.015);
  return { w, h, mats, frame: { x0: ins.l + m, y0: ins.t + m, x1: w - ins.r - m, y1: h - ins.b - m } };
}

/** grows `r` by where the table point (x, y, z) lands on the screen, through every camera */
function grow(S: Screen, r: Rect, x: number, y: number, z: number) {
  for (const e of S.mats) {
    const iw = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    const sx = ((e[0] * x + e[4] * y + e[8] * z + e[12]) * iw + 1) * 0.5 * S.w;
    const sy = (1 - (e[1] * x + e[5] * y + e[9] * z + e[13]) * iw) * 0.5 * S.h;
    if (sx < r.x0) r.x0 = sx;
    if (sx > r.x1) r.x1 = sx;
    if (sy < r.y0) r.y0 = sy;
    if (sy > r.y1) r.y1 = sy;
  }
}

/** the screen rectangle of a box on the table: centre (x, z), half sizes along `u` and its perpendicular, height */
function boxRect(S: Screen, r: Rect, c: P2, u: P2, hu: number, hv: number, h: number) {
  for (const su of [-1, 1]) {
    for (const sv of [-1, 1]) {
      const x = c[0] + u[0] * hu * su - u[1] * hv * sv;
      const z = c[1] + u[1] * hu * su + u[0] * hv * sv;
      grow(S, r, x, 0, z);
      grow(S, r, x, h, z);
    }
  }
  return r;
}

/** Where the van (stopped, door open) covers the screen. */
export function vanRect(S: Screen, r: Run): Rect {
  return boxRect(S, emptyRect(), r.C, r.drive, VAN_HALF_L * r.k, VAN_HALF_D * r.k, VAN_TOP * r.k);
}

/** every spot the two and the player stand on during the stop, the grab and the walk back in */
export function spots(r: Run): P2[] {
  const out: P2[] = [r.P, r.G, ...r.routes[0], ...r.routes[1], ...r.path];
  if (r.pounce) out.push(r.pounce.from, r.pounce.land, r.pounce.stand);
  if (r.guardRoute) out.push(...r.guardRoute);
  return out;
}

/** Where the two and the player cover the screen while the van stands. */
export function crewRect(S: Screen, r: Run): Rect {
  const rect = emptyRect();
  for (const p of spots(r)) boxRect(S, rect, p, [1, 0], BODY_R * r.k, BODY_R * r.k, BODY_H * r.k);
  return rect;
}

const union = (a: Rect, b: Rect): Rect => ({ x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });

/** how far (pixels) the rectangle reaches out of the frame, all sides summed */
export function outside(S: Screen, r: Rect) {
  const f = S.frame;
  return Math.max(0, f.x0 - r.x0) + Math.max(0, r.x1 - f.x1) + Math.max(0, f.y0 - r.y0) + Math.max(0, r.y1 - f.y1);
}

/**
 * What the van should not park over: the pile and the deck, your own hand (while you still play), and the HUD's
 * panels in the bottom corners.
 */
function obstacles(S: Screen, game: GameView, view: View, me: boolean): Rect[] {
  const A = arena(view);
  const ps = pileScale(view);
  const out: Rect[] = [
    boxRect(S, emptyRect(), [A.discard[0], A.discard[2]], [1, 0], 0.75 * ps, 0.95 * ps, 0.3),
    boxRect(S, emptyRect(), [spawn.pos[0], spawn.pos[2]], [1, 0], 0.7, 0.8, 0.6),
  ];
  if (!me) {
    // your hand where its cards are right now (raised on your turn by up to a card's height), or before they were
    // ever drawn, all the room it may take
    const hand = emptyRect();
    for (const c of game.s.players[game.seat()]?.hand ?? []) {
      const at = lastPlace.get(c.id);
      if (at?.zone !== 'hand') continue;
      const [x, y, z] = at.pos;
      for (const dx of [-CARD_W, CARD_W]) for (const dy of [-CARD_H, CARD_H * 1.6]) grow(S, hand, x + dx * 0.6, y + dy * 0.6, z);
    }
    const room = handRoom(view);
    out.push(hand.x1 > hand.x0 ? hand : { x0: room.x0, y0: handTop(view), x1: room.x1, y1: S.h });
  }
  // the screen's corner widgets at the top (the colour pill, the menu)
  if (typeof document !== 'undefined') {
    for (const e of document.querySelectorAll('.hud-top .status, .corner-btns')) {
      const b = e.getBoundingClientRect();
      if (b.width && b.height) out.push({ x0: b.left, y0: b.top, x1: b.right, y1: b.bottom });
    }
  }
  const dock = dockSize(view);
  const ins = insetsOf(view);
  const top = S.h - ins.b - dock.top;
  if (dock.bar) out.push({ x0: 0, y0: top, x1: S.w, y1: S.h });
  else {
    const e = Math.max(ins.l, ins.r, dock.edge);
    out.push({ x0: e, y0: top, x1: e + dock.side, y1: S.h }, { x0: S.w - e - dock.side, y0: top, x1: S.w - e, y1: S.h });
  }
  return out;
}

interface Setup {
  variant: Variant;
  me: boolean;
  seat: readonly number[];
  clear: (c: P2, r?: number) => boolean;
  at: number;
  tex: THREE.Texture | null;
  bg: string;
}

/** turns `o` by `a` radians (positive: counter-clockwise seen from above, -z up the screen) */
const rot = (o: P2, a: number): P2 => [o[0] * Math.cos(a) + o[1] * Math.sin(a), -o[0] * Math.sin(a) + o[1] * Math.cos(a)];

/**
 * The knock-out scene for player `i`. The van parks right behind the player, the door toward them, as close to
 * their seat as the screen allows: the whole scene (the van with its roof load, the two and the player) stays on
 * the screen while it stands, clear of the pile, the deck, your hand and the HUD wherever it can be.
 * Every spot is weighed: how far the player had to step in from their seat, how far the van turned to stand
 * beside them rather than behind, how much smaller the scene had to be, and what it covers. Anything off the screen
 * outweighs all of that, so at a seat by the screen's edge the van turns or the player steps in.
 */
export function plan(game: GameView, view: View, i: number, at: number, tex: THREE.Texture | null, bg: string, force?: Variant): Run {
  const A = arena(view);
  const s = game.s;
  const me = game.seat() === i;
  const seat = spawn.seats[i] ?? [0, 0.6, 0];
  const k0 = me ? 0.95 : view.portrait ? 1.0 : 1.15;
  // debug: window.__vanVariant forces one
  const forced = force ?? debugValue<Variant>('__vanVariant');
  const variant = forced && VARIANTS.includes(forced) ? forced : pickVariant(s.round, i, s.players[i]?.out ?? 1);
  // never on the deck or the pile (on the table)
  const clear = (c: P2, r = 0.6) =>
    [[spawn.pos[0], spawn.pos[2], 1.5], [A.discard[0], A.discard[2], 1.8]].every(([x, z, rr]) => Math.hypot(c[0] - x, c[1] - z) > rr + r);
  const setup: Setup = { variant, me, seat, clear, at, tex, bg };
  // everyone else still at the table
  const others = spawn.seats.filter((_, n) => n !== i && !s.players[n]?.out);
  const S = screenOf(view);
  const avoid = obstacles(S, game, view, me);
  const seatsAt = spawn.seats.filter((_, n) => n !== i && n !== game.seat() && !s.players[n]?.out).map(q => boxRect(S, emptyRect(), [q[0], q[2]], [1, 0], SEAT_HALF, SEAT_HALF, SEAT_H));

  // where the player stands to start with, and the way out from the table's middle there
  let o0: P2;
  let P0: P2;
  if (me) {
    // the own seat is low on the screen: the scene plays where the hand was, the van between the player and
    // the middle (or turned beside them, to keep the pile in sight)
    o0 = [0, -1];
    P0 = [0, seat[2] - (view.portrait ? 1.2 : 0.15)];
  } else {
    // outward from the table's middle (the ellipse's normal at the seat), a little in front of their (now empty) fan
    const nx = seat[0] / (A.rx * A.rx), nz = seat[2] / (A.rz * A.rz);
    const n = Math.hypot(nx, nz);
    o0 = n > 1e-6 ? [nx / n, nz / n] : [0, -1];
    P0 = add([seat[0], seat[2]], o0, -0.25);
  }
  // the van may also turn round the player, to stand beside them rather than behind (a seat at the screen's edge)
  const turns = [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.57, -1.57];
  /** what a spot costs before looking at the screen: how far the player had to step from their seat (in their
   * own sizes), and how far the van turned from right behind them */
  const away = (k: number, turned: number, a: number, b: number) =>
    Math.hypot(a, b * 1.4) / k + Math.abs(turned) * TURN_COST + (1 - k / k0) * SHRINK_COST;

  const score = (r: Run, turned: number, a: number, b: number) => {
    const van = vanRect(S, r);
    const crew = crewRect(S, r);
    let cost = offCost(S, outside(S, union(van, crew)));
    // how far the player had to step from their seat, and how far the van turned from right behind them
    cost += away(r.k, turned, a, b);
    // over the pile, the deck, your hand or the HUD
    const va = area(van) || 1, ca = area(crew) || 1;
    for (const ob of avoid) cost += (overlap(van, ob) / va) * 8 + (overlap(crew, ob) / ca) * 3;
    // over someone else's seat (their fan and name plate): it would look like the van came for them
    for (const ob of seatsAt) cost += (overlap(van, ob) / va) * 5 + (overlap(crew, ob) / ca) * 2;
    if (!clear(r.C, 0.6 * r.k)) cost += 3;
    if (!clear(r.P, 0.3 * r.k) || !clear(r.G, 0.3 * r.k)) cost += 2;
    // it must read as the van coming for this player: they stand nearer their own seat than anyone else's
    const mine = Math.hypot(r.P[0] - seat[0], r.P[1] - seat[2]);
    if (others.some(q => Math.hypot(r.P[0] - q[0], r.P[1] - q[2]) < mine)) cost += 4;
    return cost;
  };

  let best = { r: null as Run | null, cost: Infinity, turned: 0, a: 0, b: 0 };
  const tryAt = (k: number, turned: number, a: number, b: number) => {
    const o = rot(o0, turned);
    const d: P2 = [o[1], -o[0]];
    const P = add(add(P0, o, a), d, b);
    // the van alone already off the screen by more than the best spot costs: no need to plan the rest
    const van = boxRect(S, emptyRect(), add(P, o, (GAP + VAN_D / 2) * k), d, VAN_HALF_L * k, VAN_HALF_D * k, VAN_TOP * k);
    if (away(k, turned, a, b) + offCost(S, outside(S, van)) >= best.cost) return;
    const r = stage(setup, o, P, k, me ? 0 : BEND);
    const cost = score(r, turned, a, b);
    if (cost < best.cost) best = { r, cost, turned, a, b };
  };
  // in toward the table's middle (or, for you, up or down the screen), to either side, turned, a little smaller:
  // nearest first, so once a spot is found every further one already costs more and the search stops
  const aLo = me ? -2.5 : -7, aHi = me ? 3 : 0.5;
  const grid: [number, number, number, number, number][] = [];
  // your own scene plays right in front of you, big enough already: it stays full size wherever it can
  for (const f of me ? SHRINK.slice(0, 2) : SHRINK) {
    for (const turned of turns) {
      for (let a = aLo; a <= aHi + 1e-6; a += 0.5) for (let b = -4; b <= 4 + 1e-6; b += 0.5) grid.push([away(k0 * f, turned, a, b), k0 * f, turned, a, b]);
    }
  }
  grid.sort((x, y) => x[0] - y[0]);
  for (const [lb, k, turned, a, b] of grid) {
    if (lb >= best.cost) break;
    tryAt(k, turned, a, b);
  }
  // then finer around the best of them
  const c = best;
  for (let a = c.a - 0.45; a <= c.a + 0.45 + 1e-6; a += 0.15) for (let b = c.b - 0.45; b <= c.b + 0.45 + 1e-6; b += 0.15) tryAt(c.r!.k, c.turned, a, b);
  return best.r!;
}

function stage(S: Setup, o: P2, P: P2, k: number, bend: number): Run {
  const { variant, me, seat, clear, at, tex, bg } = S;
  const C = add(P, o, (GAP + VAN_D / 2) * k);
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
