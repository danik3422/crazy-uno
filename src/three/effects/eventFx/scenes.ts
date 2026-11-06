import * as THREE from 'three';
import { CELL_ID, type Cell } from '../cardFx/atlas';
import type { Kit, Spot } from '../cardFx/kit';
import { FOUR, WHITE, arc, clamp01, easeIn, easeInOut, easeOut, easeOutBack, fade, flash, hump, raw, ring, rnd } from '../cardFx/shapes';
import type { EventLook } from './look';

/**
 * The quad-drawn parts of every random event, one function per moment. Pure functions of time that write
 * into the shared pools (see cardFx/kit.ts): nothing is allocated per frame.
 */

/** The look's colours, converted once per table. */
export interface Pal {
  hot: THREE.Color;
  sparks: THREE.Color[];
  ring: THREE.Color;
  smoke: THREE.Color;
  trail: [THREE.Color, THREE.Color];
  boltCore: THREE.Color;
  boltGlow: THREE.Color;
  cloud: THREE.Color;
  sparkle: THREE.Color;
  orbit: THREE.Color[];
  fog: THREE.Color;
  confetti: THREE.Color[];
  dark: THREE.Color;
  /** the little crackles of the lightning and the blitz */
  crackle: Cell;
  /** the twinkles of the jackpot, the coin and the start pulse */
  twinkle: Cell;
}

export function palOf(l: EventLook): Pal {
  return {
    hot: raw(l.hot),
    sparks: l.sparks.map(c => raw(c)),
    ring: raw(l.ring),
    smoke: raw(l.smoke),
    trail: [raw(l.meteor.trail[0]), raw(l.meteor.trail[1])],
    boltCore: raw(l.bolt.core),
    boltGlow: raw(l.bolt.glow),
    cloud: raw(l.bolt.cloud),
    sparkle: raw(l.coin.sparkle),
    orbit: l.orbit.colors.map(c => raw(c)),
    fog: raw(l.fog),
    confetti: l.confetti.map(c => raw(c)),
    dark: raw('#1a1020'),
    crackle: l.bolt.crackle ?? CELL_ID.bolt,
    twinkle: l.twinkle ?? CELL_ID.star,
  };
}

/** One event on the table, filled in when it starts. */
export interface Run {
  seed: number;
  /** the seat it is aimed at */
  target: Spot;
  /** Robin Hood: who receives the cards */
  other: Spot;
  hasOther: boolean;
  pile: Spot;
  /** every seat, for effects that touch the whole table */
  seats: Spot[];
  nSeats: number;
  /** half-axes of the ring of seats */
  rx: number;
  rz: number;
  dir: 1 | -1;
  /** single-colour day: the colour */
  color: THREE.Color;
}

const tmpC = new THREE.Color();
const tmpV = new THREE.Vector3();
const tmpW = new THREE.Vector3();

function mix(a: THREE.Color, b: THREE.Color, k: number) {
  return tmpC.copy(a).lerp(b, k);
}

/**
 * The angle (for a quad facing the camera) of a direction in the world, as seen on screen.
 * `view` is the camera's matrixWorldInverse.
 */
export function screenAngle(view: THREE.Matrix4, from: Spot, to: Spot) {
  tmpV.set(from.x, from.y, from.z).applyMatrix4(view);
  tmpW.set(to.x, to.y, to.z).applyMatrix4(view);
  return Math.atan2(tmpW.y - tmpV.y, tmpW.x - tmpV.x);
}

/** sparks flying out of an impact in the table's colours, falling back with gravity */
function sparks(k: Kit, x: number, y: number, z: number, t: number, n: number, speed: number, cols: THREE.Color[], size: number, dur: number, seed: number) {
  if (t < 0 || t > dur) return;
  const p = t / dur;
  const count = k.lite ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const a = rnd(seed, i) * Math.PI * 2;
    const v = speed * (0.4 + rnd(seed, i + 50) * 0.8);
    const up = speed * (0.5 + rnd(seed, i + 90) * 0.9);
    const px = x + Math.cos(a) * v * t;
    const pz = z + Math.sin(a) * v * t * 0.8;
    const py = Math.max(0.06, y + up * t - 5.5 * t * t);
    const c = cols[i % cols.length];
    const sz = size * (1 - p * 0.55);
    if (i % 3) k.g(CELL_ID.spark, px, py, pz, sz * 1.3, t * 7 + i, false, c, 1 - p * p);
    else k.s(CELL_ID.dot, px, py, pz, sz * 0.45, 0, false, c, 1 - p * p);
  }
}

