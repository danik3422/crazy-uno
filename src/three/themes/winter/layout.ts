import * as THREE from 'three';

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
