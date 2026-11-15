import type { GameView } from '../../game/view';
import { placeFan } from './fanTargets';
import { oppWall } from './seats';
import { cardsRect, handTop, viewSize, zAbove } from './fit';
import { DECK_TOP, RING_R, RING_Z, arena } from './table';
import type { Target, Vec3, View } from './types';

/* Where the deck lies on the table, and where it is shuffled and dealt from. */

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
  // the deck's near edge (about 0.8 in front of its middle) stays above the top of your hand on the screen,
  // whatever the screen's shape (see handTop): on a short phone that is well back from the hand
  const handZ = Math.min(v.portrait ? 5.2 : 3.0, zAbove(v, handTop(v)) - 0.8);
  // On screen: every opponent's fan as it is laid out, the deck's own outline at a spot, and the screen's edges.
  // A spot where the deck would cover a fan or leave the screen is not taken.
  const { w: W, h: H } = viewSize(v);
  const fanTs = new Map<number, Target>();
  const ctx = { g, v, A, out: fanTs, dealDelay: () => 0, seat, viewer: null, myTurn: false, over: false };
  const fans = g.s.players.flatMap((p, i) => {
    if (i === seat || !p.hand.length) return [];
    fanTs.clear();
    placeFan(ctx, p, i);
    return [cardsRect(v, fanTs.values())];
  });
  const pad = 6;
  /** how much of the fans the deck would cover there (square pixels; 0: none), or Infinity if it leaves the screen */
  const covers = (x: number, z: number) => {
    // the top card of the stack (as computeTargets lays it) and the same outline down on the table
    const top: Target = { pos: [x, DECK_TOP + 0.05, z], rot: [Math.PI / 2, -0.35, 0], zone: 'deck', interactive: false, dim: false, delay: 0 };
    const r = cardsRect(v, [top, { ...top, pos: [x, 0, z] }]);
    if (r.x0 < pad || r.y0 < pad || r.x1 > W - pad || r.y1 > H - pad) return Infinity;
    let sum = 0;
    for (const f of fans) {
      const ox = Math.min(r.x1 + pad, f.x1) - Math.max(r.x0 - pad, f.x0);
      const oy = Math.min(r.y1 + pad, f.y1) - Math.max(r.y0 - pad, f.y0);
      if (ox > 0 && oy > 0) sum += ox * oy;
    }
    return sum;
  };
  // the deck (about 1 × 1.5) must keep its whole body outside the ring
  const ringOut = (x: number, z: number) => {
    const rx = RING_R + 0.95;
    // the stack is tall and the camera looks down at an angle: on the near side it needs more room
    const rz = RING_R * RING_Z + (z > D[2] ? 1.4 : 1.05);
    return ((x - D[0]) / rx) ** 2 + ((z - D[2]) / rz) ** 2 >= 1;
  };
  let best: Vec3 = [D[0] - (RING_R + 1.4), 0, D[2] + 0.8];
  let bestScore = -Infinity;
  // the spot that covers the least of the fans on screen (none, nearly always), the best scored among those
  let seen: Vec3 | null = null;
  let seenScore = -Infinity;
  let seenCover = Infinity;
  // the search reaches past the usual edges: the screen check keeps the deck on screen
  for (let x = -xMax - 1.2; x <= xMax + 1.2 + 1e-6; x += 0.2) {
    for (let z = zMin - 1.2; z <= handZ; z += 0.2) {
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
      // (the screen check costs more than the score: only for a spot that could win)
      if (seenCover > 0 || score > seenScore) {
        const c = covers(x, z);
        if (c < seenCover || (c === seenCover && score > seenScore)) {
          seenCover = c;
          seenScore = score;
          seen = [x, 0, z];
        }
      }
    }
  }
  return seen ?? best;
}

/** Where the deck is shuffled and dealt from: exactly the middle of the table (the centre of the ring). */
export function deckCenter(_g: GameView, v: View): Vec3 {
  const A = arena(v);
  return [A.discard[0], 0, A.discard[2]];
}
