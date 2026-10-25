import type { GameView } from '../game/view';
import { DEAL_STEP_MS, dealTiming } from '../net/protocol';
import { dropZone } from './drag';

export type Vec3 = [number, number, number];
export type Zone = 'deck' | 'discard' | 'hand' | 'opp';

export interface Target {
  pos: Vec3;
  /** Euler angles, order YXZ: yaw around the table, then tilt, then in-plane spin */
  rot: Vec3;
  zone: Zone;
  interactive: boolean;
  dim: boolean;
  /** seconds to wait before the first flight (staggered deal) */
  delay: number;
  /** buried deep in the deck or the pile: not drawn at all */
  hidden?: boolean;
  /** smaller cards for big hands, so they still fit on screen */
  scale?: number;
}

export interface View {
  portrait: boolean;
}

const PI = Math.PI;
/** height of the endless deck stack, and how many real cards lie on top of it */
export const DECK_TOP = 0.42;
export const DECK_SHOWN = 3;

/** Arena geometry: deck up-left of the pile, opponents along the far arc, you at the near edge. */
export function arena(v: View) {
  return v.portrait
    ? { deck: [0.35, 0, -3.35] as Vec3, discard: [0.75, 0, -0.45] as Vec3, rx: 2.85, rz: 4.5, hand: { y: 2.75, z: 6.75, maxW: 3.5, sp: 0.6, tilt: -0.85 } }
    : { deck: [-1.9, 0, -2.6] as Vec3, discard: [0.25, 0, -0.15] as Vec3, rx: 6.1, rz: 3.5, hand: { y: 1.15, z: 4.35, maxW: 8.6, sp: 0.86, tilt: -0.55 } };
}

/**
 * Shared with the render loop: where new cards appear (the deck) and where each player sits,
 * so effects like the bombing run can aim without knowing the game.
 */
export const spawn = { pos: [-2.45, 0.6, -1.25] as Vec3, seats: [] as Vec3[] };

/**
 * Where each card actually is on screen right now, written by the card itself every frame.
 * Online, a card can come back under a new id (fromId): it then starts from where the old one really was.
 * After a rebuilt canvas the cards reappear where they were. A card that was never on screen has no entry,
 * so it always starts from the deck.
 */
export const lastPlace = new Map<number, { pos: Vec3; quat: [number, number, number, number]; zone: Zone }>();

/**
 * Angle of player i around the table (+z is the near edge, angle π/2).
 * Opponents are spread over the far half, left to right in turn order.
 */
export function seatAngle(g: GameView, i: number) {
  const n = g.s.players.length;
  const rel = (i - g.seat() + n) % n;
  if (rel === 0) return PI / 2;
  const k = n - 1;
  if (k === 1) return 1.5 * PI;
  if (k === 2) return PI + (PI * (rel - 0.5)) / 2;
  return PI - 0.12 + ((PI + 0.24) * (rel - 1)) / (k - 1);
}

/** Radius of the ring of direction arrows around the pile (x; z is squashed by RING_Z). */
export const RING_R = 3.3;
export const RING_Z = 0.69;

/**
 * Where the draw pile rests: outside the ring of direction arrows (never inside it), as far as possible
 * from every opponent's fan and name plate, clear of your own hand, and on screen.
 * It depends on how many people sit where, so it is searched over a grid of candidate spots.
 */
export function deckSpot(g: GameView, v: View): Vec3 {
  const A = arena(v);
  const D = A.discard;
  const n = g.s.players.length;
  const seat = g.seat();
  // each opponent's fan and plate: the fan stands 0.8 above the table, so on screen it sits further back
  const A0 = arena(v);
  const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== seat).map(i => {
    const a = seatAngle(g, i);
    const side = Math.abs(Math.cos(a));
    return [Math.cos(a) * A0.rx * (1 - side * 0.12), 0, Math.sin(a) * A0.rz - 0.8] as Vec3;
  });
  // what the camera shows of the table, and where your hand starts (in table coordinates)
  const xMax = v.portrait ? 2.2 : 5.4;
  const zMin = v.portrait ? -2.6 : -2.2;
  const handZ = v.portrait ? 5.2 : 3.0;
  // the deck (about 1 × 1.5) must keep its whole body outside the ring
  const ringOut = (x: number, z: number) => {
    const rx = RING_R + 0.95;
    // the stack is tall and the camera looks down at an angle: on the near side it needs more room
    const rz = RING_R * RING_Z + (z > D[2] ? 1.4 : 1.05);
    return ((x - D[0]) / rx) ** 2 + ((z - D[2]) / rz) ** 2 >= 1;
  };
  let best: Vec3 = [D[0] - (RING_R + 1.4), 0, D[2] + 0.8];
  let bestScore = -Infinity;
  for (let x = -xMax; x <= xMax + 1e-6; x += 0.2) {
    for (let z = zMin; z <= handZ; z += 0.2) {
      if (!ringOut(x, z)) continue;
      // distance to the nearest opponent (fan and plate sit around the seat point)
      const toSeats = Math.min(99, ...others.map(o => Math.hypot(o[0] - x, (o[2] - z) * 1.3)));
      // distance to the hand area and to the screen edges
      const toHand = handZ - z;
      const toEdge = Math.min(xMax - Math.abs(x), z - zMin + 0.6);
      // the deck should stay close to the ring (easy to reach), so being far away costs a little
      const ringDist = Math.hypot((x - D[0]) / (RING_R + 0.95), (z - D[2]) / (RING_R * RING_Z + 1.05)) - 1;
      const score = Math.min(toSeats, toHand * 1.4 + 0.6, toEdge * 2 + 0.6) - ringDist * 0.8 + (x < 0 ? 0.05 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [x, 0, z];
      }
    }
  }
  return best;
}

