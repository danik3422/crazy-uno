import * as THREE from 'three';

/**
 * The mascot's repertoire: each route is a smooth curve through the arena plus timing and stunts.
 * Coordinates are table space: x left/right, y up, z toward the camera (the near edge is +z).
 * Everything stays clear of the camera (z < ~2.5). The routes are drawn for a wide screen; `frameRoute` then fits
 * them to the real camera: the part over the table is pulled inside the frame, and the run starts the moment the
 * mascot comes into view and ends the moment it has left, so a phone never waits for it off-screen.
 */

export type StuntKind = 'roll' | 'loop';

export interface Route {
  name: string;
  curve: THREE.CatmullRomCurve3;
  /** curve length (world units), for the flying speed */
  length: number;
  /**
   * The route's own clock: p = p0 + seconds / full, and the run ends at p1. Fractions below (stunts, growIn,
   * ground) are on this clock; p0 > 0 or p1 < 1 when the start or the end of the curve is out of sight.
   */
  full: number;
  p0: number;
  p1: number;
  /** p -> u (curve fraction by length, monotonic): where the plane slows down or speeds up */
  warp: (p: number) => number;
  /** stunts at fractions of the route, in order */
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

/** What a route maker draws: control points and timing, before it is fitted to the screen. */
interface Draft {
  pts: THREE.Vector3[];
  dur: number;
  warp: (p: number) => number;
  stunts: Route['stunts'];
  growIn?: number;
  ground?: [number, number];
  /** these control points (first, last; default: all but the two ends) are the show: they must be on screen */
  keep?: [number, number];
  /** a stunt climbs this high above the path (world units): room for it under the top of the screen */
  headroom?: number;
}

/** The camera the route is fitted to, and how big the mascot is (world units from its centre to its tips). */
export interface Framing {
  camera: THREE.Camera;
  radius: number;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const linear = (p: number) => p;
/** slower in the middle (amount 0..0.9) */
const slowMiddle = (amount: number) => (p: number) => p + (amount / (2 * Math.PI)) * Math.sin(2 * Math.PI * p);
/** gentle ease at both ends */
const soft = (p: number) => p * 0.75 + 0.25 * (p * p * (3 - 2 * p));
/** steady, but down to (1 - k) of the speed between a and b (a loop needs the room: a real plane slows into it) */
const dip = (a: number, b: number, k: number) => {
  const area = (x: number) => {
    const c = Math.min(Math.max(x, a), b) - a;
    return c / 2 - ((b - a) / (4 * Math.PI)) * Math.sin((2 * Math.PI * c) / (b - a));
  };
  const total = 1 - k * area(b);
  return (p: number) => (p - k * area(p)) / total;
};

const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts, false, 'centripetal');

type Maker = (c: Ctx) => Draft;

const LOOP_AT = 0.38;
const LOOP_DUR = 1.6;
const LOOP_ROUTE = 6;

const MAKERS: Record<string, Maker> = {
  // a low pass across the table
  flyby: ({ s, w, portrait }) => ({
    pts: [V(-14 * s * w, 2.8, -0.5), V(-5 * s * w, 3.0, portrait ? -2 : -1.8), V(0, 2.5, portrait ? 0.8 : 0.2), V(5 * s * w, 2.4, portrait ? 1.6 : 0.9), V(14 * s * w, 2.9, -0.8)],
    dur: 6.2, warp: soft, stunts: [],
  }),
  // drops out of the sky behind the table, pulls up just above the cards, climbs away
  dive: ({ s, w, pile }) => ({
    pts: [V(-9 * s * w, 10, -10), V(-4 * s * w, 6, -5), V(pile[0] - 1.2 * s * w, 1.5, pile[2] - 0.6), V(pile[0] + 2.5 * s * w, 1.9, pile[2] + 0.6), V(8 * s * w, 4, -1), V(15 * s * w, 7, -5)],
    dur: 5.4, warp: (p: number) => Math.pow(p, 0.85), stunts: [], keep: [2, 3],
  }),
  // a figure eight over the middle of the table
  eight: ({ s, w, pile }) => {
    const pts = [V(15 * s * w, 3.4, -3)];
    for (let i = 0; i <= 16; i++) {
      const t = (i / 16) * Math.PI * 2;
      pts.push(V(pile[0] + Math.sin(t) * 3.6 * s * w, 3 + Math.sin(t * 2) * 0.3, pile[2] - 0.6 + Math.sin(t) * Math.cos(t) * 2.2));
    }
    pts.push(V(-15 * s * w, 3.6, -3));
    return { pts, dur: 9.5, warp: soft, stunts: [] };
  },
  // spirals up around the pile, then shoots off into the sky
  spiral: ({ s, w, pile }) => {
    const pts = [V(13 * s * w, 5, -7)];
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 3 * s;
      pts.push(V(pile[0] + Math.cos(a) * 3.3 * w, 1.7 + (i / 14) * 3.2, pile[2] - 0.4 + Math.sin(a) * 1.9));
    }
    pts.push(V(-6 * s * w, 9, -8), V(-10 * s * w, 12, -12));
    return { pts, dur: 8.5, warp: soft, stunts: [], keep: [1, 15] };
  },
  // a straight pass with a barrel roll over the pile
  roll: ({ s, w }) => ({
    pts: [V(-15 * s * w, 3.2, -1.6), V(-5 * s * w, 3.0, -0.9), V(5 * s * w, 3.0, -0.9), V(15 * s * w, 3.3, -1.6)],
    dur: 5.2, warp: linear, stunts: [{ at: 0.42, kind: 'roll', dur: 1.1 }],
  }),
  // a pass with a full loop the loop in the middle
  loop: ({ s, w }) => ({
    pts: [V(-15 * s * w, 2.8, -1.8), V(-5 * s * w, 2.6, -1.2), V(5 * s * w, 2.6, -1.2), V(15 * s * w, 3.0, -1.8)],
    dur: LOOP_ROUTE, warp: dip(LOOP_AT, LOOP_AT + LOOP_DUR / LOOP_ROUTE, 0.7), stunts: [{ at: LOOP_AT, kind: 'loop', dur: LOOP_DUR }],
    headroom: 1.4,
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
    return { pts, dur: 10, warp: soft, stunts: [] };
  },
  // weaves left and right between the opponents' fans
  slalom: ({ s, w }) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) pts.push(V((-15 + i * 3.75) * s * w, 2.6 + (i % 2) * 0.4, i % 2 ? -2.6 : 0.6));
    return { pts, dur: 7, warp: linear, stunts: [], keep: [2, 6] };
  },
  // pops out of the draw pile, climbs straight up, and flies off
  fromDeck: ({ s, w, deck }) => ({
    pts: [V(deck[0], deck[1] - 0.3, deck[2]), V(deck[0], deck[1] + 1.4, deck[2] - 0.05), V(deck[0] + 0.6 * s * w, 3.4, deck[2] - 0.8), V(deck[0] + 3.5 * s * w, 4.2, deck[2] - 2), V(14 * s * w, 5.5, -4)],
    dur: 5, warp: (p: number) => Math.pow(p, 1.25), stunts: [{ at: 0.55, kind: 'roll', dur: 1 }], growIn: 0.12, keep: [2, 3],
  }),
  // glides in, lands on the table, taxis past the pile, takes off again
  landing: ({ s, w, pile }) => ({
    pts: [
      V(-15 * s * w, 4.5, -3.5), V(-6 * s * w, 2.2, -1.6), V(pile[0] - 2.8 * s * w, 0.62, pile[2] - 1.1),
      V(pile[0] - 0.4 * s * w, 0.6, pile[2] - 1.2), V(pile[0] + 2.0 * s * w, 0.62, pile[2] - 1.1),
      V(pile[0] + 5.5 * s * w, 2.4, pile[2] - 1.8), V(15 * s * w, 4.8, -3.5),
    ],
    dur: 8, warp: slowMiddle(0.7), stunts: [], ground: [0.36, 0.6],
  }),
};

