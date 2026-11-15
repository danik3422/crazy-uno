/*
 * Where the Halloween decor stands. Everything lives at the rim of what the camera sees: the far graveyard
 * (which lands in the thin band at the top of the screen) and the two far corners, never in the middle where
 * the cards, the pile and the player plates are. Checked at 4:3, 16:9, 21:9, phone landscape and tablet portrait.
 *
 * The corner lanterns hug the side edges of the screen whatever its shape: a spot with `e` is placed `e` units
 * in from the visible edge at its depth (x only gives the side), see `fitToScreen`.
 */

export interface Spot { x: number; z: number; s: number; e?: number }
export interface Ghost { x: number; y: number; z: number }

export interface HalloweenLayout {
  pumpkins: Spot[];
  tombs: Spot[];
  crosses: Spot[];
  candles: Spot[];
  ghosts: Ghost[];
  bats: number;
  /** the bats circle this ellipse, high over the far graves */
  batZ: number;
  batRX: number;
  batRZ: number;
  /** will-o'-wisps drift in this box (x from..to, z from..to), kept off the middle by `wispGap` */
  wisps: number;
  wispBox: [number, number, number, number];
  wispGap: number;
}

const LANDSCAPE: HalloweenLayout = {
  // a lantern in each far corner (between the top HUD and the side plates), two small ones out among the graves
  pumpkins: [
    { x: -1, z: -4.7, s: 0.84, e: 1.4 }, { x: 1, z: -4.9, s: 0.82, e: 1.4 },
    { x: -5.0, z: -10.6, s: 0.74 }, { x: 5.3, z: -10.8, s: 0.76 },
  ],
  tombs: [
    { x: -9.4, z: -9.0, s: 1.0 }, { x: -6.6, z: -12.0, s: 0.95 }, { x: -2.6, z: -13.0, s: 0.85 },
    { x: 3.0, z: -12.9, s: 0.9 }, { x: 6.8, z: -12.1, s: 1.0 }, { x: 9.6, z: -9.2, s: 1.05 },
    { x: -1, z: -8.4, s: 1.1, e: 1.2 }, { x: 1, z: -8.8, s: 1.1, e: 1.2 },
  ],
  crosses: [{ x: -11.2, z: -10.6, s: 0.95 }, { x: -4.1, z: -12.6, s: 0.8 }, { x: 4.4, z: -12.6, s: 0.85 }, { x: 11.3, z: -10.9, s: 1.0 }],
  candles: [
    { x: -1, z: -5.6, s: 1.05, e: 0.65 }, { x: -1, z: -4.0, s: 0.6, e: 0.7 }, { x: -1, z: -6.0, s: 0.7, e: 2.3 },
    { x: 1, z: -5.8, s: 1.1, e: 0.65 }, { x: 1, z: -4.2, s: 0.65, e: 0.7 }, { x: 1, z: -6.2, s: 0.75, e: 2.3 },
    { x: -4.1, z: -10.3, s: 0.75 }, { x: 4.4, z: -10.4, s: 0.7 }, { x: -8.6, z: -9.0, s: 0.9 }, { x: 8.8, z: -9.3, s: 0.65 },
  ],
  ghosts: [{ x: -7.4, y: 0.95, z: -7.9 }, { x: 7.6, y: 1.0, z: -8.1 }],
  bats: 12,
  batZ: -10.5,
  batRX: 10,
  batRZ: 1.4,
  wisps: 22,
  wispBox: [-12.5, 12.5, -12.5, -6.5],
  wispGap: 4.5,
};

const PORTRAIT: HalloweenLayout = {
  // the lanterns sit at the side edges, below the HUD and above the side players
  pumpkins: [{ x: -5.4, z: -5.6, s: 0.8 }, { x: 5.5, z: -5.9, s: 0.78 }, { x: 1.8, z: -12.6, s: 0.75 }],
  tombs: [
    { x: -5.6, z: -10.6, s: 1.0 }, { x: -2.9, z: -11.9, s: 0.9 }, { x: 1.4, z: -12.6, s: 0.9 },
    { x: 3.4, z: -11.6, s: 1.05 }, { x: 6.2, z: -10.4, s: 1.0 },
  ],
  crosses: [{ x: -0.2, z: -13.2, s: 0.85 }, { x: 5.4, z: -12.2, s: 0.9 }],
  candles: [
    { x: -4.6, z: -6.4, s: 0.9 }, { x: -6.0, z: -5.0, s: 0.6 }, { x: 4.7, z: -6.6, s: 1.0 },
    { x: 6.1, z: -5.2, s: 0.6 }, { x: 1.0, z: -12.2, s: 0.7 },
  ],
  ghosts: [{ x: -2.4, y: 0.85, z: -8.4 }, { x: 3.0, y: 0.9, z: -8.2 }],
  bats: 10,
  batZ: -11.5,
  batRX: 5.2,
  batRZ: 1.2,
  wisps: 16,
  wispBox: [-6.5, 6.5, -13, -8.4],
  wispGap: 0,
};

/**
 * Puts the edge-anchored spots `e` units in from the visible edge, given the visible half-width at a depth.
 * Never closer to the middle than `minX`, so on a narrow window they slide off the side instead of onto the table.
 */
