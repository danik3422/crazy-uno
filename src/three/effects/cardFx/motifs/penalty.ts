import type { Active, Kit, Motif } from '../kit';
import { burst, flash, once, ring } from '../shapes';
import { shake } from '../../fxState';
import { CELL_ID } from '../atlas';

/**
 * The hit of a penalty, the moment the last of the real penalty cards lands in the victim's hand
 * (the cards themselves fly from the deck: see Card3D). The bigger the penalty, the heavier the hit.
 * `t` counts from the landing.
 */
export function hit(k: Kit, a: Active, t: number) {
  const v = a.to[0];
  if (!v || t < 0) return;
  if (once(a, 2)) {
    // +2 a nudge, +4 a thump, +10 an earthquake
    shake(Math.min(1.2, 0.12 + a.n * 0.09), 0.25 + a.n * 0.04);
  }
  const big = a.n >= 6;
  ring(k, v.x, v.z, t, 0.55, 0.4, 1.6 + a.n * 0.18, a.color, 1, true);
  if (big) ring(k, v.x, v.z, t - 0.12, 0.6, 0.3, 2 + a.n * 0.2, a.color, 0.8);
  flash(k, v.x, 0.9, v.z, t, 0.45, 2 + a.n * 0.25, a.color, 1);
  burst(k, v.x, 0.6, v.z, t, 8 + a.n * 2, 2.5 + a.n * 0.15, a.color, 0.35, 0.8, a.seed + 3);
  if (a.n >= 10) {
    // +10: flames over the victim
    for (let i = 0; i < (k.lite ? 3 : 5); i++) {
      const p = (t - i * 0.05) / 0.9;
      if (p < 0 || p > 1) continue;
      k.i(CELL_ID.fire, v.x + (i - 2) * 0.35, 0.5 + p * 1.5, v.z, 1.1 * (1 - p * 0.5), 0, false, null, 1 - p);
    }
  }
}

/** A penalty taken: starts when its last card lands (see CardFx). */
export const penaltyHit: Motif = {
  life: 1,
  frame(k, a, t) {
    hit(k, a, t);
  },
};

/**
 * +2 and the coloured +4: a quick glow on the pile in the card's colour. The cards only fly when the
 * penalty is actually taken (it may still be stacked on), and the hit lands with them.
 */
export const penalty: Motif = {
  life: 0.5,
  frame(k, a, t) {
    flash(k, a.pile.x, 0.6, a.pile.z, t, 0.3, 2.5, a.color, 0.8);
  },
};
