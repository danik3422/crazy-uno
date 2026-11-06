import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { DARK, burst, easeOutBack, fade, flash, once, raw, ring } from '../shapes';
import { shake } from '../../fxState';

const LIFE = 1.6;
const ASH = raw('#9a94a8');

/** No Mercy knock-out: a skull rises over the player, their seat goes dark with a heavy shockwave. */
export const knockout: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const v = a.to[0];
    if (!v) return;
    if (once(a, 1)) shake(0.6, 0.5);
    const al = fade(t, LIFE, 0.05, 0.35);
    k.s(CELL_ID.glow, v.x, 0.02, v.z, 3.4 * easeOutBack(t / 0.3), 0, true, DARK, 0.7 * al);
    ring(k, v.x, v.z, t, 0.7, 0.4, 3.2, ASH, 1, true);
    ring(k, v.x, v.z, t - 0.15, 0.7, 0.3, 2.2, ASH, 0.8);
    flash(k, v.x, 1, v.z, t, 0.4, 3, ASH, 0.8);
    burst(k, v.x, 0.8, v.z, t, 18, 3, ASH, 0.4, 0.9, a.seed);
    k.i(CELL_ID.skull, v.x, 1.4 + Math.min(1, t / 0.6) * 0.8, v.z, 1.8 * easeOutBack(t / 0.35), Math.sin(t * 8) * 0.15 * (1 - t / LIFE), false, null, al);
  },
};
