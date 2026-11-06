import { CELL_ID, WHEEL_ORDER } from '../atlas';
import type { Motif } from '../kit';
import { burst, easeOut, easeOutBack, fade, flash, ring } from '../shapes';

const STOP = 0.75;

/**
 * Colour roulette: a colour wheel rises over the victim's side of the pile and spins while they pick a colour,
 * then brakes and stops with that colour under the pointer.
 */
export const roulette: Motif = {
  life: STOP + 0.6,
  waits: true,
  frame(k, a, t, since) {
    const v = a.to[0] ?? a.pile;
    // halfway between the pile and the victim, up in the air
    const x = a.pile.x + (v.x - a.pile.x) * 0.35;
    const z = a.pile.z + (v.z - a.pile.z) * 0.35;
    const y = 2.4;
    const rise = easeOutBack(t / 0.35);
    const speed = 11;
    let ang: number;
    if (since < 0) ang = t * speed;
    else {
      // brake from the spin into the picked colour's segment (segment i is centred at -i·90°)
      const at = (since === 0 ? t : t - since) * speed;
      const idx = Math.max(0, WHEEL_ORDER.indexOf(a.colorName ?? 'red'));
      const goal = -idx * (Math.PI / 2);
      const turns = Math.ceil((at - goal) / (Math.PI * 2)) + 1;
      const end = goal + turns * Math.PI * 2;
      // the stop eases out from the speed it had
      ang = at + (end - at) * easeOut(since / STOP);
    }
    const al = since < 0 ? Math.min(1, t * 4) : fade(since, STOP + 0.6, 1, 0.3);
    const size = 2.5 * rise * (since > STOP ? 1 + Math.max(0, 0.2 - (since - STOP)) : 1);
    k.g(CELL_ID.glow, x, y, z, size * 1.9, 0, false, since >= STOP ? a.color : null, 0.5 * al);
    k.i(CELL_ID.wheel, x, y, z, size, -ang, false, null, al);
    k.i(CELL_ID.pointer, x, y + size * 0.55, z, size * 0.32, 0, false, null, al);
    if (since >= STOP) {
      const d = since - STOP;
      ring(k, x, z, d, 0.5, 0.5, 3, a.color, 1, true, 0.05);
      flash(k, x, y, z, d, 0.4, 3.5, a.color, 1);
      burst(k, x, y, z, d, 16, 3, a.color, 0.35, 0.8, a.seed);
    }
  },
};
