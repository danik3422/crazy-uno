import { CELL_ID } from '../atlas';
import type { Active, Kit, Motif } from '../kit';
import { burst, clamp01, easeInOut, easeOutBack, fade, flash, ring, volley } from '../shapes';

const GAP = 0.06;
const FLIGHT = 0.42;

/** The cards of one colour sweep out of a hand onto the pile, then a broom (or bin) swishes the pile. */
function sweep(k: Kit, a: Active, t: number, icon: number) {
  const n = Math.min(a.n, k.lite ? 5 : 9);
  volley(k, { x: a.from.x, y: 0.8, z: a.from.z }, { x: a.pile.x, y: 0.3, z: a.pile.z }, t, n, GAP, FLIGHT, a.color, a.seed, 1.2, 0.55);
  const d = t - (FLIGHT + Math.max(0, n - 1) * GAP);
  // the swish: an arc of light across the pile
  if (d >= 0 && d < 0.6) {
    const p = easeInOut(d / 0.45);
    for (let i = 0; i < (k.lite ? 4 : 7); i++) {
      const ang = Math.PI * (1.15 - p * 1.3) + i * 0.09;
      k.g(CELL_ID.streak, a.pile.x + Math.cos(ang) * 1.4, 0.4, a.pile.z + Math.sin(ang) * 1.0, 1.4, -ang + Math.PI / 2, true, a.color, (1 - d / 0.6) * (1 - i * 0.12), 0.5);
    }
    const ang = Math.PI * (1.15 - p * 1.3);
    k.i(icon as never, a.pile.x + Math.cos(ang) * 1.3, 1.2, a.pile.z + Math.sin(ang) * 0.9, 1.6, -0.6 + p * 1.2, false, null, Math.min(1, (0.6 - d) / 0.15));
  }
  ring(k, a.pile.x, a.pile.z, d - 0.2, 0.5, 0.5, 2.6, a.color, 0.9, true);
  burst(k, a.pile.x, 0.6, a.pile.z, d - 0.2, 12, 2.8, a.color, 0.35, 0.6, a.seed + 5);
  // the count of cards thrown away, as dots popping over the pile
  const shown = Math.min(a.n, 12);
  for (let i = 0; i < shown; i++) {
    const s = easeOutBack(clamp01((d - 0.2 - i * 0.03) / 0.25));
    const x = a.pile.x + (i - (shown - 1) / 2) * 0.28;
    k.g(CELL_ID.dot, x, 2.2, a.pile.z, 0.26 * s, 0, false, a.color, fade(d - 0.2, 0.9, 0.05, 0.3));
  }
}

const life = (n: number) => FLIGHT + (Math.min(n, 9) - 1) * GAP + 1.0;

/** Discard all of a colour (No Mercy): the badge pops, the cards fly in, a swish clears them. */
export const discardAll: Motif = {
  life: 1.9,
  frame(k, a, t) {
    k.badge(a.tex, a.pile.x, 1.8, a.pile.z, 1.6 * easeOutBack(t / 0.3), 0, fade(t, life(a.n), 0.05, 0.3));
    sweep(k, a, t, CELL_ID.bin);
    flash(k, a.pile.x, 0.5, a.pile.z, t, 0.3, 2.5, a.color, 0.7);
  },
};

/** Dump (party): a broom while the colour is picked, then the sweep in the picked colour. */
export const dump: Motif = {
  life: 1.9,
  waits: true,
  frame(k, a, t, since) {
    if (since < 0) {
      k.i(CELL_ID.broom, a.pile.x + Math.sin(t * 5) * 0.4, 1.5, a.pile.z, 1.6, Math.sin(t * 5) * 0.5, false, null, Math.min(1, t * 4));
      return;
    }
    sweep(k, a, since, CELL_ID.broom);
  },
};
