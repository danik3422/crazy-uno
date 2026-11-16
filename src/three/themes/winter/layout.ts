import * as THREE from 'three';
import type { Ball, Placer } from '../decorKit';

/*
 * Where the Winter decor stands. The lake's shore runs just outside the opponents, so the decor keeps to the snow:
 * tall things only in the far corners (beside, never behind, the top players' plates), lanterns and low
 * snow drifts round them, more pines at the far sides for ultrawide screens. `fitToHud` then keeps all of it
 * out from under the HUD and the plates on the actual screen.
 */

export interface Spot { x: number; z: number; s: number }

export interface WinterLayout {
  pines: Spot[];
  lanterns: Spot[];
  /** null: no room for it on this screen */
  cabin: Spot | null;
  snowman: Spot | null;
  flakes: number;
  burst: number;
  box: { x: number; z0: number; z1: number; y: number };
  /** snowfall only shows above this screen height (NDC y) or beyond this distance from the middle (NDC x) */
  mask: THREE.Vector2;
  aurora: { w: number; z: number; h: number };
  cam: THREE.Vector3;
}

export function layout(portrait: boolean, lite: boolean): WinterLayout {
  const pines: Spot[] = portrait
    ? [
        { x: -6.0, z: -9.6, s: 1.0 }, { x: 6.1, z: -9.2, s: 1.05 }, { x: -6.4, z: -7.2, s: 1.15 }, { x: 6.6, z: -6.8, s: 1.2 },
        { x: -2.6, z: -11.6, s: 0.9 }, { x: 2.4, z: -12.0, s: 0.95 }, { x: 0.2, z: -13.2, s: 0.85 }, { x: -7.2, z: -11.4, s: 1.3 },
        { x: 7.4, z: -11.0, s: 1.3 },
      ]
    : [
        { x: -11.6, z: -4.4, s: 1.3 }, { x: 11.8, z: -4.0, s: 1.3 }, { x: -12.6, z: -8.6, s: 1.5 }, { x: 12.8, z: -9.0, s: 1.5 },
        { x: -7.6, z: -10.8, s: 1.15 }, { x: 7.4, z: -10.6, s: 1.15 }, { x: -12.8, z: -0.6, s: 1.2 }, { x: 13.0, z: -0.2, s: 1.25 },
        { x: -4.6, z: -12.0, s: 1.0 }, { x: 4.8, z: -12.4, s: 1.0 }, { x: -10.2, z: -11.4, s: 1.35 }, { x: 10.4, z: -11.8, s: 1.35 },
      ];
  const lanterns: Spot[] = portrait
    ? [{ x: -4.4, z: -6.4, s: 0.9 }, { x: 4.4, z: -6.2, s: 0.9 }, { x: -5.6, z: -4.6, s: 0.85 }, { x: 5.6, z: -4.4, s: 0.85 }]
    : [{ x: -10.0, z: -5.8, s: 0.95 }, { x: 10.0, z: -5.4, s: 0.95 }, { x: -11.0, z: -1.8, s: 0.95 }, { x: 11.0, z: -1.4, s: 0.95 }];
  return {
    pines: lite ? pines.slice(0, 6) : pines,
    lanterns: lite ? lanterns.slice(0, 2) : lanterns,
    cabin: portrait ? { x: -3.9, z: -9.3, s: 0.72 } : { x: -9.4, z: -7.6, s: 0.8 },
    snowman: portrait ? { x: 3.7, z: -9.0, s: 0.68 } : { x: 9.2, z: -7.2, s: 0.8 },
    flakes: lite ? 240 : 560,
    burst: lite ? 24 : 40,
    box: portrait ? { x: 9, z0: -15, z1: 6, y: 9 } : { x: 15, z0: -13, z1: 4, y: 8 },
    mask: portrait ? new THREE.Vector2(0.52, 0.9) : new THREE.Vector2(0.6, 0.8),
    aurora: portrait ? { w: 18, z: -13.4, h: 3.2 } : { w: 32, z: -11.2, h: 2.6 },
    cam: portrait ? new THREE.Vector3(0, 15, 10.6) : new THREE.Vector3(0, 7.6, 9.8),
  };
}

/** Sizes of the decor pieces at scale 1, for checking them against the HUD: a ball of radius `r` around height `y`. */
export interface Sizes {
  pine: { r: number; y: number };
  lantern: { r: number; y: number };
  cabin: { r: number; y: number };
  snowman: { r: number; y: number };
}

/**
 * Where a ball of radius `r` around (x, y, z) lands: clear of the HUD and the plates by `pad` pixels, and with its
 * middle on the screen.
 */
export type Check = (x: number, y: number, z: number, r: number, pad: number) => { clear: boolean; seen: boolean };

/** the gap (px) kept between the HUD and the cabin or the snowman (they draw the eye), and anything else */
const PAD_BIG = 18;
const PAD = 6;

/** the steps (table units) the cabin and the snowman may take to get out from under the HUD: inward, back, forward */
const MOVES = (() => {
  const out: { dx: number; dz: number }[] = [];
  for (let dx = 0; dx <= 5; dx += 0.5) for (let dz = -3; dz <= 2; dz += 0.5) out.push({ dx, dz });
  // the nearest first; stepping toward the camera brings it nearer the side plates, so it costs a little more
  return out.sort((a, b) => Math.hypot(a.dx, a.dz * (a.dz > 0 ? 1.4 : 1)) - Math.hypot(b.dx, b.dz * (b.dz > 0 ? 1.4 : 1)));
})();