/** smoke puffs rising and spreading from a point */
function smoke(k: Kit, x: number, z: number, t: number, n: number, dur: number, c: THREE.Color, a: number, spread: number, seed: number) {
  if (t < 0 || t > dur) return;
  const count = k.lite ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const tt = t - rnd(seed, i + 7) * 0.15;
    if (tt < 0) continue;
    const p = tt / dur;
    const ang = rnd(seed, i) * Math.PI * 2;
    const d = spread * (0.3 + rnd(seed, i + 3) * 0.7) * easeOut(p * 1.6);
    k.s(CELL_ID.cloud, x + Math.cos(ang) * d, 0.4 + p * 1.6, z + Math.sin(ang) * d * 0.7, (1 + p * 1.6) * (0.9 + rnd(seed, i + 9) * 0.5), 0, false, c, a * hump(Math.min(1, p * 1.1 + 0.05)));
  }
}

/** a target marker: a ring on the floor closing in on the seat until the hit */
export function aim(k: Kit, s: Spot, t: number, until: number, c: THREE.Color, dark: THREE.Color) {
  if (t < 0 || t > until) return;
  const p = t / until;
  const r = 1.7 - easeInOut(p) * 0.9;
  const a = Math.min(1, t / 0.2) * (0.55 + 0.35 * Math.sin(t * 22));
  k.g(CELL_ID.ring, s.x, 0.05, s.z, r * 2, 0, true, c, a);
  k.g(CELL_ID.glow, s.x, 0.04, s.z, r * 2.4, 0, true, c, 0.25 * a);
  // a shadow growing under what is coming
  k.s(CELL_ID.glow, s.x, 0.03, s.z, 0.6 + easeIn(p) * 2.2, 0, true, dark, 0.45 * easeIn(p));
}

/** the big hit (meteor, bomb): flash, shock rings, sparks, smoke, a scorch mark and the table's own extra */
export function impact(k: Kit, s: Spot, d: number, P: Pal, look: EventLook, seed: number, scale = 1) {
  if (d < 0 || d > 1.8) return;
  const { x, z } = s;
  flash(k, x, 0.7, z, d, 0.5, 6 * scale, P.hot, 1);
  flash(k, x, 0.6, z, d, 0.25, 2.6 * scale, WHITE, 1);
  ring(k, x, z, d, 0.65, 0.3, 3.4 * scale, P.ring, 1, true, 0.05);
  ring(k, x, z, d - 0.1, 0.75, 0.2, 2.3 * scale, P.hot, 0.8, false, 0.05);
  // scorch
  k.s(CELL_ID.glow, x, 0.025, z, 2.6 * scale, 0, true, P.dark, 0.55 * fade(d, 1.8, 0.05, 0.6));
  sparks(k, x, 0.4, z, d, 26, 4.2 * scale, P.sparks, 0.42 * scale, 1.0, seed);
  smoke(k, x, z, d - 0.05, 7, 1.5, P.smoke, look.smokeAlpha, 1.6 * scale, seed + 11);
  switch (look.meteor.extra) {
    case 'confetti':
      confetti(k, x, 0.5, z, d, 22, 6, P.confetti, 1.6, seed + 3, 0.26);
      break;
    case 'ripples':
      for (let i = 0; i < 3; i++) ring(k, x, z, d - 0.12 - i * 0.14, 0.8, 0.4, (4.4 - i * 0.6) * scale, i % 2 ? P.hot : P.ring, 0.9, false, 0.06);
      break;
    case 'stars': {
      const n = k.lite ? 6 : 10;
      for (let i = 0; i < n; i++) {
        const tt = d - 0.05;
        if (tt < 0 || tt > 1.4) continue;
        const p = tt / 1.4;
        const a = (i / n) * Math.PI * 2 + rnd(seed, i) * 0.5;
        const r = easeOut(p) * (1.6 + rnd(seed, i + 4) * 1.6) * scale;
        const tw = 0.7 + 0.3 * Math.sin(tt * 18 + i * 2);
        k.g(P.twinkle, x + Math.cos(a) * r, 0.6 + easeOut(p) * 1.6 * rnd(seed, i + 8), z + Math.sin(a) * r * 0.7, 0.7 * tw * (1 - p * 0.5), tt * 2, false, P.sparks[i % 3], 1 - p);
      }
      break;
    }
    case 'bats':
      bats(k, x, z, d - 0.08, k.lite ? 4 : 7, 1.6, P.dark, seed);
      break;
    case 'snow': {
      // a cloud of powder and snowflakes thrown up, drifting down slowly
      const n = k.lite ? 8 : 14;
      for (let i = 0; i < n; i++) {
        const tt = d - 0.04;
        if (tt < 0 || tt > 1.6) continue;
        const p = tt / 1.6;
        const a = (i / n) * Math.PI * 2 + rnd(seed, i) * 0.5;
        const r = easeOut(Math.min(1, p * 1.6)) * (1.4 + rnd(seed, i + 4) * 1.8) * scale;
        const y = 0.3 + Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.5) * (1.4 + rnd(seed, i + 8) * 1.4) - p * p * 1.2 + Math.sin(tt * 4 + i) * 0.1;
        k.g(CELL_ID.flake, x + Math.cos(a) * r, Math.max(0.1, y), z + Math.sin(a) * r * 0.7, 0.55 + rnd(seed, i + 3) * 0.3, tt * (rnd(seed, i + 5) - 0.5) * 4, false, i % 3 ? WHITE : P.sparks[1], 1 - p * p);
      }
      break;
    }
  }
}