/* ---------- fitting a route to the screen ---------- */

/** the show part of a route stays inside these screen bounds (normalized device coords, -1..1) */
const EDGE_X = 0.84;
const TOP = 0.7;
const BOTTOM = -0.45;
/** pulled down to keep it on screen, it still flies at least this high over the table */
const LOW_Y = 1.3;

const ndcOf = (p: THREE.Vector3, cam: THREE.Camera, out: THREE.Vector3) => out.copy(p).project(cam);

/** Bisects t in [lo, hi] for the last t where ok(t) holds (ok(lo) is assumed true, ok monotonic). */
function lastOk(lo: number, hi: number, ok: (t: number) => boolean) {
  if (ok(hi)) return hi;
  for (let i = 0; i < 18; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Pulls the show points inside the frame: too high or too low on screen moves them up or down, too wide squeezes x. */
function fitPoints(pts: THREE.Vector3[], [a, b]: [number, number], cam: THREE.Camera, headroom = 0, [ya, yb] = [a, b]) {
  const n = new THREE.Vector3();
  const q = new THREE.Vector3();
  const yAt = (p: THREE.Vector3, y: number) => ndcOf(q.set(p.x, y, p.z), cam, n).y;
  for (let i = ya; i <= yb; i++) {
    const p = pts[i];
    if (yAt(p, p.y + headroom) > TOP) p.y = lastOk(Math.min(LOW_Y, p.y), p.y, y => yAt(p, y + headroom) <= TOP);
    else if (ndcOf(p, cam, n).y < BOTTOM && n.z < 1) p.y = lastOk(p.y + 4, p.y, y => yAt(p, y) >= BOTTOM);
  }
  // one squeeze for all of them, so the shape keeps its proportions
  let k = 1;
  for (let i = a; i <= b; i++) {
    const p = pts[i];
    if (Math.abs(ndcOf(p, cam, n).x) <= EDGE_X) continue;
    k = Math.min(k, lastOk(0, 1, s => Math.abs(ndcOf(q.set(p.x * s, p.y, p.z), cam, n).x) <= EDGE_X));
  }
  if (k < 1) for (let i = a; i <= b; i++) pts[i].x *= k;
}

/** Fractions of the curve where the mascot first shows up on screen and where it has left for good. */
function visibleSpan(c: THREE.CatmullRomCurve3, f: Framing): [number, number] {
  const cam = f.camera;
  const aspect = (cam as THREE.PerspectiveCamera).aspect ?? 1;
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  const N = 240;
  let first = -1;
  let last = -1;
  for (let i = 0; i <= N; i++) {
    c.getPointAt(i / N, p);
    ndcOf(p, cam, n);
    if (n.z > 1) continue; // behind the camera
    const rx = Math.abs(ndcOf(e.copy(p).addScaledVector(right, f.radius), cam, e).x - n.x);
    if (Math.abs(n.x) < 1 + rx && Math.abs(n.y) < 1 + rx * aspect) {
      if (first < 0) first = i;
      last = i;
    }
  }
  if (first < 0) return [0, 1];
  return [Math.max(0, first - 1) / N, Math.min(N, last + 1) / N];
}

/** p where warp(p) = u (warp is monotonic). */
const unwarp = (warp: (p: number) => number, u: number, hi = 1) => lastOk(0, hi, p => warp(p) <= u);

function build(name: string, d: Draft, framing?: Framing): Route {
  if (framing) fitPoints(d.pts, d.keep ?? [1, d.pts.length - 2], framing.camera, d.headroom);
  const c = curve(d.pts);
  const route: Route = { name, curve: c, length: c.getLength(), full: d.dur, p0: 0, p1: 1, warp: d.warp, stunts: d.stunts, growIn: d.growIn, ground: d.ground };
  if (framing) {
    const [u0, u1] = visibleSpan(c, framing);
    route.p0 = u0 > 0 ? unwarp(d.warp, u0) : 0;
    route.p1 = u1 < 1 ? unwarp(d.warp, u1) : 1;
  }
  return route;
}

const ROUTE_NAMES = Object.keys(MAKERS);

/**
 * The route for `seed`, and only for it: online every screen gets the same seed from the game, so every screen
 * flies the same route (no per-device memory such as "not the same route twice"). `force` picks one by name: debug.
 */
export function pickRoute(seed: number, ctx: Omit<Ctx, 's' | 'rnd'> & { force?: string }, framing?: Framing): Route {
  let r = seed;
  const rnd = () => {
    r = (r * 9301 + 49297) % 233280;
    return r / 233280;
  };
  rnd();
  let name = ROUTE_NAMES[Math.floor(rnd() * ROUTE_NAMES.length)];
  if (ctx.force && ctx.force in MAKERS) name = ctx.force;
  const s = rnd() < 0.5 ? 1 : -1;
  return build(name, MAKERS[name]({ ...ctx, s, rnd }), framing);
}

/**
 * The bombing run: comes in across the table, passes right over the victim, climbs away.
 * The clock is fixed (the bomb leaves at `release` seconds of `time`), so instead of starting later the plane
 * starts where it comes into view and cruises in a little slower, lining up; after the drop it speeds up again.
 */
export function bomberRoute(target: [number, number, number], portrait: boolean, time: number, release: number, framing?: Framing): Route {
  const T = target;
  // from across the table toward a seat on either side, so the approach is on screen and the climb out is short
  const s = T[0] < -0.5 ? -1 : 1;
  const y = T[1] + 1.8;
  const z = portrait ? Math.min(T[2] + 2.4, 2.0) : Math.min(T[2] + 1.0, 1.4);
  const w = portrait ? 0.5 : 1;
  const d: Draft = {
    pts: [
      V(T[0] - 15 * s * w, y + 2.5, z - 3 * w), V(T[0] - 6 * s * w, y + 0.2, z + 0.4 * w), V(T[0] - 0.8 * s * w, y, z),
      V(T[0] + 1.5 * s * w, y + 0.1, z - 0.2 * w), V(T[0] + 7 * s * w, y + 1.4, z - 0.8 * w), V(T[0] + 15 * s * w, y + 3.5, z + 1 * w),
    ],
    dur: time, warp: linear, stunts: [], keep: [2, 3],
  };
  const route = build('bomber', d);
  if (!framing) return route;
  // the run in and out along the far edge stays under the top of the screen too (a far seat's victim)
  fitPoints(d.pts, [2, 3], framing.camera, 0, [1, 4]);
  const c = curve(d.pts);
  const [u0, u1] = visibleSpan(c, framing);
  const pr = release / time;
  // where the bomb leaves: the same spot on the curve as on a full-length run
  const ur = pr;
  const uIn = Math.min(u0, ur - 0.05);
  const v0 = (ur - uIn) / pr;
  // after the drop: from the cruise back to full speed over RAMP of the run
  const RAMP = 0.15;
  const warp = (p: number) => {
    if (p <= pr) return uIn + v0 * p;
    const x = Math.min(1, (p - pr) / RAMP);
    const ramp = x < 1 ? RAMP * (x * x * x - (x * x * x * x) / 2) : RAMP / 2 + (p - pr - RAMP);
    return ur + v0 * (p - pr) + (1 - v0) * ramp;
  };
  return { ...route, curve: c, length: c.getLength(), warp, p1: unwarp(warp, u1, 1.5) };
}
