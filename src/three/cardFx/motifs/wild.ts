import { CELL_ID } from '../atlas';
import type { Active, Kit, Motif } from '../kit';
import { FOUR, WHITE as WHITE_HOT, burst, easeOut, flash, once, ring, splash } from '../shapes';
import { salvo } from './penalty';
import { whirl } from './reverse';
import { shake } from '../../fxState';

/** While the colour is being picked: four coloured orbs circle the pile. */
export function charge(k: Kit, a: Active, t: number, out: number) {
  // out: 0 while waiting, then 0 → 1 as the orbs dive into the pile
  const r = 1.4 * (1 - easeOut(out)) * Math.min(1, t / 0.25);
  for (let i = 0; i < 4; i++) {
    const ang = t * 3.2 + (i * Math.PI) / 2;
    const x = a.pile.x + Math.cos(ang) * r;
    const z = a.pile.z + Math.sin(ang) * r * 0.7;
    const y = 1.0 + Math.sin(t * 4 + i) * 0.15;
    k.g(CELL_ID.glow, x, y, z, 0.9, 0, false, FOUR[i], 1 - out * 0.5);
    k.s(CELL_ID.dot, x, y, z, 0.36, 0, false, FOUR[i], 1);
  }
}

/** The colour splash when the colour is picked. */
export function paint(k: Kit, a: Active, t: number, scale: number) {
  splash(k, a.pile.x, a.pile.z, t, a.color, scale, a.seed);
  ring(k, a.pile.x, a.pile.z, t, 0.6, 0.5, 3.5 * scale, a.color, 1, true);
  flash(k, a.pile.x, 1, a.pile.z, t, 0.4, 4 * scale, a.color, 1);
  burst(k, a.pile.x, 0.8, a.pile.z, t, 12, 3.2 * scale, a.color, 0.4, 0.7, a.seed + 1);
}

const ORB_IN = 0.2;

/** Wild: orbs while choosing, then a paint splash in the new colour. */
export const wild: Motif = {
  life: 1.4,
  waits: true,
  frame(k, a, t, since) {
    if (since < 0) return charge(k, a, t, 0);
    if (since < ORB_IN) charge(k, a, t, since / ORB_IN);
    paint(k, a, since - ORB_IN, 1);
  },
};

/** Wild +4 / +6 / +10: the same, then the penalty cards go at the victim, heavier each step. */
export const wildDraw: Motif = {
  life: 2.2,
  waits: true,
  frame(k, a, t, since) {
    if (since < 0) {
      charge(k, a, t, 0);
      // +10 rumbles while it waits
      if (a.n >= 10) k.i(CELL_ID.skull, a.pile.x, 2 + Math.sin(t * 6) * 0.1, a.pile.z, 1.5, Math.sin(t * 9) * 0.2, false, null, Math.min(1, t * 3));
      return;
    }
    if (since < ORB_IN) charge(k, a, t, since / ORB_IN);
    const s = since - ORB_IN;
    const scale = a.n >= 10 ? 1.5 : a.n >= 6 ? 1.2 : 1;
    if (a.n >= 10 && s >= 0 && once(a, 4)) {
      shake(0.5, 0.4);
    }
    paint(k, a, s, scale);
    if (a.n >= 10) {
      // +10: the whole table shakes off a double shockwave and a fountain of colour
      burst(k, a.pile.x, 0.5, a.pile.z, s, 26, 5, null, 0.45, 1, a.seed + 9, true);
      ring(k, a.pile.x, a.pile.z, s, 1.0, 1, 10, a.color, 1, true);
      ring(k, a.pile.x, a.pile.z, s - 0.18, 1.0, 1, 8, WHITE_HOT, 0.8, true);
    }
    salvo(k, a, s - 0.15);
  },
};

/** Wild reverse +4: the arrows whirl at once, then splash and four cards at the new victim. */
export const wildRev4: Motif = {
  life: 2.1,
  waits: true,
  frame(k, a, t, since) {
    whirl(k, a, t, 1.25);
    if (since < 0) return charge(k, a, t, 0);
    if (since < ORB_IN) charge(k, a, t, since / ORB_IN);
    paint(k, a, since - ORB_IN, 1);
    salvo(k, a, since - ORB_IN - 0.15);
  },
};

/** Chaos: a vortex on the table while the hands are whirled, then the colour splash. */
export const chaos: Motif = {
  life: 1.4,
  waits: true,
  frame(k, a, t, since) {
    const on = t < 1.9 ? Math.min(1, t / 0.2, (1.9 - t) / 0.4) : 0;
    if (on > 0) {
      for (let i = 0; i < 3; i++) k.g(CELL_ID.swirl, a.pile.x, 0.05 + i * 0.01, a.pile.z, (3.5 + i * 1.6) * on, -t * (5 - i), true, i === 1 ? null : FOUR[(i * 2) % 4], 0.7 * on);
      // dust and wind spiralling up
      const n = k.lite ? 10 : 20;
      for (let i = 0; i < n; i++) {
        const p = (t * 0.8 + i / n) % 1;
        const ang = -t * 5 - i * 2.4 - p * 6;
        const r = (0.4 + p * 2.4) * on;
        k.g(i % 2 ? CELL_ID.streak : CELL_ID.dot, a.pile.x + Math.cos(ang) * r, 0.2 + p * 2.6, a.pile.z + Math.sin(ang) * r * 0.75, i % 2 ? 0.8 : 0.18, -ang, false, FOUR[i % 4], (1 - p) * on, i % 2 ? 0.22 : 0.18);
      }
      k.i(CELL_ID.tornado, a.pile.x, 1.6 + Math.sin(t * 5) * 0.12, a.pile.z, 1.8 * on, Math.sin(t * 7) * 0.25, false, null, on);
    }
    if (since >= 0) paint(k, a, since, 1);
  },
};