/** bats bursting out of a point and flapping away */
function bats(k: Kit, x: number, z: number, t: number, n: number, dur: number, c: THREE.Color, seed: number) {
  if (t < 0 || t > dur) return;
  const p = t / dur;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(seed, i) * 0.6;
    const r = easeOut(p) * (2.4 + rnd(seed, i + 2) * 1.6);
    const y = 0.6 + p * (2 + rnd(seed, i + 5) * 1.5) + Math.sin(t * 9 + i) * 0.12;
    const flap = 0.35 + 0.65 * Math.abs(Math.sin(t * 16 + i * 1.7));
    const size = 0.7 + rnd(seed, i + 6) * 0.3;
    k.s(CELL_ID.bat, x + Math.cos(a) * r, y, z + Math.sin(a) * r * 0.7, size, Math.cos(a) * 0.3, false, c, fade(t, dur, 0.05, 0.4), size * 0.62 * flap);
  }
}

/** paper confetti shot up from a point, fluttering down */
export function confetti(k: Kit, x: number, y: number, z: number, t: number, n: number, speed: number, cols: THREE.Color[], dur: number, seed: number, size = 0.24) {
  if (t < 0 || t > dur) return;
  const count = k.lite ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const a = rnd(seed, i) * Math.PI * 2;
    const v = speed * (0.15 + rnd(seed, i + 30) * 0.35);
    const up = speed * (0.6 + rnd(seed, i + 60) * 0.5);
    // fast up, then a slow drift down (air drag)
    const rise = up * (1 - Math.exp(-t * 3)) / 3;
    const py = Math.max(0.05, y + rise - 1.1 * t * t);
    const px = x + Math.cos(a) * v * t + Math.sin(t * 7 + i) * 0.18;
    const pz = z + Math.sin(a) * v * t * 0.8;
    const flip = Math.abs(Math.cos(t * (6 + rnd(seed, i + 9) * 6) + i));
    k.s(CELL_ID.dot, px, py, pz, size, t * 5 + i, false, cols[i % cols.length], fade(t, dur, 0.02, 0.45), size * (0.25 + 0.75 * flip));
  }
}

/** a soft pulse at the pile when any event starts */
export function arrival(k: Kit, r: Run, t: number, P: Pal) {
  if (t < 0 || t > 0.9) return;
  ring(k, r.pile.x, r.pile.z, t, 0.8, 0.5, 3.6, P.ring, 0.55, true, 0.05);
  const n = k.lite ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const p = t / 0.9;
    const a = (i / n) * Math.PI * 2 + r.seed;
    const d = 0.6 + easeOut(p) * 2.2;
    k.g(P.twinkle, r.pile.x + Math.cos(a) * d, 0.3 + easeOut(p) * 1.3, r.pile.z + Math.sin(a) * d * 0.7, 0.45 * (1 - p), t * 3, false, P.sparks[i % 3], 1 - p);
  }
}

const head: Spot = { x: 0, y: 0, z: 0 };
const prev: Spot = { x: 0, y: 0, z: 0 };

/** where the falling thing is at fall progress p (0 → 1), accelerating */
function fallPos(from: Spot, to: Spot, p: number, out: Spot) {
  const e = easeIn(p) * 0.75 + p * 0.25;
  out.x = from.x + (to.x - from.x) * e;
  out.y = from.y + (to.y - from.y) * e;
  out.z = from.z + (to.z - from.z) * e;
  return out;
}

/**
 * The meteor (rock, comet, laser orb or flaming pumpkin, by table). tm: seconds since it started falling;
 * it hits after `fall`. Returns the head's position while falling (for the light), or null.
 */
