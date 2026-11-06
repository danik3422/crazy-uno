import * as THREE from 'three';

/**
 * The mascot's repertoire: each route is a smooth curve through the arena plus timing and stunts.
 * Coordinates are table space: x left/right, y up, z toward the camera (the near edge is +z).
 * Everything stays clear of the camera (z < ~2.5) and inside the frame.
 */

export type StuntKind = 'roll' | 'loop';

export interface Route {
  name: string;
  curve: THREE.CatmullRomCurve3;
  dur: number;
  /** time warp p -> u (both 0..1, monotonic): where the plane slows down or speeds up */
  warp: (p: number) => number;
  /** stunts at fractions of the route */
  stunts: { at: number; kind: StuntKind; dur: number }[];
  /** grows in from nothing at the start (taking off out of the deck) */
  growIn?: number;
  /** skids touch the table between these fractions: no smoke, no wobble */
  ground?: [number, number];
}

interface Ctx {
  /** +1 or -1: which side it comes from */
  s: number;
  /** horizontal squeeze on narrow (portrait) screens */
  w: number;
  portrait: boolean;
  deck: [number, number, number];
  pile: [number, number, number];
  rnd: () => number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const linear = (p: number) => p;
/** slower in the middle (amount 0..0.9) */
const slowMiddle = (amount: number) => (p: number) => p + (amount / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);
/** gentle ease at both ends */
const soft = (p: number) => p * 0.75 + 0.25 * (p * p * (3 - 2 * p));

const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

type Maker = (c: Ctx) => Omit<Route, 'name'>;

const MAKERS: Record<string, Maker> = {
  // a low pass across the table
  flyby: ({ s, w, portrait }) => ({
    curve: curve([V(-14 * s * w, 2.8, -0.5), V(-5 * s * w, 3.0, portrait ? -2 : -1.8), V(0, 2.5, portrait ? 0.8 : 0.2), V(5 * s * w, 2.4, portrait ? 1.6 : 0.9), V(14 * s * w, 2.9, -0.8)]),
    dur: 6.2, warp: soft, stunts: [],
  }),
  // drops out of the sky behind the table, pulls up just above the cards, climbs away
  dive: ({ s, w, pile }) => ({
    curve: curve([V(-9 * s * w, 10, -10), V(-4 * s * w, 6, -5), V(pile[0] - 1.2 * s * w, 1.5, pile[2] - 0.6), V(pile[0] + 2.5 * s * w, 1.9, pile[2] + 0.6), V(8 * s * w, 4, -1), V(15 * s * w, 7, -5)]),
    dur: 5.4, warp: (p: number) => Math.pow(p, 0.85), stunts: [],
  }),
  // a figure eight over the middle of the table
  eight: ({ s, w, pile }) => {
    const pts = [V(15 * s * w, 3.4, -3)];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      pts.push(V(pile[0] + Math.sin(t) * 3.6 * s * w, 3 + Math.sin(t * 2) * 0.3, pile[2] - 0.6 + Math.sin(t) * Math.cos(t) * 2.2));
    }
    pts.push(V(-15 * s * w, 3.6, -3));
    return { curve: curve(pts), dur: 9.5, warp: soft, stunts: [] };
  },
  // spirals up around the pile, then shoots off into the sky
  spiral: ({ s, w, pile }) => {
    const pts = [V(13 * s * w, 5, -7)];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 3 * s;
      pts.push(V(pile[0] + Math.cos(a) * 3.3 * w, 1.7 + (i / 14) * 3.2, pile[2] - 0.4 + Math.sin(a) * 1.9));
    }
    pts.push(V(-6 * s * w, 9, -8), V(-10 * s * w, 12, -12));
    return { curve: curve(pts), dur: 8.5, warp: soft, stunts: [] };
  },
  // a straight pass with a barrel roll over the pile
  roll: ({ s, w }) => ({
    curve: curve([V(-15 * s * w, 3.2, -1.6), V(-5 * s * w, 3.0, -0.9), V(5 * s * w, 3.0, -0.9), V(15 * s * w, 3.3, -1.6)]),
    dur: 5.2, warp: linear, stunts: [{ at: 0.42, kind: 'roll', dur: 1.1 }],
  }),
  // a pass with a full loop the loop in the middle
  loop: ({ s, w }) => ({
    curve: curve([V(-15 * s * w, 2.8, -1.8), V(-5 * s * w, 2.6, -1.2), V(5 * s * w, 2.6, -1.2), V(15 * s * w, 3.0, -1.8)]),
    dur: 6, warp: linear, stunts: [{ at: 0.38, kind: 'loop', dur: 1.6 }],
  }),
  // one lap around everybody at the table
  lap: ({ s, w, portrait }) => {
    const rx = portrait ? 3.4 : 6.6;
    const rz = portrait ? 4.6 : 3.4;
    const pts = [V(14 * s * w, 5, -6)];
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI * 2 * s;
      pts.push(V(Math.cos(a) * rx, 3.1 + Math.sin(i * 0.8) * 0.25, Math.min(Math.sin(a) * rz - 0.7, portrait ? 3 : 1.8)));
    }
    pts.push(V(-14 * s * w, 5, -6));
    return { curve: curve(pts), dur: 10, warp: soft, stunts: [] };
  },
  // weaves left and right between the opponents' fans
  slalom: ({ s, w }) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) pts.push(V((-15 + i * 3.75) * s * w, 2.6 + (i % 2) * 0.4, i % 2 ? -2.6 : 0.6));
    return { curve: curve(pts), dur: 7, warp: linear, stunts: [] };
  },
  // pops out of the draw pile, climbs straight up, and flies off
  fromDeck: ({ s, w, deck }) => ({
    curve: curve([V(deck[0], deck[1] - 0.3, deck[2]), V(deck[0], deck[1] + 1.4, deck[2] - 0.05), V(deck[0] + 0.6 * s * w, 3.4, deck[2] - 0.8), V(deck[0] + 3.5 * s * w, 4.2, deck[2] - 2), V(14 * s * w, 5.5, -4)]),
    dur: 5, warp: (p: number) => Math.pow(p, 1.25), stunts: [{ at: 0.55, kind: 'roll', dur: 1 }], growIn: 0.12,
  }),
  // glides in, lands on the table, taxis past the pile, takes off again
  landing: ({ s, w, pile }) => ({
    curve: curve([
      V(-15 * s * w, 4.5, -3.5), V(-6 * s * w, 2.2, -1.6), V(pile[0] - 2.8 * s * w, 0.62, pile[2] - 1.1),
      V(pile[0] - 0.4 * s * w, 0.6, pile[2] - 1.2), V(pile[0] + 2.0 * s * w, 0.62, pile[2] - 1.1),
      V(pile[0] + 5.5 * s * w, 2.4, pile[2] - 1.8), V(15 * s * w, 4.8, -3.5),
    ]),
    dur: 8, warp: slowMiddle(0.7), stunts: [], ground: [0.36, 0.6],
  }),
};

