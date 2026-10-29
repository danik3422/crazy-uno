import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { arc, burst, easeOutBack, fade, ring } from '../shapes';

const FLY = 0.6;

/** Gift: a present hops from the giver to the lucky one and bursts into confetti. */
export const gift: Motif = {
  life: FLY + 0.9,
  waits: true,
  frame(k, a, t, since) {
    if (since < 0) {
      // choosing: the present wobbles over the giver
      k.i(CELL_ID.gift, a.from.x, 1.6 + Math.abs(Math.sin(t * 5)) * 0.25, a.from.z, 1.6 * easeOutBack(t / 0.3), Math.sin(t * 6) * 0.2, false, null, 1);
      return;
    }
    const b = a.to[0];
    if (!b) return;
    if (since < FLY) {
      const q = arc({ x: a.from.x, y: 1.6, z: a.from.z }, { x: b.x, y: 1.1, z: b.z }, since / FLY, 1.6);
      k.i(CELL_ID.gift, q.x, q.y, q.z, 1.7, since * 8, false, null, 1);
      k.g(CELL_ID.spark, q.x, q.y, q.z, 0.9, since * 10, false, a.color, 0.8);
      return;
    }
    const d = since - FLY;
    k.i(CELL_ID.gift, b.x, 1.1 + 0.3 * easeOutBack(d / 0.2), b.z, 2.0 * (1 + Math.max(0, 0.25 - d)), 0, false, null, fade(d, 0.6, 0.01, 0.25));
    burst(k, b.x, 1.2, b.z, d, 22, 3.2, null, 0.35, 0.9, a.seed, true);
    ring(k, b.x, b.z, d, 0.5, 0.3, 1.8, a.color, 0.9, true);
  },
};