export function meteor(k: Kit, r: Run, tm: number, fall: number, from: Spot, P: Pal, look: EventLook, view: THREE.Matrix4): Spot | null {
  const s = r.target;
  const m = look.meteor;
  aim(k, s, tm + 0.6, fall + 0.6, P.hot, P.dark);
  if (m.beam && tm > -0.5 && tm < fall + 0.15) {
    // the targeting laser: a thin line from the sky, brighter and brighter
    const q = clamp01((tm + 0.5) / (fall + 0.5));
    const flick = 0.75 + 0.25 * Math.sin(tm * 60);
    k.g(CELL_ID.streak, s.x, 3.4, s.z, 7, Math.PI / 2, false, P.hot, (0.25 + q * 0.6) * flick, 0.22 + q * 0.3);
    k.g(CELL_ID.streak, s.x, 3.4, s.z, 7, Math.PI / 2, false, WHITE, 0.35 * q * flick, 0.08);
  }
  let out: Spot | null = null;
  if (tm >= 0 && tm < fall) {
    const p = tm / fall;
    fallPos(from, s, p, head);
    out = head;
    fallPos(from, s, Math.max(0, p - 0.04), prev);
    const ang = screenAngle(view, prev, head);
    // the trail: glows back along the path, from the head's colour to the tail's
    const n = k.lite ? 9 : 16;
    for (let j = n; j >= 1; j--) {
      const pj = p - j * 0.028;
      if (pj < 0) continue;
      fallPos(from, s, pj, prev);
      const f = j / n;
      k.g(CELL_ID.glow, prev.x, prev.y, prev.z, (m.head === null ? 1.9 : 1.5) * (1 - f * 0.75), 0, false, mix(P.trail[0], P.trail[1], f), 0.85 * (1 - f));
      if (m.head !== null && j % 4 === 0) k.s(CELL_ID.cloud, prev.x, prev.y + 0.1, prev.z, 0.7 + f * 1.2, j, false, P.smoke, look.smokeAlpha * 0.6 * (1 - f));
    }
    // embers falling off it
    const ne = k.lite ? 3 : 6;
    for (let i = 0; i < ne; i++) {
      const life = (tm * 3 + i / ne) % 1;
      fallPos(from, s, Math.max(0, p - life * 0.15), prev);
      k.g(CELL_ID.spark, prev.x + (rnd(r.seed, i) - 0.5) * life, prev.y - life * 0.8, prev.z, 0.45 * (1 - life), tm * 9 + i, false, P.sparks[i % 3], 1 - life);
    }
    // a long streak behind the head shows its speed
    k.g(CELL_ID.streak, head.x, head.y, head.z, 3.6, ang + Math.PI, false, P.trail[1], 0.5, 0.9);
    k.g(CELL_ID.glow, head.x, head.y, head.z, 2.4, 0, false, P.trail[0], 0.9);
    if (m.head !== null) {
      // the drawn icon's flame points up-right: turn it to trail behind the flight
      const rot = m.spin ? tm * m.spin * Math.PI * 2 : ang + Math.PI - Math.PI / 4;
      k.i(m.head, head.x, head.y, head.z, 1.7, rot, false, null, 1);
    } else {
      k.g(CELL_ID.glow, head.x, head.y, head.z, 1.2, 0, false, WHITE, 1);
      k.g(CELL_ID.spark, head.x, head.y, head.z, 1.6, tm * 4, false, WHITE, 0.9);
    }
  }
  impact(k, s, tm - fall, P, look, r.seed);
  return out;
}

