import { describe, expect, it } from 'vitest';
import type { Rect } from '../../layout';
import { REACH, placePlanet } from './placement';

/* The planet keeps out from under the HUD and the plates, whatever the screen and whoever sits at the table. */

const W = 1366;
const H = 768;
/** the HUD of a 1366 × 768 screen with three opponents, as measured on the page */
const HUD: Rect[] = [
  { x0: 12, y0: 12, x1: 149, y1: 52 }, // colour pill
  { x0: 12, y0: 66, x1: 313, y1: 150 }, // log
  { x0: 1211, y0: 12, x1: 1354, y1: 56 }, // buttons
  { x0: 603, y0: 36, x1: 764, y1: 104 }, // top plate
  { x0: 56, y0: 195, x1: 216, y1: 260 }, // left plate
  { x0: 1150, y0: 195, x1: 1307, y1: 260 }, // right plate
];

const reach = (p: { x: number; y: number; r: number }): Rect => ({
  x0: p.x - REACH.x * p.r,
  x1: Math.min(W, p.x + REACH.x * p.r),
  y0: Math.max(0, p.y - REACH.y * p.r),
  y1: p.y + REACH.y * p.r,
});
const touches = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

describe('placePlanet', () => {
  it('hangs in the top right, clear of every HUD rectangle and above the table', () => {
    const p = placePlanet(W, H, 84, 175, HUD)!;
    expect(p).not.toBeNull();
    expect(p.x).toBeGreaterThan(W / 2);
    for (const r of HUD) expect(touches(reach(p), r)).toBe(false);
    expect(p.y + REACH.y * p.r).toBeLessThanOrEqual(175);
  });

  it('takes the corner itself when nothing is there', () => {
    const p = placePlanet(W, H, 84, 400, [])!;
    expect(p.r).toBe(84);
    expect(p.x).toBeGreaterThan(W - 20);
    expect(p.y).toBeLessThan(10);
  });

  it('shrinks to fit a crowded top, and stays away when there is no room at all', () => {
    const crowded = [...HUD, { x0: 780, y0: 0, x1: 1210, y1: 60 }];
    const p = placePlanet(W, H, 84, 175, crowded);
    if (p) {
      expect(p.r).toBeLessThan(84);
      for (const r of crowded) expect(touches(reach(p), r)).toBe(false);
    }
    expect(placePlanet(W, H, 84, 175, [{ x0: W / 2 - 100, y0: 0, x1: W, y1: 200 }])).toBeNull();
  });

  it('on a phone: finds the free pocket anywhere on the screen, keeps the planet whole and off the deck', () => {
    const w = 667;
    const h = 375;
    // a crowded phone: plates along the top and the sides, the hand and the dock along the bottom
    const keep: Rect[] = [
      { x0: 0, y0: 0, x1: w, y1: 110 },
      { x0: 0, y0: 190, x1: 110, y1: 268 },
      { x0: 557, y0: 190, x1: w, y1: 268 },
      { x0: 164, y0: 110, x1: 512, y1: h },
      { x0: 0, y0: 322, x1: w, y1: h },
    ];
    const open = (x: number) => x < 140 || x > 530;
    const p = placePlanet(w, h, 45, 60, keep, { l: 0, r: 0, open })!;
    expect(p).not.toBeNull();
    expect(open(p.x)).toBe(true);
    // most of the planet shows (it may hang a little past a side edge)
    expect(p.x - 0.4 * p.r).toBeGreaterThanOrEqual(-0.01);
    expect(p.x + 0.4 * p.r).toBeLessThanOrEqual(w + 0.01);
    const rings: Rect = { x0: Math.max(0, p.x - 2.45 * p.r), x1: Math.min(w, p.x + 2.45 * p.r), y0: p.y - 1.2 * p.r, y1: p.y + 1.2 * p.r };
    for (const r of keep) expect(touches(rings, r)).toBe(false);
    // it stays put while its spot is still clear, even if another would do as well
    expect(placePlanet(w, h, 45, 60, keep, { l: 0, r: 0, open }, p)).toBe(p);
  });
});
