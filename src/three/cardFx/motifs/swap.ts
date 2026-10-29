import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { easeOutBack, fade, flash, hump, ring, volley } from '../shapes';

const LIFE = 1.3;

/** Swap (and a seven): two streams of cards cross between the two seats, the ⇆ badge over the middle. */
export const swap: Motif = {
  life: LIFE,
  waits: true,
  frame(k, a, t, since) {
    if (since < 0) {
      // waiting for the partner to be picked: the badge bobs over the pile
      k.badge(a.tex, a.pile.x, 1.7 + Math.sin(t * 4) * 0.1, a.pile.z, 1.5 * easeOutBack(t / 0.3), Math.sin(t * 3) * 0.2, 1);
      return;
    }
    const b = a.to[0];
    if (!b) return;
    const n = a.n > 0 ? a.n : k.lite ? 3 : 5;
    const A = { x: a.from.x, y: 0.8, z: a.from.z };
    const B = { x: b.x, y: 0.8, z: b.z };
    volley(k, A, B, since, n, 0.07, 0.6, a.color, a.seed, 2.2);
    volley(k, B, A, since, n, 0.07, 0.6, a.color, a.seed + 1, 0.9);
    const mx = (A.x + B.x) / 2;
    const mz = (A.z + B.z) / 2;
    const al = fade(since, LIFE, 0.08, 0.3);
    k.badge(a.tex, mx, 2.2 + hump(since / LIFE) * 0.3, mz, 1.6 * easeOutBack(since / 0.3), since * 5, al);
    ring(k, A.x, A.z, since, 0.5, 0.3, 1.6, a.color, 0.8);
    ring(k, B.x, B.z, since, 0.5, 0.3, 1.6, a.color, 0.8);
    flash(k, mx, 2.2, mz, since - 0.35, 0.4, 3, a.color, 0.8);
    k.g(CELL_ID.glow, mx, 2.2, mz, 2.6, 0, false, a.color, 0.4 * al);
  },
};