/** Storm clouds gathering over the target, the strike's glow and crackle, then the skip sign. tl: since the strike. */
export function lightning(k: Kit, r: Run, tl: number, P: Pal, look: EventLook) {
  const s = r.target;
  aim(k, s, tl + 0.5, 0.5, P.boltGlow, P.dark);
  // clouds (not for the cosmic beam: it comes from a ring of light instead)
  const n = k.lite ? 4 : 7;
  if (tl > -0.5 && tl < 1.4) {
    const gather = easeOut((tl + 0.5) / 0.45);
    const leave = tl > 0.8 ? 1 - (tl - 0.8) / 0.6 : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r.seed;
      const d = (1 - gather) * 2.5 + 0.5 + rnd(r.seed, i) * 0.8;
      const cx = s.x + Math.cos(a) * d;
      const cz = s.z - 0.5 + Math.sin(a) * d * 0.4;
      if (look.bolt.beam) k.g(CELL_ID.ring, s.x, 6.2, s.z, 2.6 * gather + i * 0.25, tl * 2 + i, false, P.boltGlow, 0.18 * leave);
      else k.s(CELL_ID.cloud, cx, 6 + rnd(r.seed, i + 2) * 0.6, cz, 2.2 + rnd(r.seed, i + 3) * 1.2, 0, false, P.cloud, 0.85 * gather * leave);
    }
    // flickers inside the cloud
    const fl = Math.sin(tl * 37 + r.seed) > 0.6 ? 1 : 0;
    k.g(CELL_ID.glow, s.x, 6.2, s.z - 0.4, 3.2, 0, false, P.boltGlow, (tl < 0 ? 0.35 * fl : 0.9 * (1 - clamp01(tl / 0.5))) * leave);
  }
  if (tl < 0 || tl > 1.9) return;
  // the hit
  flash(k, s.x, 0.8, s.z, tl, 0.45, 5, P.boltGlow, 1);
  flash(k, s.x, 0.4, s.z, tl, 0.2, 2.5, WHITE, 1);
  if (look.bolt.beam) {
    // a column of light with rings sliding down it
    const a = fade(tl, 0.75, 0.04, 0.35);
    k.g(CELL_ID.streak, s.x, 3.2, s.z, 7.5, Math.PI / 2, false, P.boltGlow, 0.9 * a, 1.6);
    k.g(CELL_ID.streak, s.x, 3.2, s.z, 7.5, Math.PI / 2, false, WHITE, a, 0.45);
    for (let i = 0; i < 3; i++) {
      const q = (tl * 1.6 + i / 3) % 1;
      k.g(CELL_ID.ring, s.x, 5.5 - q * 5.3, s.z, 1.4 + q * 0.8, 0, true, P.boltGlow, a * (1 - q * 0.5));
    }
  }
  ring(k, s.x, s.z, tl, 0.6, 0.3, 2.8, P.boltGlow, 1, true, 0.05);
  k.s(CELL_ID.glow, s.x, 0.025, s.z, 2.2, 0, true, P.dark, 0.5 * fade(tl, 1.9, 0.05, 0.6));
  sparks(k, s.x, 0.3, s.z, tl, 18, 3.4, [P.boltCore, P.boltGlow, P.boltGlow], 0.36, 0.8, r.seed + 5);
  // little arcs crackling on the floor
  const nc = k.lite ? 3 : 5;
  for (let i = 0; i < nc; i++) {
    if (tl > 0.8 || Math.sin(tl * 50 + i * 3) < 0) continue;
    const a = rnd(r.seed + Math.floor(tl * 20), i) * Math.PI * 2;
    const d = 0.5 + rnd(r.seed, i + 5) * 0.9;
    k.g(P.crackle, s.x + Math.cos(a) * d, 0.35, s.z + Math.sin(a) * d * 0.7, 0.55, a, false, P.boltGlow, 1 - tl / 0.8);
  }
  // the skip sign rises over the struck player
  const st = tl - 0.15;
  if (st > 0 && st < 1.7) {
    const pop = easeOutBack(st / 0.35, 2.2);
    const al = fade(st, 1.7, 0.05, 0.4);
    k.g(CELL_ID.glow, s.x, 1.7 + st * 0.35, s.z, 2.4 * pop, 0, false, P.boltGlow, 0.5 * al);
    k.i(CELL_ID.barrier, s.x, 1.7 + st * 0.35, s.z, 1.35 * pop, Math.sin(st * 6) * 0.08 * (1 - st / 1.7), false, P.boltGlow, al);
  }
}

/** Jackpot: a spotlight on the lucky one and twinkles around the fountain of coins (the coins are real meshes). */
export function jackpot(k: Kit, r: Run, tb: number, P: Pal) {
  const s = r.target;
  if (tb < -0.45 || tb > 2) return;
  const a = fade(tb + 0.45, 2.45, 0.25, 0.5);
  k.g(CELL_ID.streak, s.x, 3, s.z, 7, Math.PI / 2, false, P.sparkle, 0.35 * a, 2.6);
  k.g(CELL_ID.glow, s.x, 0.04, s.z, 4.2, 0, true, P.sparkle, 0.55 * a);
  ring(k, s.x, s.z, tb, 0.7, 0.4, 2.8, P.sparkle, 1, true, 0.05);
  const n = k.lite ? 7 : 14;
  for (let i = 0; i < n; i++) {
    const tt = tb - rnd(r.seed, i) * 0.6;
    if (tt < 0 || tt > 1.3) continue;
    const p = tt / 1.3;
    const ang = rnd(r.seed, i + 3) * Math.PI * 2;
    const d = 0.4 + rnd(r.seed, i + 6) * 1.6;
    const tw = Math.abs(Math.sin(tt * 9 + i));
    k.g(P.twinkle, s.x + Math.cos(ang) * d, 0.5 + rnd(r.seed, i + 8) * 2.2 + p * 0.6, s.z + Math.sin(ang) * d * 0.7, 0.75 * tw, 0, false, i % 3 ? P.sparkle : WHITE, 1 - p);
  }
}

