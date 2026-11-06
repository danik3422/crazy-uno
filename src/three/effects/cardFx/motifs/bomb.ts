import { CELL_ID } from '../atlas';
import type { Motif } from '../kit';
import { GOLD, arc, easeOutBack, fade, flash, ring } from '../shapes';

const FLY = 0.55;
const LIFE = 1.6;

/** Bomb: a lit bomb is lobbed at the next player and sits there ticking, its fuse spitting sparks. */
export const bomb: Motif = {
  life: LIFE,
  frame(k, a, t) {
    const v = a.to[0];
    if (!v) return;
    let x: number, y: number, z: number, s: number, rot: number;
    if (t < FLY) {
      const q = arc({ x: a.pile.x, y: 1.2, z: a.pile.z }, { x: v.x, y: 0.9, z: v.z }, t / FLY, 2);
      x = q.x; y = q.y; z = q.z; s = 1; rot = t * 9;
    } else {
      const d = t - FLY;
      // lands with a bounce, then swells with every tick
      x = v.x; z = v.z;
      y = 0.9 + Math.abs(Math.sin(d * 9)) * 0.3 * Math.exp(-d * 4);
      s = easeOutBack(d / 0.2, 3) * (1 + Math.max(0, Math.sin(d * 14)) * 0.12);
      rot = Math.sin(d * 20) * 0.15;
      const pulse = 0.5 + 0.5 * Math.sin(d * 14);
      ring(k, v.x, v.z, d % 0.35, 0.35, 0.3, 1.4, a.color, 0.7);
      k.s(CELL_ID.glow, v.x, 0.02, v.z, 2.8, 0, true, a.color, 0.45 * pulse * fade(d, LIFE - FLY, 0.05, 0.3));
    }
    const al = fade(t, LIFE, 0.05, 0.3);
    k.i(CELL_ID.bomb, x, y, z, 1.7 * s, rot, false, null, al);
    // the fuse: sparks spitting from the top right
    const fx = x + 0.45 * s;
    const fy = y + 0.58 * s;
    for (let i = 0; i < (k.lite ? 2 : 4); i++) {
      const p = (t * 4 + i / 4) % 1;
      k.g(CELL_ID.spark, fx + Math.sin(i * 7 + t * 30) * p * 0.3, fy + p * 0.35, z, 0.5 * (1 - p), t * 20 + i, false, GOLD, al * (1 - p));
    }
    flash(k, fx, fy, z, (t * 6) % 1, 1, 0.8, GOLD, al);
  },
};