/** Where the deck is shuffled and dealt from: exactly the middle of the table (the centre of the ring). */
export function deckCenter(_g: GameView, v: View): Vec3 {
  const A = arena(v);
  return [A.discard[0], 0, A.discard[2]];
}

export function seatPos(g: GameView, i: number, v: View): Vec3 {
  const a = seatAngle(g, i);
  const { rx, rz } = arena(v);
  return [Math.cos(a) * rx, 0, Math.sin(a) * rz];
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

export function computeTargets(g: GameView, v: View): Map<number, Target> {
  const s = g.s;
  const out = new Map<number, Target>();
  const n = s.players.length;
  const A = arena(v);
  const deck = deckSpot(g, v);
  // right on top of the real top cards, so a card waiting for its deal does not hover over the deck
  spawn.pos = [deck[0], DECK_TOP + DECK_SHOWN * 0.016 + 0.006, deck[2]];
  Object.assign(dropZone, { x: A.discard[0], z: A.discard[2], radius: v.portrait ? 2.2 : 2.6, handZ: A.hand.z });
  spawn.seats = s.players.map((_, i) => {
    if (i === g.seat()) return [0, 0.3, A.hand.z - 0.4] as Vec3;
    const [x, , z] = seatPos(g, i, v);
    return [x, 0.6, z] as Vec3;
  });
  // one card at a time around the table, then the first card of the pile
  const step = DEAL_STEP_MS / 1000;
  // the pile's first card comes last, once the deck has left the middle (see dealTiming)
  const pileAt = dealTiming(n, s.table?.handSize ?? 7).pileMs / 1000;
  const dealDelay = (idx?: number) => (idx === undefined ? pileAt : idx * step);

  // the deck: only the top few real cards sit on the endless stack (DeckStack draws the rest)
  const dn = s.deck.length;
  s.deck.forEach((c, i) => {
    const fromTop = dn - 1 - i;
    out.set(c.id, {
      pos: [deck[0] + (hash(c.id) - 0.5) * 0.04, DECK_TOP + (DECK_SHOWN - fromTop) * 0.016, deck[2] + (hash(c.id + 9) - 0.5) * 0.04],
      rot: [PI / 2, -0.35 + 0.08 * (hash(c.id) - 0.5), 0],
      zone: 'deck', interactive: false, dim: false, delay: 0, hidden: fromTop >= DECK_SHOWN,
    });
  });

  // the pile: a messy fan of the last cards, newest on top
  const dl = s.discard.length;
  s.discard.forEach((c, i) => {
    const layer = Math.max(0, i - (dl - 40));
    out.set(c.id, {
      pos: [A.discard[0] + (hash(c.id) - 0.5) * 0.55, 0.02 + layer * 0.016, A.discard[2] + (hash(c.id + 3) - 0.5) * 0.4],
      rot: [-PI / 2, (hash(c.id + 5) - 0.5) * 1.3, 0],
      zone: 'discard', interactive: false, dim: false, delay: dealDelay(c.dealIdx), hidden: i < dl - 24,
    });
  });

  const seat = g.seat();
  const viewer = g.viewer();
  const over = s.phase === 'over';
  const myTurn = viewer !== null && viewer === s.cur;

  s.players.forEach((p, pi) => {
    const m = p.hand.length;
    if (pi === seat && over) {
      // finale: lay the leftover hand flat in front, out of the podium's way
      const sp = Math.min(0.7, A.hand.maxW / Math.max(m - 1, 1));
      p.hand.forEach((c, k) => {
        const off = k - (m - 1) / 2;
        out.set(c.id, {
          pos: [off * sp, 0.03 + k * 0.004, A.hand.z - 0.3],
          rot: [-PI / 2, 0, -off * 0.04],
          zone: 'hand', interactive: false, dim: false, delay: 0,
        });
      });
      return;
    }
    if (pi === seat) {
      const h = A.hand;
      // blind event: you still play, but you cannot see what
      const faceUp = (viewer === seat && s.blindTurns === 0) || over;
      // a big hand goes into two rows (the back row a little higher), so every card stays readable
      const rows = m > (v.portrait ? 11 : 20) ? 2 : 1;
      const backN = rows === 2 ? Math.ceil(m / 2) : m;
      const tilt = h.tilt;
      // the card face normal and its "up" direction: rows and layers move along them
      const ny = -Math.sin(tilt);
      const nz = Math.cos(tilt);
      const uy = Math.cos(tilt);
      const uz = Math.sin(tilt);
      p.hand.forEach((c, k) => {
        const row = rows === 2 && k >= backN ? 1 : 0;
        const inRow = row ? k - backN : k;
        const rowN = row ? m - backN : backN;
        // two rows: smaller cards and a narrower spread, so both rows fit on screen
        const cs = rows === 2 ? (v.portrait ? 0.86 : 0.8) : 1;
        const sp = Math.min(h.sp * cs, (h.maxW - (rows === 2 ? (v.portrait ? 0.9 : 1.2) : 0)) / Math.max(rowN - 1, 1));
        const off = inRow - (rowN - 1) / 2;
        const x = off * sp;
        let interactive = false;
        let dim = false;
        if (myTurn && !over) {
          if (s.phase === 'play') {
            interactive = g.playable(c);
            dim = !interactive;
          } else if (s.phase === 'choose' && s.choice?.kind === 'card') interactive = true;
        }
        const lift = interactive ? 0.3 : 0;
        // each card strictly in front of its left neighbour; the front row in front of the back row.
        // The step shrinks for big hands so the whole fan never comes too close to the camera.
        const layer = inRow * Math.min(0.02, 0.3 / rowN) + row * 0.32 + lift * 0.5;
        // two rows sit a bit higher, so the front row clears the bottom panel
        const up = rows === 2 ? (row ? -0.38 : 0.42) * cs + (v.portrait ? 0.1 : 0.32) : 0;
        out.set(c.id, {
          pos: [x, h.y + lift + ny * layer + uy * up - Math.abs(off) * sp * 0.02, h.z + nz * layer + uz * up],
          rot: [faceUp ? tilt : tilt + PI, 0, -off * Math.min(0.035, 0.4 / rowN)],
          zone: 'hand', interactive, dim, delay: dealDelay(c.dealIdx), scale: cs,
        });
      });
      return;
    }
    // opponents hold their cards standing, backs to the middle of the table
    const a = seatAngle(g, pi);
    // yaw that turns a card's face toward its owner, swung most of the way round so the backs face the camera
    const radial = PI / 2 - a;
    const toCam = PI - radial;
    const face = radial + (Math.atan2(Math.sin(toCam), Math.cos(toCam))) * 0.6;
    const lx: Vec3 = [Math.cos(face), 0, -Math.sin(face)];
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    // side seats sit nearer the middle so their fans stay on screen
    const side = Math.abs(nx);
    const base: Vec3 = [nx * A.rx * (1 - side * 0.12), 0, nz * A.rz];
    const sp = Math.min(v.portrait ? 0.22 : 0.28, (v.portrait ? 1.5 : 2.2) / Math.max(m - 1, 1));
    // the back of the cards points this way (toward the camera, roughly)
    const bx = -Math.sin(face);
    const bz = -Math.cos(face);
    if (over) {
      // finale: leftover cards spread face up on the table in front of their owner
      const fsp = Math.min(0.5, 2.4 / Math.max(m - 1, 1));
      p.hand.forEach((c, k) => {
        const off = k - (m - 1) / 2;
        out.set(c.id, {
          pos: [base[0] * 0.92 + lx[0] * off * fsp, 0.03 + k * 0.004, base[2] * 0.92 + lx[2] * off * fsp],
          rot: [-PI / 2, 0, -off * 0.05],
          zone: 'opp', interactive: false, dim: false, delay: 0,
        });
      });
      return;
    }
    // a held fan of fixed width: more cards squeeze closer together instead of growing a huge arc
    // side seats fan toward the camera, so they get a narrower fan and smaller cards than the far seat
    const half = Math.min(((m - 1) / 2) * sp, v.portrait ? 0.8 : 1.15) * (1 - side * 0.45);
    const oscale = (m > 10 ? 0.85 : 1) * (1 - side * (v.portrait ? 0.22 : 0.12));
    const spread = Math.min(0.42, 0.035 * ((m - 1) / 2));
    const step = Math.min(0.022, 0.3 / Math.max(m, 1)) * (1 - side * 0.5);
    p.hand.forEach((c, k) => {
      const u = m > 1 ? (k - (m - 1) / 2) / ((m - 1) / 2) : 0; // -1 … 1 across the fan
      const bend = u * u * 0.14;
      const stack = k * step; // each next card a hair closer to the viewer, so the fan overlaps cleanly
      out.set(c.id, {
        pos: [base[0] + lx[0] * u * half + nx * bend + bx * stack, 0.8, base[2] + lx[2] * u * half + nz * bend + bz * stack],
        // the back texture is drawn for cards lying on the table; standing ones turn it upright
        rot: [0.2, face, u * spread + PI],
        zone: 'opp', interactive: false, dim: false, delay: dealDelay(c.dealIdx), scale: oscale,
      });
    });
  });
  return out;
}