/** The colour wave: rings racing out from the pile, leaving paint (or light, or slime) on the floor. */
export function recolor(k: Kit, r: Run, t: number, P: Pal, look: EventLook, mono: boolean) {
  const DUR = 2.3;
  if (t < 0 || t > DUR) return;
  const { x, z } = r.pile;
  const R = r.rx * 1.12;
  const add = look.wave.additive;
  const rings = mono ? 3 : 4;
  for (let i = 0; i < rings; i++) {
    const tt = t - i * 0.11;
    if (tt < 0 || tt > 1.25) continue;
    const p = tt / 1.25;
    const rr = 0.4 + easeOut(p) * R;
    const c = mono ? r.color : FOUR[i];
    const al = (1 - p) * (add ? 1 : 0.9);
    k.g(CELL_ID.ring, x, 0.05, z, rr * 2.1, 0, true, c, al, rr * 2.1 * (r.rz / r.rx));
    if (!add) k.s(CELL_ID.ring, x, 0.045, z, rr * 2, 0, true, c, al * 0.85, rr * 2 * (r.rz / r.rx));
  }
  // blots where the wave passed
  const n = k.lite ? 9 : 18;
  for (let i = 0; i < n; i++) {
    const ang = rnd(r.seed, i) * Math.PI * 2;
    const dk = 0.25 + rnd(r.seed, i + 1) * 0.75;
    const born = 0.12 + dk * 0.55;
    const tt = t - born;
    if (tt < 0) continue;
    const px = x + Math.cos(ang) * dk * R;
    const pz = z + Math.sin(ang) * dk * r.rz * 1.12;
    const c = mono ? r.color : FOUR[i % 4];
    const grow = easeOutBack(tt / 0.25, 2.2);
    const al = fade(tt, DUR - born, 0.02, 0.6);
    const size = (0.7 + rnd(r.seed, i + 2) * 0.8) * grow;
    if (add) {
      k.g(look.wave.splat, px, 0.06, pz, size * 1.4, ang, true, c, al * 0.9);
      k.g(CELL_ID.spark, px, 0.3 + tt * 0.6, pz, size * 0.8, tt * 3 + i, false, c, al * (1 - clamp01(tt / 0.7)));
    } else {
      k.s(look.wave.splat, px, 0.03, pz, size, ang, true, c, al * 0.95);
      k.g(CELL_ID.glow, px, 0.06, pz, size * 1.6, 0, true, c, al * 0.4);
    }
    if (look.wave.bubbles) {
      for (let b = 0; b < 2; b++) {
        const q = ((tt * 0.9 + b * 0.5 + rnd(r.seed, i + 40)) % 1);
        k.s(CELL_ID.ring, px + Math.sin(q * 8 + i) * 0.12, 0.1 + q * 1.1, pz, 0.22 * (1 - q * 0.4), 0, false, c, al * (1 - q));
      }
    }
  }
}

/** Carousel: lights (bulbs, neon streaks, stars, bats…) racing round the table the way play goes. */
const op: Spot = { x: 0, y: 0, z: 0 };
const oq: Spot = { x: 0, y: 0, z: 0 };

export function carousel(k: Kit, r: Run, t: number, P: Pal, look: EventLook, view: THREE.Matrix4) {
  const DUR = 1.9;
  if (t < 0 || t > DUR) return;
  const o = look.orbit;
  const { x, z } = r.pile;
  const a0 = fade(t, DUR, 0.25, 0.4);
  const turn = r.dir * Math.PI * 2 * 1.15 * easeInOut(t / DUR);
  const n = k.lite ? 8 : 14;
  const rx = r.rx * 0.8;
  const rz = r.rz * 0.8;
  for (let i = 0; i < n; i++) {
    const c = P.orbit[i % P.orbit.length];
    const trail = o.additive ? 3 : 2;
    for (let j = trail; j >= 0; j--) {
      const a = (i / n) * Math.PI * 2 + turn - r.dir * j * 0.07;
      const px = x + Math.cos(a) * rx;
      const pz = z + Math.sin(a) * rz;
      const py = 0.7 + Math.sin(a * 3 + t * 4) * 0.2;
      const al = a0 * (1 - j / (trail + 1));
      if (j === 0) {
        // the moving thing itself, turned along the circle
        const flap = o.flap ? 0.35 + 0.65 * Math.abs(Math.sin(t * 15 + i)) : 1;
        let rot = 0;
        if (o.cell === CELL_ID.streak) {
          // a streak lies along its way round, as seen on screen
          const b = a - r.dir * 0.05;
          op.x = x + Math.cos(b) * rx;
          op.y = 0.7 + Math.sin(b * 3 + t * 4) * 0.2;
          op.z = z + Math.sin(b) * rz;
          oq.x = px;
          oq.y = py;
          oq.z = pz;
          rot = screenAngle(view, op, oq);
        }
        if (o.additive) k.g(o.cell, px, py, pz, o.size, rot, false, c, al);
        else k.s(o.cell, px, py, pz, o.size, Math.sin(t * 8 + i) * 0.2, false, c, al, o.size * (o.flap ? 0.62 * flap : 1));
        k.g(CELL_ID.glow, px, py, pz, o.size * 2.4, 0, false, o.flap ? P.hot : c, al * (o.flap ? 0.5 : 0.6));
      } else k.g(CELL_ID.glow, px, py, pz, o.size * (1.6 - j * 0.3), 0, false, o.flap ? P.hot : c, al * 0.5);
    }
  }
  // a whirl at the pile
  k.g(CELL_ID.swirl, x, 0.06, z, 3.2, -r.dir * t * 7, true, P.ring, 0.5 * a0 * hump(t / DUR));
}

