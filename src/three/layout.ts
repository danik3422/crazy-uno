import type { GameView } from '../game/view';
import { DEAL_STEP_MS, dealTiming } from '../net/protocol';
import * as THREE from 'three';
import { dropZone } from './drag';
import { CARD_H, CARD_W } from './cardShape';

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
  /** cards that bob together on a table that floats them (one hand or one opponent's wall) */
  bobGroup?: number;
  /** place in its owner's hand: cards drawn together leave the deck in this order */
  seq?: number;
  /** the card you drew and can play: held up big in front of you until you play it or pass */
  held?: boolean;
  /** Jump-In: not your turn, but this card is exactly like the top one and may be thrown in */
  jump?: boolean;
}

export interface View {
  portrait: boolean;
  /** a phone lying on its side: wide and very short */
  compact?: boolean;
  /** width / height of the canvas (the layout fits the hand to what the camera sees) */
  aspect?: number;
  /** height of the canvas in CSS pixels */
  h?: number;
}

/**
 * How much bigger your hand's cards are than on a big screen. A phone lying on its side is short, so its cards
 * would come out tiny: the shorter the screen, the more they grow (about 1.25× on a tall phone, up to 1.4×).
 */
export function handScale(v: View) {
  if (!v.compact) return 1;
  const h = v.h ?? 390;
  // a narrower phone (16:9) has less room between the corner panels
  const byWidth = 1.22 + ((v.aspect ?? 2.1) - 1.75) * 0.3;
  return Math.max(1.18, Math.min(1.36, 1.32 + (390 - h) * 0.0018, byWidth));
}

/** The pile in the middle: bigger than a hand card on the table's far side would look, easier to read on a phone. */
export function pileScale(v: View) {
  return v.compact ? 1.5 : v.portrait ? 1.35 : 1.22;
}

/**
 * Where the camera sits during play. The vertical field of view widens on screens narrower than
 * `fitAspect`, so the table keeps its full width on screen (4:3 monitors, narrow windows).
 */
export const CAMERA = {
  landscape: { pos: [0, 7.6, 9.8] as Vec3, look: [0, 0, 0.55] as Vec3, fov: 42, fitAspect: 1.72 },
  portrait: { pos: [0, 15, 10.6] as Vec3, look: [0, 0, 1.4] as Vec3, fov: 50, fitAspect: 0.56 },
};
/** how far the mouse parallax moves the camera sideways */
export const PARALLAX_X = 0.35;

export function cameraFov(v: View) {
  const c = v.portrait ? CAMERA.portrait : CAMERA.landscape;
  const aspect = v.aspect ?? c.fitAspect;
  if (aspect >= c.fitAspect) return c.fov;
  const half = Math.atan((Math.tan((c.fov * Math.PI) / 360) * c.fitAspect) / aspect);
  return Math.min(75, (half * 360) / Math.PI);
}

/** Half the width the camera sees at a point straight ahead of it (table units), at rest. */
export function visibleHalfWidth(v: View, y: number, z: number) {
  const c = v.portrait ? CAMERA.portrait : CAMERA.landscape;
  const [px, py, pz] = c.pos;
  const [lx, ly, lz] = c.look;
  const dx = lx - px, dy = ly - py, dz = lz - pz;
  const len = Math.hypot(dx, dy, dz);
  const depth = ((0 - px) * dx + (y - py) * dy + (z - pz) * dz) / len;
  const aspect = v.aspect ?? c.fitAspect;
  return depth * Math.tan((cameraFov(v) * Math.PI) / 360) * aspect;
}