export function fitToScreen(L: HalloweenLayout, halfWidth: (z: number) => number, minX = 8.6): HalloweenLayout {
  const fit = (list: Spot[]) => list.map(p => (p.e === undefined ? p : { ...p, x: Math.sign(p.x) * Math.max(minX, halfWidth(p.z) - p.e) }));
  return { ...L, pumpkins: fit(L.pumpkins), tombs: fit(L.tombs), candles: fit(L.candles) };
}

/** Sizes of the decor pieces at scale 1, for checking them against the HUD: a ball of radius `r` around height `y`. */
export interface Sizes {
  pumpkin: { r: number; y: number };
  tomb: { r: number; y: number };
  cross: { r: number; y: number };
  ghost: { r: number; y: number };
}

/** is a ball of radius `r` around (x, y, z) clear of the HUD and the plates on the screen? */
export type Clear = (x: number, y: number, z: number, r: number) => boolean;

/** the ways a corner lantern may step aside, tried in this order: deeper or nearer, further in, then smaller */
const STEPS = (() => {
  const out: { dz: number; de: number; k: number }[] = [];
  for (const k of [1, 0.85, 0.7])
    for (const de of [0, -0.5, 0.6])
      for (const dz of [0, -0.5, 0.5, -1, 1, -1.5]) out.push({ dz, de, k });
  return out;
})();
/** how far a ghost may drift aside to get out from under the HUD (table units, either way), in steps */
const GHOST_STEP = 0.6;
const GHOST_STEPS = 6;
/** a ghost wanders this far from its home spot (see Decor) */
const GHOST_WANDER = 0.75;

/**
 * Keeps the graveyard out from under the HUD and the plates. A corner lantern (with its candles) steps aside to the
 * nearest clear spot, or shrinks a little, or leaves if there is none (under the log on a computer screen);
 * a ghost drifts sideways to the nearest clear spot along the back, or leaves; any other piece still under the HUD
 * (a headstone under the log, a candle under a plate) is left out. `halfWidth` as in fitToScreen.
 */
export function fitToHud(L: HalloweenLayout, halfWidth: (z: number) => number, S: Sizes, clear: Clear, minX = 8.6): HalloweenLayout {
  const edge = (p: Spot) => p.e !== undefined;
  const at = (p: Spot, dz: number, de: number) => {
    const z = p.z + dz;
    return { ...p, z, x: Math.sign(p.x) * Math.max(minX, halfWidth(z) - (p.e ?? 0) - de) };
  };
  const pumpkinClear = (p: Spot) => clear(p.x, S.pumpkin.y * p.s, p.z, S.pumpkin.r * p.s);
  // each side on its own: the log takes the top left, the buttons only a little of the top right
  const shift = (side: number) => {
    const corner = L.pumpkins.filter(p => edge(p) && Math.sign(p.x) === side);
    return STEPS.find(({ dz, de, k }) => corner.every(p => pumpkinClear({ ...at(p, dz, de), s: p.s * k }))) ?? null;
  };
  const left = shift(-1);
  const right = shift(1);
  // an edge-anchored piece follows the corner lantern on its side (and leaves with it); the lanterns may shrink
  const follow = (p: Spot, lantern: boolean) => {
    if (!edge(p)) return [p];
    const st = p.x < 0 ? left : right;
    return st ? [{ ...at(p, st.dz, st.de), s: lantern ? p.s * st.k : p.s }] : [];
  };
  const pumpkins = L.pumpkins.flatMap(p => follow(p, true)).filter(pumpkinClear);
  const candles = L.candles.flatMap(c => follow(c, false)).filter(c => clear(c.x, 0.2 + c.s * 0.25, c.z, 0.3 + c.s * 0.2));
  const tombs = L.tombs.filter(t => clear(t.x, S.tomb.y * t.s, t.z, S.tomb.r * t.s));
  const crosses = L.crosses.filter(t => clear(t.x, S.cross.y * t.s, t.z, S.cross.r * t.s));
  const ghosts = L.ghosts.flatMap(g => {
    const r = S.ghost.r * 1.15 + GHOST_WANDER;
    for (let i = 0; i <= GHOST_STEPS * 2; i++) {
      // 0, +1, -1, +2, -2 ... steps, outward first
      const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1) * Math.sign(g.x || 1);
      const x = g.x + k * GHOST_STEP;
      if (clear(x, g.y + S.ghost.y, g.z, r)) return [{ ...g, x }];
    }
    return [];
  });
  return { ...L, pumpkins, candles, tombs, crosses, ghosts };
}

/** The phone version keeps the silhouette (corner lanterns, a few graves) with a fraction of the objects. */
export function layout(portrait: boolean, lite: boolean): HalloweenLayout {
  const L = portrait ? PORTRAIT : LANDSCAPE;
  if (!lite) return L;
  return {
    ...L,
    // a phone's top corners: tucked between the colour chip and the side plates, a little further back
    pumpkins: portrait ? L.pumpkins.slice(0, 2) : [{ x: -1, z: -6.0, s: 0.72, e: 1.5 }, { x: 1, z: -6.0, s: 0.7, e: 1.5 }],
    tombs: L.tombs.filter((_, i) => i % 2 === 0),
    crosses: [L.crosses[0], L.crosses[L.crosses.length - 1]],
    candles: [],
    ghosts: L.ghosts.slice(0, 1),
    bats: 6,
    wisps: 10,
  };
}