/** Upside down: a spiral of stars twisting up out of the pile while the camera rolls over. */
export function upside(k: Kit, r: Run, t: number, P: Pal) {
  const DUR = 1.8;
  if (t < 0 || t > DUR) return;
  const { x, z } = r.pile;
  const n = k.lite ? 10 : 20;
  for (let i = 0; i < n; i++) {
    const tt = t - (i / n) * 0.5;
    if (tt < 0 || tt > 1.3) continue;
    const p = tt / 1.3;
    const a = i * 2.4 + tt * 5;
    const d = 0.3 + easeOut(p) * 2.6;
    k.g(i % 2 ? P.twinkle : CELL_ID.spark, x + Math.cos(a) * d, 0.3 + p * 2.8, z + Math.sin(a) * d * 0.7, 0.55 * (1 - p * 0.5), tt * 4, false, P.confetti[i % P.confetti.length], 1 - p);
  }
  k.g(CELL_ID.swirl, x, 0.06, z, 3.6, t * 6, true, P.ring, 0.6 * hump(t / DUR));
}

/** Blind round: dark fog rolls out over the table, and a question mark pops over every seat. */
export function blind(k: Kit, r: Run, t: number, P: Pal) {
  const DUR = 2.5;
  if (t < 0 || t > DUR) return;
  const { x, z } = r.pile;
  const n = k.lite ? 7 : 13;
  for (let i = 0; i < n; i++) {
    const tt = t - rnd(r.seed, i) * 0.3;
    if (tt < 0) continue;
    const p = clamp01(tt / (DUR - 0.3));
    const a = (i / n) * Math.PI * 2 + rnd(r.seed, i + 1) * 0.5;
    const d = easeOut(p * 1.4) * r.rx * (0.55 + rnd(r.seed, i + 2) * 0.4);
    k.s(CELL_ID.glow, x + Math.cos(a) * d, 0.5 + p * 0.5, z + Math.sin(a) * d * (r.rz / r.rx), 3 + p * 3.5, 0, false, P.fog, 0.75 * hump(p));
  }
  for (let i = 0; i < r.nSeats; i++) {
    const s = r.seats[i];
    const tt = t - 0.35 - i * 0.07;
    if (tt < 0 || tt > 1.7) continue;
    const pop = easeOutBack(tt / 0.3, 2.4);
    const al = fade(tt, 1.7, 0.05, 0.4);
    k.g(CELL_ID.glow, s.x, 1.5, s.z, 1.6 * pop, 0, false, P.hot, 0.45 * al);
    k.i(CELL_ID.question, s.x, 1.5 + Math.sin(tt * 5 + i) * 0.08, s.z, 0.9 * pop, Math.sin(tt * 4 + i) * 0.15, false, WHITE, al);
  }
}

/** Blitz: electric pulses from the pile and a tick of light at every seat, one after another. */
export function blitz(k: Kit, r: Run, t: number, P: Pal) {
  const DUR = 1.8;
  if (t < 0 || t > DUR) return;
  const { x, z } = r.pile;
  for (let i = 0; i < 3; i++) ring(k, x, z, t - i * 0.18, 0.55, 0.4, 3.2, i % 2 ? P.boltCore : P.boltGlow, 0.9, true, 0.05);
  // speed lines shooting out flat on the table
  const n = k.lite ? 8 : 16;
  for (let i = 0; i < n; i++) {
    const tt = t - rnd(r.seed, i) * 0.5;
    if (tt < 0 || tt > 0.55) continue;
    const p = tt / 0.55;
    const a = (i / n) * Math.PI * 2;
    const d = 1 + easeOut(p) * r.rx * 0.8;
    k.g(CELL_ID.streak, x + Math.cos(a) * d, 0.08, z + Math.sin(a) * d * (r.rz / r.rx), 2.2, -a, true, P.boltGlow, 1 - p, 0.4);
  }
  // crackles
  const nc = k.lite ? 2 : 4;
  for (let i = 0; i < nc; i++) {
    if (t > 1 || Math.sin(t * 45 + i * 2) < 0.2) continue;
    const a = rnd(r.seed + Math.floor(t * 15), i) * Math.PI * 2;
    k.g(P.crackle, x + Math.cos(a) * 1.2, 0.4, z + Math.sin(a) * 0.8, 0.6, a, false, P.boltGlow, 1 - t);
  }
  // everyone is on the clock
  for (let i = 0; i < r.nSeats; i++) {
    const s = r.seats[i];
    const tt = t - 0.3 - i * 0.09;
    ring(k, s.x, s.z, tt, 0.5, 0.2, 1.3, P.boltGlow, 0.9, true, 0.05);
    flash(k, s.x, 0.6, s.z, tt, 0.35, 1.6, P.boltGlow, 0.8);
  }
}