const PI = Math.PI;
/** Where the card you drew (and can play) waits in front of you: centred over your hand, facing you. */
export const HELD = {
  landscape: { pos: [0, 1.82, 3.72] as Vec3, tilt: -0.62, scale: 1.3 },
  portrait: { pos: [0, 4.6, 4.7] as Vec3, tilt: -1.08, scale: 1.2 },
};

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
  // a crowded table reaches a little further down the sides, so the end seats' plates clear their neighbours' fans
  const over = k >= 6 ? 0.24 : 0.12;
  return PI - over + ((PI + 2 * over) * (rel - 1)) / (k - 1);
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
  const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== seat).map(i => {
    const w = oppWall(g, i, v);
    return [w.pos[0], 0, w.pos[2] - 0.8] as Vec3;
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

/** Where player i sits: for an opponent, the foot of their fan of cards (see oppWall). */
export function seatPos(g: GameView, i: number, v: View): Vec3 {
  if (i !== g.seat()) return oppWall(g, i, v).pos;
  const a = seatAngle(g, i);
  const { rx, rz } = arena(v);
  return [Math.cos(a) * rx, 0, Math.sin(a) * rz];
}

/**
 * An opponent's hand, as in the console UNO: an upright fan of card backs turned to the camera.
 * Every seat gets exactly the same fan (lean, spread, overlap); only its place on the table differs.
 * Units are card sizes (times the wall's scale).
 */
export const OPP_FAN = {
  /** leaning back, so the camera (which looks down) sees the backs rather than an edge */
  lean: 0.22,
  /** the fan turns around a point this far below the middle card's centre */
  radius: 2.4,
  /** in-plane angle between neighbours, and the whole fan's spread at most (radians) */
  step: 0.07,
  spread: 0.56,
  /** each card stands this much in front of the one before (a card is 0.012 thick: never closer) */
  depth: 0.026,
};
/** the fan floats this much (card heights) over the table, so its outer cards' corners stay above it */
const FAN_LIFT = (OPP_FAN.radius * (1 - Math.cos(OPP_FAN.spread / 2)) + (CARD_W / 2) * Math.sin(OPP_FAN.spread / 2)) / CARD_H + 0.02;
/** half the width of a full fan (card widths, at scale 1) */
const FAN_HALF = OPP_FAN.radius * Math.sin(OPP_FAN.spread / 2) + (CARD_W / 2) * Math.cos(OPP_FAN.spread / 2) + (CARD_H / 2) * Math.sin(OPP_FAN.spread / 2);

const eulTmp = new THREE.Euler(0, 0, 0, 'YXZ');
const qTmp = new THREE.Quaternion();
const vTmp = new THREE.Vector3();

export interface OppWall {
  /** the foot of the fan, on the table */
  pos: Vec3;
  /** the point the fan turns around */
  pivot: Vec3;
  /** toward the viewer, out of the fan (each next card steps this way) */
  back: Vec3;
  /** straight up along the fan */
  up: Vec3;
  /** yaw that turns the backs to the camera */
  face: number;
  scale: number;
  /** height of the fan's top above the table */
  top: number;
}

/**
 * Opponent i's fan. The same size on screen at every seat (a seat nearer the camera gets slightly smaller cards),
 * smaller for a crowded table, and pulled in from the edges just enough to stay on screen.
 */
export function oppWall(g: GameView, i: number, v: View): OppWall {
  const A = arena(v);
  const a = seatAngle(g, i);
  const cam = v.portrait ? CAMERA.portrait.pos : CAMERA.landscape.pos;
  const n = g.s.players.length;
  // the size of every fan on screen: a little smaller as the table fills up
  const base = (v.portrait ? 0.62 : 0.86) * (n <= 4 ? 1 : n === 5 ? 0.94 : n === 6 ? 0.88 : n === 7 ? 0.82 : 0.78);
  let x = Math.cos(a) * A.rx;
  // a phone lying on its side is short: the far seats come a little closer, so their plates fit above them
  const near = v.compact && Math.sin(a) < 0 ? Math.max(0.76, Math.min(0.92, 0.85 + ((v.h ?? 390) - 390) * 0.001)) : 1;
  const z = Math.sin(a) * A.rz * near;
  const midY = 0.75 * base;
  // the far seat is the reference: a fan nearer the camera shrinks so it looks the same size
  const dRef = Math.hypot(cam[0], cam[1] - midY, cam[2] + A.rz);
  const scale = base * Math.min(1, Math.hypot(cam[0] - x, cam[1] - midY, cam[2] - z) / dRef);
  // keep the whole fan (and the mouse parallax) on screen
  const room = visibleHalfWidth(v, midY, z) - PARALLAX_X - FAN_HALF * scale - (v.portrait ? 0.15 : 0.3);
  if (Math.abs(x) > room) x = Math.sign(x) * Math.max(0, room);
  const face = Math.atan2(x - cam[0], z - cam[2]);
  eulTmp.set(OPP_FAN.lean, face, 0);
  qTmp.setFromEuler(eulTmp);
  vTmp.set(0, 1, 0).applyQuaternion(qTmp);
  const up: Vec3 = [vTmp.x, vTmp.y, vTmp.z];
  vTmp.set(0, 0, -1).applyQuaternion(qTmp);
  const back: Vec3 = [vTmp.x, vTmp.y, vTmp.z];
  const k = (FAN_LIFT * CARD_H + CARD_H / 2 - OPP_FAN.radius) * scale;
  return {
    pos: [x, 0, z],
    pivot: [x + up[0] * k, up[1] * k, z + up[2] * k],
    back,
    up,
    face,
    scale,
    top: (FAN_LIFT + 1) * CARD_H * scale * up[1],
  };
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/** how far (table units, a card is 1.5 tall) the hand sinks while it is someone else's turn */
const HAND_REST = 0.75;

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

  // the pile: a messy fan of the last cards, newest on top; only the top few are drawn (the rest are covered),
  // and they rest on the table, not on the hidden ones
  const dl = s.discard.length;
  const PILE_SHOWN = 10;
  const ps = pileScale(v);
  s.discard.forEach((c, i) => {
    const layer = Math.max(0, i - (dl - PILE_SHOWN));
    out.set(c.id, {
      pos: [A.discard[0] + (hash(c.id) - 0.5) * 0.55 * ps, 0.02 + layer * 0.016, A.discard[2] + (hash(c.id + 3) - 0.5) * 0.4 * ps],
      rot: [-PI / 2, (hash(c.id + 5) - 0.5) * 1.3, 0],
      zone: 'discard', interactive: false, dim: false, delay: dealDelay(c.dealIdx), hidden: i < dl - PILE_SHOWN, scale: ps,
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
      const flatW = Math.min(A.hand.maxW, 2 * (visibleHalfWidth(v, 0, A.hand.z - 0.3) * 0.92) - 1.0);
      const sp = Math.min(0.7, flatW / Math.max(m - 1, 1));
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
      // never wider than the screen at the hand's depth (minus the mouse parallax and a card's width)
      const vis = visibleHalfWidth(v, A.hand.y, A.hand.z);
      // a phone lying on its side: the hand stays between the corner panels (your plate, the draw button)
      const big = handScale(v);
      const fitW = v.compact
        ? 2 * vis * ((v.aspect ?? 2.1) < 1.95 ? 0.54 : 0.6) - big
        : v.portrait
          ? 2 * (vis * 0.95 - PARALLAX_X) - 1.0
          // a computer: the hand stays between your card (bottom-left) and the action button (bottom-right)
          : Math.min(2 * (vis * 0.95 - PARALLAX_X) - 1.0, 2 * vis * 0.58 - 1.0);
      const h = { ...A.hand, maxW: Math.min(A.hand.maxW, fitW) };
      // blind event: you still play, but you cannot see what
      const faceUp = (viewer === seat && s.blindTurns === 0) || over;
      // the card you just drew and can play stays up in front of you until you play it (or pass)
      const held = myTurn && faceUp && s.phase === 'play' && s.drawn && s.pending === 0
        ? p.hand.find(c => c.id === s.lastDrawn && g.playable(c))
        : undefined;
      if (held) {
        const H = v.portrait ? HELD.portrait : HELD.landscape;
        out.set(held.id, { pos: H.pos, rot: [H.tilt, 0, 0], zone: 'hand', interactive: true, dim: false, delay: 0, scale: H.scale, held: true, seq: p.hand.indexOf(held) });
      }
      const hand = held ? p.hand.filter(c => c !== held) : p.hand;
      const m = hand.length;
      // a big hand goes into two rows (the back row a little higher), so every card stays readable
      const rows = m > (v.portrait ? 11 : 20) ? 2 : 1;
      const backN = rows === 2 ? Math.ceil(m / 2) : m;
      const tilt = h.tilt;
      const rest = !myTurn && !over && s.phase !== 'handover' ? HAND_REST : 0;
      // the card face normal and its "up" direction: rows and layers move along them
      const ny = -Math.sin(tilt);
      const nz = Math.cos(tilt);
      const uy = Math.cos(tilt);
      const uz = Math.sin(tilt);
      // who may be laid now (your turn), or thrown in out of turn (Jump-In)
      const state = hand.map(c => {
        let interactive = false;
        let dim = false;
        let jump = false;
        if (myTurn && !over) {
          if (s.phase === 'play') {
            interactive = g.playable(c);
            dim = !interactive;
          } else if (s.phase === 'choose' && s.choice?.kind === 'card') interactive = true;
        } else if (!over && faceUp && g.jumpable(c)) interactive = jump = true;
        return { interactive, dim, jump };
      });
      // a playable card stands in front, shown whole: the fan opens around it (the card after it moves out of
      // the way, far enough that its corner number stays in view). The other cards share what room is left.
      // In a hand where you can play everything (or "pick a card to give"), the plain fan stays.
      // rows where there is no room to show the playable cards whole: those stay a plain fan
      const flat = new Set<number>();
      const raise = (k: number) => state[k].interactive && !state.every(x => x.interactive) && !flat.has(k);
      const xs: number[] = [];
      const rowSizes = rows === 2 ? [backN, m - backN] : [m];
      let first = 0;
      for (let r = 0; r < rowSizes.length; r++) {
        const n = rowSizes[r];
        const cs = (rows === 2 ? (v.portrait ? 0.86 : 0.8) : 1) * big;
        const sp = Math.min(h.sp * cs, (h.maxW - (rows === 2 ? (v.portrait ? 0.9 : 1.2) : 0)) / Math.max(n - 1, 1));
        const room = sp * Math.max(n - 1, 0);
        // A raised card wants a whole card width after it (it stands in front and hides the next card's left side,
        // where the number is); the card just before a raised one keeps at least its corner number in view.
        const w = CARD_W * cs;
        const want: number[] = [];
        for (let i = 0; i < n - 1; i++) {
          const here = raise(first + i);
          const next = raise(first + i + 1);
          want.push(here ? Math.max(sp, w * 1.0) : next ? Math.max(Math.min(sp, w * 0.2), w * 0.3) : Math.min(sp, w * 0.2));
        }
        const need = want.reduce((a, b) => a + b, 0);
        const roomMax = Math.max(room, h.maxW - w * 0.2);
        let gaps: number[];
        if (need <= roomMax) {
          // it fits: the plain cards share the rest of the room (up to their usual step)
          const spare = roomMax - need;
          const plainIdx = want.map((_, i) => i).filter(i => !raise(first + i));
          const extra = plainIdx.length ? Math.min(spare / plainIdx.length, sp) : 0;
          gaps = want.map((d, i) => (raise(first + i) ? d : Math.min(Math.max(d, sp), d + extra)));
        } else {
          // too many to show whole: the plain fan, the playable cards just risen in it (every number stays in view)
          for (let i = 0; i < n; i++) flat.add(first + i);
          gaps = Array.from({ length: Math.max(n - 1, 0) }, () => sp);
        }
        const total = gaps.reduce((a, b) => a + b, 0);
        let x = -total / 2;
        for (let i = 0; i < n; i++) {
          xs[first + i] = x;
          x += gaps[i] ?? 0;
        }
        first += n;
      }
      hand.forEach((c, k) => {
        const row = rows === 2 && k >= backN ? 1 : 0;
        const inRow = row ? k - backN : k;
        const rowN = row ? m - backN : backN;
        // two rows: smaller cards and a narrower spread, so both rows fit on screen
        // a phone lying on its side: bigger cards, easier to read and to hit with a finger
        const cs = (rows === 2 ? (v.portrait ? 0.86 : 0.8) : 1) * big;
        const off = inRow - (rowN - 1) / 2;
        const x = xs[k];
        const { interactive, dim, jump } = state[k];
        // a playable card rises; in a two-row hand the front row only a little, or it would cover the row behind
        const lift = interactive ? (rows === 2 && row === 1 ? 0.1 : 0.3) : 0;
        // each card in front of its left neighbour, the front row in front of the back row, and a raised card in
        // front of everything in its row (the fan has opened around it, so it hides no corner number).
        // The step shrinks for big hands so the whole fan never comes too close to the camera.
        const layer = inRow * Math.min(0.02, 0.3 / rowN) + row * 0.32 + (raise(k) ? 0.12 : 0);
        // two rows sit a bit higher, so the front row clears the bottom panel
        // waiting for someone else: the hand sinks a little (corners still readable); on your turn it rises
        const up = (rows === 2 ? (row ? -0.38 : 0.42) * cs + (v.portrait ? 0.1 : 0.32) : 0) - rest + (big - 1) * 0.3;
        out.set(c.id, {
          // the lift runs up along the hand's own slant: straight up in the world would tip the card back behind its
          // neighbours (the hand leans toward you)
          pos: [x, h.y + ny * layer + uy * (up + lift) - Math.abs(off) * 0.86 * 0.02, h.z + nz * layer + uz * (up + lift)],
          rot: [faceUp ? tilt : tilt + PI, 0, -off * Math.min(0.035, 0.4 / rowN)],
          zone: 'hand', interactive, dim, jump, delay: dealDelay(c.dealIdx), scale: cs, seq: p.hand.indexOf(c),
        });
      });
      return;
    }
    // opponents hold their cards in an upright fan, backs to the camera: every seat looks the same
    const w = oppWall(g, pi, v);
    const { scale: S, face } = w;
    const lx: Vec3 = [Math.cos(face), 0, -Math.sin(face)];
    if (over) {
      // finale: leftover cards spread face up on the table in front of their owner
      const fsp = Math.min(0.5, 2.4 / Math.max(m - 1, 1));
      p.hand.forEach((c, k) => {
        const off = k - (m - 1) / 2;
        out.set(c.id, {
          pos: [w.pos[0] * 0.92 + lx[0] * off * fsp, 0.03 + k * 0.004, w.pos[2] * 0.92 + lx[2] * off * fsp],
          rot: [-PI / 2, 0, -off * 0.05],
          zone: 'opp', interactive: false, dim: false, delay: 0,
        });
      });
      return;
    }
    // the same fan whatever the seat: the same lean, the same spread, each card a fixed step in front of the last
    const step = Math.min(OPP_FAN.step, OPP_FAN.spread / Math.max(m - 1, 1));
    // your partner (2 vs 2 and up) shows you their cards: the same fan, turned to face you
    const me = g.seat();
    const open = !!s.teams && me !== null && me >= 0 && pi !== me && s.teams[pi] === s.teams[me] && p.hand.every(c => !c.hidden);
    p.hand.forEach((c, k) => {
      const phi = (k - (m - 1) / 2) * step;
      // backs to you: turned upside down so the back reads upright; faces to you: turned round, upright as is
      const yaw = open ? face + PI : face;
      const roll = open ? -phi : PI + phi;
      eulTmp.set(OPP_FAN.lean, yaw, roll);
      qTmp.setFromEuler(eulTmp);
      // the card's centre swings around the pivot below the fan
      vTmp.set(0, (open ? 1 : -1) * OPP_FAN.radius * S, 0).applyQuaternion(qTmp);
      const d = k * OPP_FAN.depth;
      out.set(c.id, {
        pos: [w.pivot[0] + vTmp.x + w.back[0] * d, w.pivot[1] + vTmp.y + w.back[1] * d, w.pivot[2] + vTmp.z + w.back[2] * d],
        rot: [OPP_FAN.lean, yaw, roll],
        zone: 'opp', interactive: false, dim: false, delay: dealDelay(c.dealIdx), scale: S, bobGroup: pi + 1, seq: k,
      });
    });
  });
  return out;
}
