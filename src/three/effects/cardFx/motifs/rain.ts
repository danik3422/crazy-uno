import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { DARK, fade, raw, rnd, ring, volley } from '../shapes';

const LIFE = 1.5;
const DROP = raw('#bfe3ff');

/** Rain: a cloud over every other seat pours down on them, and a card drops to each from the deck. */
export const rain: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const al = fade(t, LIFE, 0.15, 0.35);
    const per = k.lite ? 4 : 7;
    for (let s = 0; s < a.to.length; s++) {
      const v = a.to[s];
      k.i(CELL_ID.cloud, v.x, 2.6 + Math.sin(t * 2 + s) * 0.06, v.z, 2.6, 0, false, DARK, al * 0.9, 1.6);
      for (let i = 0; i < per; i++) {
        const p = (t * 1.8 + rnd(a.seed + s, i)) % 1;
        const dx = (rnd(a.seed + s, i + 30) - 0.5) * 1.4;
        k.g(CELL_ID.drop, v.x + dx, 2.3 - p * 2.2, v.z + (rnd(a.seed, i + s) - 0.5) * 0.4, 0.2, 0, false, DROP, al, 0.38);
        if (p > 0.85) k.g(CELL_ID.ring, v.x + dx, 0.05, v.z, 0.5 * (p - 0.85) * 6, 0, true, DROP, al * 0.6);
      }
      volley(k, a.deck, { x: v.x, y: 0.7, z: v.z }, t - 0.2 - s * 0.08, 1, 0, 0.55, DROP, a.seed + s, 1.4, 0.5);
      ring(k, v.x, v.z, t - 0.75 - s * 0.08, 0.5, 0.2, 1.2, DROP, 0.7);
    }
  },
};
