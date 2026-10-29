import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { burst, easeOutBack, fade, flash, hump, once, ring } from '../shapes';
import { shake } from '../../fxState';

const LIFE = 1.4;
/** how fast the wave travels over the table (units per second) */
const SPEED = 11;

/** Skip everyone: a shockwave rolls out from the pile and stamps a barrier on every other seat. */
export const skipAll: Motif = {
  life: LIFE,
  frame(k, a, t) {
    if (once(a, 1)) shake(0.3, 0.35);
    const al = fade(t, LIFE, 0.05, 0.3);
    k.badge(a.tex, a.pile.x, 1.6 + hump(t / LIFE) * 0.2, a.pile.z, 2.1 * easeOutBack(t / 0.3) * (1 + hump(t / 0.25) * 0.15), 0, al);
    ring(k, a.pile.x, a.pile.z, t, 0.9, 0.5, 9.5, a.color, 1, true);
    ring(k, a.pile.x, a.pile.z, t - 0.1, 0.9, 0.4, 7.5, a.color, 0.7);
    flash(k, a.pile.x, 0.6, a.pile.z, t, 0.4, 5, a.color, 0.9);
    for (let i = 0; i < a.to.length; i++) {
      const v = a.to[i];
      // each seat is hit when the wave reaches it
      const hit = Math.hypot(v.x - a.pile.x, v.z - a.pile.z) / SPEED;
      const d = t - hit;
      if (d < 0) continue;
      const s = easeOutBack(d / 0.25, 3);
      const fa = fade(d, LIFE - hit, 0.01, 0.3);
      k.i(CELL_ID.barrier, v.x, 0.9 + s * 0.4, v.z, 1.1 * s, 0, false, a.color, fa);
      k.s(CELL_ID.barrier, v.x, 0.014, v.z, 1.9 * s, 0, true, a.color, fa * 0.85);
      ring(k, v.x, v.z, d, 0.4, 0.3, 1.4, a.color, 0.9);
      burst(k, v.x, 0.9, v.z, d, 6, 2, a.color, 0.25, 0.5, a.seed + i * 13);
    }
  },
};