/**
 * Keeps the winter scene out from under the HUD and the plates on this screen. The cabin and the snowman move
 * (inward, back or forward) to the nearest spot that is clear and on screen, or stay away when there is none;
 * a pine or a lantern still under the HUD, or in the way of the cabin or the snowman, is left out.
 */
export function fitToHud(L: WinterLayout, S: Sizes, check: Check): WinterLayout {
  const place = (o: Spot | null, size: { r: number; y: number }) => {
    if (!o) return null;
    const side = -Math.sign(o.x || 1);
    for (const { dx, dz } of MOVES) {
      const x = o.x + side * dx;
      const z = o.z + dz;
      const c = check(x, size.y * o.s, z, size.r * o.s, PAD_BIG);
      if (c.clear && c.seen) return { ...o, x, z };
    }
    return null;
  };
  const cabin = place(L.cabin, S.cabin);
  const snowman = place(L.snowman, S.snowman);
  // a pine never stands inside the cabin or the snowman
  const inTheWay = (p: Spot) =>
    [cabin && { o: cabin, r: S.cabin.r }, snowman && { o: snowman, r: S.snowman.r }].some(
      q => q && Math.hypot(p.x - q.o.x, p.z - q.o.z) < q.r * q.o.s + S.pine.r * p.s * 0.6,
    );
  const pines = L.pines.filter(p => check(p.x, S.pine.y * p.s, p.z, S.pine.r * p.s, PAD).clear && !inTheWay(p));
  const lanterns = L.lanterns.filter(p => check(p.x, S.lantern.y * p.s, p.z, S.lantern.r * p.s, PAD).clear && !inTheWay(p));
  return { ...L, cabin, snowman, pines, lanterns };
}

/** spots in the band past the far players: every x, at every depth */
export const farBand = (xs: number[], zs: number[]) => zs.flatMap(z => xs.map(x => ({ x, z })));

/** puts the spots on one side (sign of x) first */
const sideFirst = (spots: { x: number; z: number }[], side: number) => [...spots.filter(p => Math.sign(p.x) === side), ...spots.filter(p => Math.sign(p.x) !== side)];

/**
 * A phone on its side has no free corners to speak of: its plates, the dock and the hand take most of the screen.
 * The scene is placed in what is left (see Placer): the strips of snow at the side edges, beside and between the
 * side players, and the band past the far ones. The cabin and the snowman come first (one at each side when they
 * can), then two lanterns and up to six pines, each sized for the phone's short screen.
 */
export function phoneLayout(L: WinterLayout, P: Placer, S: Record<keyof Sizes, Ball>, prev?: WinterLayout): WinterLayout {
  const h = P.h;
  const es = [1.6, 2.4, 1, 3.2, 4.2];
  const sideZ = [-3, -1.5, -4.5, 0, 1.5, -6, 3, 4];
  const sides = [-1, 1].flatMap(side => [...P.side(side, sideZ, es), ...P.strip(side)]);
  const back = farBand([-9, 9, -7, 7, -11, 11, -5, 5, -13, 13], [-10, -12, -8.5]);
  const big = { maxPx: 0.16 * h, minPx: 0.042 * h, onScreen: 0.95 };
  const cabin = P.place([...sideFirst(sides, -1), ...sideFirst(back, -1)], S.cabin, big, prev?.cabin);
  // the snowman takes the other side from the cabin
  const away = cabin && cabin.x < 0 ? 1 : -1;
  const snowman = P.place([...sideFirst(sides, away), ...sideFirst(back, away)], S.snowman, big, prev?.snowman);
  const lanterns: Spot[] = [];
  const lanternSpots = [-1, 1].flatMap(side => [...P.side(side, [0.5, -1, 2, -2.5, -4, -5.5, 3, 4], [0.6, 1.2, 2, 3, 4]), ...P.strip(side)]);
  for (let i = 0; i < L.lanterns.length; i++) {
    const p = P.place(sideFirst(lanternSpots, i % 2 ? 1 : -1), S.lantern, { maxPx: 0.07 * h, minPx: 0.03 * h, onScreen: 0.9 }, prev?.lanterns[i]);
    if (p) lanterns.push(p);
  }
  const pines: Spot[] = [];
  const sidePines = [-1, 1].flatMap(side => [...P.side(side, [-5, -2, 1, -7, 3, 4], [0.8, 1.8, 2.8, 3.8]), ...P.strip(side)]);
  const farPines = farBand([-12, 12, -9.5, 9.5, -7, 7, -4.5, 4.5, -2, 2], [-12.5, -10.5, -8.5]);
  // the pines frame the table: the sides by turns, every third one in the band past the far players
  for (let i = 0; i < L.pines.length; i++) {
    const want = i % 2 ? 1 : -1;
    const near = sideFirst(sidePines, want);
    const far = sideFirst(farPines, want);
    const p = P.place(i % 3 === 2 ? [...far, ...near] : [...near, ...far], S.pine, { maxPx: 0.12 * h, minPx: 0.045 * h, onScreen: 0.6 }, prev?.pines[i]);
    if (p) pines.push(p);
  }
  return { ...L, cabin, snowman, pines, lanterns };
}
