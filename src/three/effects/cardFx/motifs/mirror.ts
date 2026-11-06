import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { WHITE, arc, burst, easeOutBack, fade, flash, ring } from '../shapes';
import { whirl } from './reverse';

const LIFE = 1.4;

/**
 * Mirror: glass shards glint around the badge. With a penalty waiting, a beam of light hits the mirror
 * and bounces off to the new victim; without one it turns play around like a reverse.
 */
export const mirror: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const al = fade(t, LIFE, 0.06, 0.3);
    k.badge(a.tex, a.pile.x, 1.8, a.pile.z, 1.8 * easeOutBack(t / 0.3), Math.sin(t * 3) * 0.1, al);
    const n = k.lite ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const ang = t * 2 + (i / n) * Math.PI * 2;
      const r = 1.4 + Math.sin(t * 3 + i) * 0.2;
      const glint = 0.5 + 0.5 * Math.sin(t * 9 + i * 2);
      k.g(CELL_ID.shard, a.pile.x + Math.cos(ang) * r, 1.8 + Math.sin(ang) * r * 0.5, a.pile.z + 0.3, 0.45, t * 3 + i, false, WHITE, al * (0.4 + glint * 0.6));
    }
    if (!a.flag) {
      whirl(k, a, t);
      return;
    }
    // the beam: into the mirror from the one who sent the penalty, then off to the new victim
    const v = a.to[0];
    if (!v) return;
    const src = a.from;
    const inP = t / 0.3;
    if (inP < 1) {
      const q = arc({ x: src.x, y: 1.2, z: src.z }, { x: a.pile.x, y: 1.8, z: a.pile.z }, inP, 0.3);
      k.g(CELL_ID.glow, q.x, q.y, q.z, 1.2, 0, false, a.color, 1);
      k.g(CELL_ID.spark, q.x, q.y, q.z, 0.8, t * 10, false, WHITE, 1);
    }
    flash(k, a.pile.x, 1.8, a.pile.z, t - 0.3, 0.4, 4, WHITE, 1);
    const outP = (t - 0.3) / 0.35;
    if (outP >= 0 && outP < 1) {
      const q = arc({ x: a.pile.x, y: 1.8, z: a.pile.z }, { x: v.x, y: 0.9, z: v.z }, outP, 0.4);
      k.g(CELL_ID.glow, q.x, q.y, q.z, 1.4, 0, false, a.color, 1);
      k.g(CELL_ID.spark, q.x, q.y, q.z, 1, t * 10, false, WHITE, 1);
    }
    const d = t - 0.65;
    ring(k, v.x, v.z, d, 0.5, 0.3, 2, a.color, 1, true);
    burst(k, v.x, 0.9, v.z, d, 14, 2.8, WHITE, 0.3, 0.6, a.seed);
  },
};
