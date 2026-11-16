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

/** How a phone on its side searches: the whole width, below the rim too, the rings (not the moon's orbit) kept clear. */
export interface PhoneSearch {
  /** the planet's centre must stay this far inside the safe area (px): left, right */
  l: number;
  r: number;
  /** may the planet's middle hang over this pixel (false: over the station deck, where it would read as lying on the table) */
  open: (x: number, y: number) => boolean;
}
/** the rings alone, tilted as Decor tilts them (the moon may pass behind a plate now and then on a phone) */
const RINGS = { x: 2.45, y: 1.2 };
/** a phone may show a smaller planet than a computer screen before giving up on it */
const MIN_SHARE_PHONE = 0.25;
/** a phone's planet keeps its middle this many radii in from a side edge (most of it shows) */
const EDGE_IN = 0.4;
/** a phone's room is tight: a smaller gap to the HUD (px) */
const PAD_PHONE = 4;

/**
 * Where the ringed planet hangs: in the top-right part of the screen, clear of every HUD rectangle and player plate
 * (the moon's whole orbit included), never lower than `floor` (the far rim of the table, px) and as big as it can be,
 * up to `rMax`, the bigger the better, the nearer the top-right corner the better. It may be cut off a little by the
 * top and right edges, as if hanging just past them. Null when not even a small one fits (it is not drawn then).
 *
 * A phone on its side (`phone`) has no such corner free: there the planet may hang anywhere across the screen, the
 * side strips below the rim included, its rings clear of everything and partly past an edge, nearest a top corner.
 */
export function placePlanet(w: number, h: number, rMax: number, floor: number, hud: Rect[], phone?: PhoneSearch, prev?: PlanetSpot | null): PlanetSpot | null {
  const box: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
  const diag = Math.hypot(w, h);
  const reach = phone ? RINGS : REACH;
  const bottom = phone ? h : floor;
  let best: PlanetSpot | null = null;
  let bestScore = -Infinity;
  for (let k = 0; ; k++) {
    const r = rMax * (1 - k * 0.07);
    if (r < rMax * (phone ? MIN_SHARE_PHONE : MIN_SHARE)) break;
    const ex = reach.x * r;
    const ey = reach.y * r;
    // on a phone the planet may hang a little past a side edge, as if drifting in (its rings well past it)
    const x0 = phone ? phone.l + EDGE_IN * r : w * 0.4 + ex;
    for (let y = phone ? r : -0.15 * r; y + (phone ? r : ey) <= bottom; y += STEP) {
      // from the right edge leftward (a computer screen: never past the screen's middle third)
      for (let x = phone ? w - phone.r - EDGE_IN * r : w + 0.15 * r; x >= x0; x -= STEP) {
        box.x0 = Math.max(0, x - ex);
        box.x1 = Math.min(w, x + ex);
        box.y0 = Math.max(0, y - ey);
        box.y1 = Math.min(h, y + ey);
        if (underHud(box, hud, phone ? PAD_PHONE : PAD)) continue;
        if (phone && !phone.open(x, y)) continue;
        // a bigger planet wins, unless it hangs much further from the corner (on a phone: either top corner)
        const far = phone ? Math.min(Math.hypot(w - x, y), Math.hypot(x, y)) : Math.hypot(w - x, y);
        // (a phone has so little room that size counts for more than the corner)
        const score = r * (1 - (phone ? 0.3 : 0.8) * (far / diag));
        if (score > bestScore) {
          bestScore = score;
          best = { x, y, r };
        }
      }
    }
  }
  // a phone keeps its planet where it is while that spot stays clear and nearly as good: it should not wander
  // round the screen every time a card comes to rest
  if (phone && prev && best && prev.r >= best.r * 0.8) {
    const ex = RINGS.x * prev.r;
    const ey = RINGS.y * prev.r;
    box.x0 = Math.max(0, prev.x - ex);
    box.x1 = Math.min(w, prev.x + ex);
    box.y0 = Math.max(0, prev.y - ey);
    box.y1 = Math.min(h, prev.y + ey);
    if (!underHud(box, hud, 0)) return prev;
  }
  return best;
}