const ROUTE_NAMES = Object.keys(MAKERS);
let lastRoute = '';

/** A fresh random route, never the same one twice in a row. */
export function pickRoute(seed: number, ctx: Omit<Ctx, 's' | 'rnd'>): Route {
  let r = seed;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  rnd();
  let name = ROUTE_NAMES[Math.floor(rnd() * ROUTE_NAMES.length)];
  if (name === lastRoute) name = ROUTE_NAMES[(ROUTE_NAMES.indexOf(name) + 1 + Math.floor(rnd() * (ROUTE_NAMES.length - 1))) % ROUTE_NAMES.length];
  lastRoute = name;
  const s = rnd() < 0.5 ? 1 : -1;
  return { name, ...MAKERS[name]({ ...ctx, s, rnd }) };
}

/** The bombing run: comes in from the far side of the victim, passes right over them, climbs away. */
export function bomberRoute(target: [number, number, number], portrait: boolean): THREE.CatmullRomCurve3 {
  const T = target;
  const s = T[0] > 0.5 ? -1 : 1;
  const y = T[1] + 1.8;
  const z = portrait ? Math.min(T[2] + 2.4, 2.0) : Math.min(T[2] + 1.0, 1.4);
  const w = portrait ? 0.5 : 1;
  return curve([
    V(T[0] - 15 * s * w, y + 2.5, z - 3 * w), V(T[0] - 6 * s * w, y + 0.2, z + 0.4 * w), V(T[0] - 0.8 * s * w, y, z),
    V(T[0] + 1.5 * s * w, y + 0.1, z - 0.2 * w), V(T[0] + 7 * s * w, y + 1.4, z - 0.8 * w), V(T[0] + 15 * s * w, y + 3.5, z + 1 * w),
  ]);
}
