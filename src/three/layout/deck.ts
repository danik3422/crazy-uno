import type { GameView } from '../../game/view';
import { oppWall } from './seats';
import { RING_R, RING_Z, arena } from './table';
import type { Vec3, View } from './types';

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
