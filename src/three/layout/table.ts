import type { GameView } from '../../game/view';
import { oppWall } from './seats';
import type { Vec3, View, Zone } from './types';

/* The table itself: where the deck, the pile and your hand are, how big their cards are, and the ring of arrows. */

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
