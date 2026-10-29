import type { Active, Kit, Motif } from '../kit';
import { burst, flash, once, ring, volley } from '../shapes';
import { shake } from '../../fxState';
import { CELL_ID } from '../atlas';

const GAP = 0.07;
const FLIGHT = 0.5;

/** Penalty cards shoot from the deck at the victim. The bigger the penalty, the heavier the hit. */
export function salvo(k: Kit, a: Active, t: number) {
  const v = a.to[0];
  if (!v) return;
  const n = Math.min(a.n, k.lite ? 6 : 10);
  const gap = n > 6 ? 0.045 : GAP;
  const landed = volley(k, a.deck, { x: v.x, y: 0.7, z: v.z }, t, n, gap, FLIGHT, a.color, a.seed, 1.8 + n * 0.06);
  const end = FLIGHT + (n - 1) * gap;
  const d = t - end;
  if (landed === n && d >= 0) {
    if (once(a, 2)) {
      // +2 a nudge, +4 a thump, +10 an earthquake
      shake(Math.min(1.2, 0.12 + a.n * 0.09), 0.25 + a.n * 0.04);
    }
    const big = a.n >= 6;
    ring(k, v.x, v.z, d, 0.55, 0.4, 1.6 + a.n * 0.18, a.color, 1, true);
    if (big) ring(k, v.x, v.z, d - 0.12, 0.6, 0.3, 2 + a.n * 0.2, a.color, 0.8);
    flash(k, v.x, 0.9, v.z, d, 0.45, 2 + a.n * 0.25, a.color, 1);
    burst(k, v.x, 0.6, v.z, d, 8 + a.n * 2, 2.5 + a.n * 0.15, a.color, 0.35, 0.8, a.seed + 3);
    if (a.n >= 10) {
      // +10: flames over the victim
      for (let i = 0; i < (k.lite ? 3 : 5); i++) {
        const p = (d - i * 0.05) / 0.9;
        if (p < 0 || p > 1) continue;
        k.i(CELL_ID.fire, v.x + (i - 2) * 0.35, 0.5 + p * 1.5, v.z, 1.1 * (1 - p * 0.5), 0, false, null, 1 - p);
      }
    }
  }
}

export const salvoLife = (n: number) => FLIGHT + (Math.min(n, 10) - 1) * GAP + 0.9;

/** +2 and the coloured +4: no colour to pick, the cards go at once. */
export const penalty: Motif = {
  life: 1.5,
  frame(k, a, t) {
    // a quick glow on the pile first, in the card's colour
    flash(k, a.pile.x, 0.6, a.pile.z, t, 0.3, 2.5, a.color, 0.8);
    salvo(k, a, t);
  },
};