const dart: Spot = { x: 0, y: 0, z: 0 };
const dartPrev: Spot = { x: 0, y: 0, z: 0 };
const ra: Spot = { x: 0, y: 0.9, z: 0 };
const rb: Spot = { x: 0, y: 0.9, z: 0 };

/** Robin Hood: an arrow flies from the leader to the player with the most cards, trailing sparkles. */
export function robin(k: Kit, r: Run, t: number, P: Pal, view: THREE.Matrix4) {
  const DUR = 2.1;
  if (t < 0 || t > DUR) return;
  const a = r.target;
  ring(k, a.x, a.z, t, 0.6, 0.3, 1.8, P.sparkle, 0.9, true, 0.05);
  if (!r.hasOther) {
    flash(k, a.x, 0.6, a.z, t, 0.6, 2.4, P.sparkle, 0.8);
    return;
  }
  const b = r.other;
  const FLY = 0.85;
  const tt = t - 0.25;
  ra.x = a.x;
  ra.z = a.z;
  rb.x = b.x;
  rb.z = b.z;
  if (tt >= 0 && tt < FLY) {
    const p = easeInOut(tt / FLY);
    arc(ra, rb, p, 2.2, dart);
    const q = arc(ra, rb, Math.max(0, p - 0.03), 2.2, dartPrev);
    const ang = screenAngle(view, q, dart);
    const n = k.lite ? 5 : 10;
    for (let j = 1; j <= n; j++) {
      const pj = p - j * 0.025;
      if (pj < 0) break;
      const w = arc(ra, rb, pj, 2.2, dartPrev);
      k.g(j % 2 ? CELL_ID.glow : P.twinkle, w.x, w.y, w.z, 0.7 * (1 - j / n), j, false, j % 3 ? P.sparkle : WHITE, 0.9 * (1 - j / n));
    }
    k.g(CELL_ID.glow, dart.x, dart.y, dart.z, 1.6, 0, false, P.sparkle, 0.6);
    k.i(CELL_ID.dart, dart.x, dart.y, dart.z, 2.2, ang, false, null, 1);
  }
  const d = tt - FLY;
  if (d >= 0) {
    ring(k, b.x, b.z, d, 0.6, 0.3, 2.2, P.sparkle, 1, true, 0.05);
    flash(k, b.x, 0.7, b.z, d, 0.4, 3, P.sparkle, 0.9);
    sparks(k, b.x, 0.6, b.z, d, 14, 3, [P.sparkle, WHITE, P.hot], 0.32, 0.8, r.seed + 9);
  }
}

/** Group dare: confetti from the pile and a spotlight sweep. */
export function group(k: Kit, r: Run, t: number, P: Pal) {
  const { x, z } = r.pile;
  confetti(k, x, 0.4, z, t, 40, 9, P.confetti, 2.3, r.seed, 0.3);
  ring(k, x, z, t, 0.7, 0.4, 3.4, P.ring, 0.8, true, 0.05);
  flash(k, x, 0.8, z, t, 0.5, 4, P.hot, 0.6);
}

/** Coin of fate: a coin spins up out of the current player's place, sparkling. */
export function coin(k: Kit, r: Run, t: number, P: Pal) {
  const DUR = 2.1;
  if (t < 0 || t > DUR) return;
  const s = r.target;
  const p = t / DUR;
  const y = 0.8 + easeOut(clamp01(t / 0.7)) * 1.4 + Math.sin(t * 3) * 0.08;
  const al = fade(t, DUR, 0.1, 0.45);
  const w = Math.abs(Math.cos(t * 9));
  k.g(CELL_ID.glow, s.x, y, s.z, 2.6, 0, false, P.sparkle, 0.55 * al);
  // spinning on its edge: its width breathes
  k.i(CELL_ID.coin, s.x, y, s.z, 1.4 * Math.max(0.12, w), 0, false, null, al, 1.4);
  ring(k, s.x, s.z, t, 0.6, 0.3, 2, P.sparkle, 0.9, true, 0.05);
  const n = k.lite ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + t * 2;
    const tw = Math.abs(Math.sin(t * 7 + i * 1.3));
    k.g(P.twinkle, s.x + Math.cos(a) * 1.1, y + Math.sin(a) * 0.5, s.z, 0.5 * tw, 0, false, i % 2 ? P.sparkle : WHITE, al * (1 - p * 0.5));
  }
}
