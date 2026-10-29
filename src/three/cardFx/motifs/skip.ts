import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { arc, burst, easeOutBack, fade, flash, once, ring } from '../shapes';
import { shake } from '../../fxState';

const FLY = 0.38;
const LIFE = 1.3;

/** Skip: the ⊘ badge is hurled at the skipped player and slams down as a barrier in front of them. */
export const skip: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const v = a.to[0];
    if (!v) return;
    if (t < FLY) {
      const q = arc({ x: a.pile.x, y: 1.4, z: a.pile.z }, { x: v.x, y: 1.5, z: v.z }, t / FLY, 1.2);
      k.badge(a.tex, q.x, q.y, q.z, 1.2 + (t / FLY) * 0.5, t * 14, 1);
      k.g(CELL_ID.glow, q.x, q.y, q.z, 2.4, 0, false, a.color, 0.7);
      return;
    }
    const d = t - FLY;
    if (once(a, 1)) {
      shake(0.22, 0.25);
    }
    // the slam: squashed, then springing up a little over the seat
    const s = easeOutBack(d / 0.3, 3);
    const al = fade(d, LIFE - FLY, 0.01, 0.3);
    k.badge(a.tex, v.x, 1.0 + s * 0.45, v.z, 1.7 * (0.75 + s * 0.25), Math.sin(d * 18) * 0.25 * Math.exp(-d * 5), al);
    // the barrier lying on the floor in front of the seat
    k.s(CELL_ID.barrier, v.x, 0.014, v.z, 2.4 * easeOutBack(d / 0.25), 0, true, a.color, al * 0.9);
    ring(k, v.x, v.z, d, 0.5, 0.4, 2.2, a.color, 1, true);
    ring(k, v.x, v.z, d - 0.1, 0.5, 0.3, 1.5, a.color, 0.8);
    burst(k, v.x, 0.8, v.z, d, 14, 3, a.color, 0.35, 0.6, a.seed);
    flash(k, v.x, 0.9, v.z, d, 0.35, 3, a.color, 0.9);
  },
};
