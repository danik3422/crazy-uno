import * as THREE from 'three';
import { CELL_ID } from './atlas';
import type { Kit, Spot } from './kit';

/** Small building blocks shared by the card effects. All of them are pure functions of time. */

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeIn = (x: number) => Math.pow(clamp01(x), 2);
export const easeInOut = (x: number) => {
  const p = clamp01(x);
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
};
export function easeOutBack(x: number, c1 = 1.9) {
  const p = clamp01(x);
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}
/** 0 → 1 → 0 over [0, 1] */
export const hump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
/** fades in over `fi` seconds and out over the last `fo` seconds of `life` */
export const fade = (t: number, life: number, fi = 0.08, fo = 0.3) =>
  t < 0 || t > life ? 0 : Math.min(1, t / fi, (life - t) / fo);

/** a stable random number in [0, 1) for (seed, i) */
export function rnd(seed: number, i: number) {
  const x = Math.sin(seed * 91.17 + i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const WHITE = new THREE.Color(1, 1, 1);
export const GOLD = new THREE.Color(1, 0.84, 0.35);
export const DARK = new THREE.Color(0.25, 0.25, 0.3);
/** colour as written to the screen (the effect shaders do no colour-space conversion) */
export const raw = (hex: string, out = new THREE.Color()) => out.setHex(parseInt(hex.slice(1), 16), THREE.LinearSRGBColorSpace);
export const FOUR = ['#e5413a', '#f2bf16', '#26a556', '#2c79dc'].map(h => raw(h));

/** An expanding ring flat on the table: a solid core (reads on any floor) inside a coloured glow. */
export function ring(k: Kit, x: number, z: number, t: number, dur: number, r0: number, r1: number, c: THREE.Color, a = 1, shock = false, y = 0.03) {
  if (t < 0 || t > dur) return;
  const p = t / dur;
  const r = r0 + (r1 - r0) * easeOut(p);
  const al = a * (1 - p) * (1 - p * 0.3);
  k.g(shock ? CELL_ID.shock : CELL_ID.ring, x, y, z, r * 2.15, 0, true, c, al);
  k.s(CELL_ID.ring, x, y + 0.004, z, r * 2, 0, true, shock ? WHITE : c, al * 0.9);
}

/** Sparks thrown up and out from a point, falling back with gravity: solid coloured bits and bright twinkles. */
export function burst(k: Kit, x: number, y: number, z: number, t: number, n: number, speed: number, c: THREE.Color | null, size: number, dur: number, seed: number, multi = false) {
  if (t < 0 || t > dur) return;
  const p = t / dur;
  const count = k.lite ? Math.ceil(n / 2) : n;
  for (let i = 0; i < count; i++) {
    const a = rnd(seed, i) * Math.PI * 2;
    const v = speed * (0.45 + rnd(seed, i + 50) * 0.75);
    const up = speed * (0.4 + rnd(seed, i + 90) * 0.9);
    const px = x + Math.cos(a) * v * t;
    const pz = z + Math.sin(a) * v * t * 0.8;
    const py = Math.max(0.05, y + up * t - 5 * t * t);
    const col = multi ? FOUR[i % 4] : c;
    const sz = size * (1 - p * 0.6);
    if (i % 3) k.s(CELL_ID.dot, px, py, pz, sz * 0.5, 0, false, col, 1 - p * p);
    else k.g(CELL_ID.spark, px, py, pz, sz * 1.3, t * 6 + i, false, col ?? WHITE, 1 - p * p);
  }
}

/** A soft flash: a big glow that swells and fades. */
export function flash(k: Kit, x: number, y: number, z: number, t: number, dur: number, size: number, c: THREE.Color, a = 1) {
  if (t < 0 || t > dur) return;
  const p = t / dur;
  k.g(CELL_ID.glow, x, y, z, size * (0.6 + easeOut(p) * 0.6), 0, false, c, a * (1 - p));
}

const tmp = { x: 0, y: 0, z: 0 };
/** a point on an arc from a to b, `lift` high in the middle */
export function arc(a: Spot, b: Spot, p: number, lift: number, out = tmp) {
  const e = clamp01(p);
  out.x = a.x + (b.x - a.x) * e;
  out.z = a.z + (b.z - a.z) * e;
  out.y = a.y + (b.y - a.y) * e + 4 * e * (1 - e) * lift;
  return out;
}

/**
 * Ghost cards shooting from `a` to `b` one after another, each with a glowing trail, popping on arrival.
 * Returns how many have landed.
 */
export function volley(k: Kit, a: Spot, b: Spot, t: number, n: number, gap: number, dur: number, c: THREE.Color, seed: number, lift = 1.6, size = 0.8) {
  let landed = 0;
  const yaw = Math.atan2(b.x - a.x, b.z - a.z);
  for (let i = 0; i < n; i++) {
    const tt = t - i * gap;
    if (tt < 0) continue;
    const p = tt / dur;
    if (p >= 1) {
      landed++;
      const d = tt - dur;
      burst(k, b.x, b.y + 0.3, b.z, d, 6, 2.2, c, 0.28, 0.45, seed + i * 7);
      ring(k, b.x, b.z, d, 0.4, 0.2, 0.9, c, 0.8);
      continue;
    }
    const side = (rnd(seed, i) - 0.5) * 0.8;
    const e = easeInOut(p);
    const q = arc(a, b, e, lift + side * 0.5);
    const px = q.x + Math.cos(yaw) * side * hump(e);
    const pz = q.z - Math.sin(yaw) * side * hump(e);
    // a card back tumbling through the air
    k.card(px, q.y, pz, -Math.PI / 2 + e * Math.PI * 2 * (0.6 + rnd(seed, i + 3) * 0.6), yaw, e * 3 + i, size * (0.8 + hump(e) * 0.4));
    k.g(CELL_ID.cardGlow, px, q.y, pz, size * 1.9, 0, false, c, 1, size * 2.5);
    // trail: a few fading glows back along the path
    const trail = k.lite ? 2 : 4;
    for (let j = 1; j <= trail; j++) {
      const qe = easeInOut(p - j * 0.05);
      if (qe <= 0) break;
      const r = arc(a, b, qe, lift + side * 0.5);
      k.g(CELL_ID.glow, r.x + Math.cos(yaw) * side * hump(qe), r.y, r.z - Math.sin(yaw) * side * hump(qe), size * (1.1 - j * 0.18), 0, false, c, 0.6 - j * 0.12);
    }
  }
  return landed;
}

/** A splash of paint flat on the table in colour c, with droplets thrown around it. */
export function splash(k: Kit, x: number, z: number, t: number, c: THREE.Color, scale: number, seed: number) {
  if (t < 0 || t > 1.3) return;
  const grow = easeOutBack(t / 0.22, 2.4);
  const a = t < 0.9 ? 1 : 1 - (t - 0.9) / 0.4;
  k.s(CELL_ID.splat, x, 0.012, z, 3.2 * scale * grow, seed * 6, true, c, 0.95 * a);
  k.g(CELL_ID.glow, x, 0.05, z, 6 * scale * grow, 0, true, c, 0.6 * a);
  const n = k.lite ? 7 : 12;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + rnd(seed, i) * 0.4;
    const dist = scale * (1.5 + rnd(seed, i + 20) * 1.6);
    const fly = clamp01(t / 0.45);
    const px = x + Math.cos(ang) * dist * easeOut(fly);
    const pz = z + Math.sin(ang) * dist * easeOut(fly) * 0.8;
    if (fly < 1) {
      // drops in the air
      const py = 0.1 + 4 * fly * (1 - fly) * (0.8 + rnd(seed, i + 40));
      k.s(CELL_ID.dot, px, py, pz, 0.36 * scale, 0, false, c, 1);
    } else {
      // and the blots they leave
      k.s(CELL_ID.splat, px, 0.012, pz, (0.55 + rnd(seed, i + 60) * 0.5) * scale, i, true, c, 0.95 * a);
    }
  }
}

/** true the first time it is asked for this bit of this effect (one-off things: a shake, a sound) */
export function once(a: { fired: number }, bit: number) {
  if (a.fired & bit) return false;
  a.fired |= bit;
  return true;
}
