import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { FOUR, WHITE, arc, easeOutBack, fade, flash } from '../shapes';

const FLY = 0.5;
const LIFE = 1.5;

/** Dare: the theatre mask flies to the next player, a spotlight falls on them, question marks circle. */
export const dare: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const v = a.to[0];
    if (!v) return;
    const al = fade(t, LIFE, 0.05, 0.3);
    if (t < FLY) {
      const q = arc({ x: a.pile.x, y: 1.4, z: a.pile.z }, { x: v.x, y: 1.6, z: v.z }, t / FLY, 1.2);
      k.i(CELL_ID.mask, q.x, q.y, q.z, 1.6, t * 12, false, null, 1);
      return;
    }
    const d = t - FLY;
    // spotlight on the floor and a soft beam
    k.s(CELL_ID.glow, v.x, 0.02, v.z, 3.6 * easeOutBack(d / 0.25), 0, true, WHITE, 0.55 * al);
    k.g(CELL_ID.glow, v.x, 0.05, v.z, 3.0 * easeOutBack(d / 0.25), 0, true, WHITE, 0.5 * al);
    k.g(CELL_ID.glow, v.x, 1.8, v.z, 2.4, 0, false, WHITE, 0.3 * al, 4.4);
    k.i(CELL_ID.mask, v.x, 1.8 + Math.sin(d * 5) * 0.08, v.z, 2.0 * easeOutBack(d / 0.25), Math.sin(d * 4) * 0.25, false, null, al);
    for (let i = 0; i < 3; i++) {
      const ang = d * 3 + (i * Math.PI * 2) / 3;
      k.i(CELL_ID.question, v.x + Math.cos(ang) * 1.4, 1.8 + Math.sin(ang * 2) * 0.25, v.z + Math.sin(ang) * 0.5, 0.8, Math.sin(d * 6 + i) * 0.3, false, FOUR[i], al);
    }
    flash(k, v.x, 1.6, v.z, d, 0.35, 3, a.color, 0.9);
  },
};
