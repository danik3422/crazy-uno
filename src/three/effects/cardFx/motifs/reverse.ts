import { CELL_ID } from '../atlas';
import type { Active, Kit, Motif } from '../kit';
import { WHITE, burst, easeInOut, easeOutBack, fade, flash, hump, ring } from '../shapes';
import { RING_R, RING_Z } from '../../../layout';

const LIFE = 1.25;

/**
 * Arrows race around the pile the old way, brake, and whirl back the new way.
 * Shared with the wild reverse +4 and a mirror that bounces nothing.
 */
export function whirl(k: Kit, a: Active, t: number, life = LIFE) {
  if (t < 0 || t > life) return;
  const al = fade(t, life, 0.1, 0.3);
  const n = k.lite ? 6 : 8;
  // turned angle: forward the old way, then a hard turn the new way
  const turn = t < 0.45 ? -a.dir * easeInOut(t / 0.45) * 2.2 : -a.dir * 2.2 + a.dir * easeInOut((t - 0.45) / (life - 0.45)) * 7.5;
  const flip = t < 0.45 ? -a.dir : a.dir;
  const r = RING_R * (0.55 + 0.35 * easeOutBack(t / 0.35));
  for (let i = 0; i < n; i++) {
    const ang = turn + (i / n) * Math.PI * 2;
    const x = a.pile.x + Math.cos(ang) * r;
    const z = a.pile.z + Math.sin(ang) * r * RING_Z;
    // each arrow points along the circle, in the direction it travels
    const rot = -ang + (flip > 0 ? -Math.PI / 2 : Math.PI / 2);
    k.s(CELL_ID.arrow, x, 0.03, z, 1.3, rot, true, i % 2 ? a.color : WHITE, al, flip > 0 ? 1.3 : -1.3);
    k.g(CELL_ID.streak, x, 0.06, z, 1.6, rot + Math.PI / 2 * flip, true, a.color, al * 0.5, 0.4);
  }
  // the turning moment: a flash and a ring
  ring(k, a.pile.x, a.pile.z, t - 0.42, 0.55, 1, RING_R * 1.3, a.color, 0.9, true);
  flash(k, a.pile.x, 0.8, a.pile.z, t - 0.42, 0.4, 4, a.color, 0.8);
}

/** Reverse: the arrows whirl, the badge spins over the pile and flips like a coin. */
export const reverse: Motif = {
  life: LIFE,
  frame(k, a, t) {
    whirl(k, a, t);
    const al = fade(t, LIFE, 0.08, 0.3);
    const flipK = Math.cos(Math.PI * easeInOut((t - 0.3) / 0.35));
    k.badge(a.tex, a.pile.x, 1.7 + hump(t / LIFE) * 0.3, a.pile.z, 1.9 * easeOutBack(t / 0.3) * Math.max(0.12, Math.abs(flipK)), t * a.dir * -4, al);
    burst(k, a.pile.x, 1.5, a.pile.z, t - 0.45, 10, 2.6, a.color, 0.3, 0.6, a.seed);
  },
};
