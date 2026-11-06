import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { arc, clamp01, easeInOut, fade } from '../shapes';

const LIFE = 1.0;

/** Zero (7–0 rule): every hand slides on to the next seat, shown as glowing arrows from seat to seat. */
export const handPass: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const al = fade(t, LIFE, 0.05, 0.25);
    const seats = a.to;
    for (let i = 0; i < seats.length; i++) {
      const from = seats[i];
      const to = seats[(i + 1) % seats.length];
      const yaw = Math.atan2(to.z - from.z, to.x - from.x);
      for (let j = 0; j < (k.lite ? 2 : 3); j++) {
        const p = easeInOut(clamp01((t - j * 0.08) / 0.7));
        if (p <= 0 || p >= 1) continue;
        const q = arc({ x: from.x, y: 0.8, z: from.z }, { x: to.x, y: 0.8, z: to.z }, p, 0.8);
        k.g(j ? CELL_ID.glow : CELL_ID.cardGlow, q.x, q.y, q.z, j ? 0.6 : 0.8, -yaw, false, a.color, al * (1 - j * 0.3), j ? 0.6 : 1.1);
      }
    }
  },
};
