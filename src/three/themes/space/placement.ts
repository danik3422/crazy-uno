import type { Rect } from '../../layout';
import { underHud } from '../decorKit';

/**
 * How far the planet system reaches on screen from the planet's centre, in planet radii: the rings and the moon's
 * orbit, tilted as Decor tilts them ([0.38, 0, 0.42]); worked out from the geometry, rounded up.
 */
export const REACH = { x: 3.1, y: 1.45 };

/** A spot on screen for the planet: its centre and radius, CSS pixels. */
export interface PlanetSpot {
  x: number;
  y: number;
  r: number;
}

/** room kept between the planet system and the HUD (px) */
const PAD = 10;
/** the grid the search steps along (px) */
const STEP = 6;
/** the smallest planet worth showing, as a share of the biggest */
const MIN_SHARE = 0.44;

/**
 * Where the ringed planet hangs: in the top-right part of the screen, clear of every HUD rectangle and player plate
 * (the moon's whole orbit included), never lower than `floor` (the far rim of the table, px) and as big as it can be,
 * up to `rMax`, the bigger the better, the nearer the top-right corner the better. It may be cut off a little by the
 * top and right edges, as if hanging just past them. Null when not even a small one fits (it is not drawn then).
 */
export function placePlanet(w: number, h: number, rMax: number, floor: number, hud: Rect[]): PlanetSpot | null {
  const box: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const diag = Math.hypot(w, h);
  let best: PlanetSpot | null = null;
  let bestScore = -Infinity;
  for (let k = 0; ; k++) {
    const r = rMax * (1 - k * 0.07);
    if (r < rMax * MIN_SHARE) break;
    const ex = REACH.x * r;
    const ey = REACH.y * r;
    for (let y = -0.15 * r; y + ey <= floor; y += STEP) {
      // from the right edge leftward, never past the screen's middle third
      for (let x = w + 0.15 * r; x - ex >= w * 0.4; x -= STEP) {
        box.x0 = x - ex;
        box.x1 = Math.min(w, x + ex);
        box.y0 = Math.max(0, y - ey);
        box.y1 = y + ey;
        if (underHud(box, hud, PAD)) continue;
        // a bigger planet wins, unless it hangs much further from the corner
        const score = r * (1 - 0.8 * (Math.hypot(w - x, y) / diag));
        if (score > bestScore) {
          bestScore = score;
          best = { x, y, r };
        }
      }
    }
  }
  return best;
}
