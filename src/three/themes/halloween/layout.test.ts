import { describe, expect, it } from 'vitest';
import { fitToHud, fitToScreen, layout, type Sizes } from './layout';

/* The graveyard steps out from under the HUD: here the "screen" is the table itself, x/z in table units. */

const S: Sizes = { pumpkin: { r: 0.7, y: 0.46 }, tomb: { r: 0.8, y: 0.6 }, cross: { r: 0.8, y: 0.7 }, ghost: { r: 0.5, y: 0.5 } };
const halfWidth = () => 12;

describe('halloween fitToHud', () => {
  it('keeps everything when nothing is in the way', () => {
    const L = fitToScreen(layout(false, false), halfWidth);
    const F = fitToHud(L, halfWidth, S, () => true);
    expect(F.pumpkins).toHaveLength(L.pumpkins.length);
    expect(F.tombs).toHaveLength(L.tombs.length);
    expect(F.candles).toHaveLength(L.candles.length);
    expect(F.ghosts).toEqual(L.ghosts);
  });

  it('moves a ghost out from under a HUD box, or lets it go, and drops what stays under it', () => {
    const L = fitToScreen(layout(false, false), halfWidth);
    // a "log" over the far left corner of the table
    const clear = (x: number, _y: number, z: number, r: number) => !(x - r < -6 && z - r < -6);
    const F = fitToHud(L, halfWidth, S, clear);
    for (const g of F.ghosts) expect(clear(g.x, g.y, g.z, S.ghost.r + 0.75)).toBe(true);
    for (const t of F.tombs) expect(clear(t.x, 0, t.z, S.tomb.r * t.s)).toBe(true);
    // the right side is untouched
    expect(F.tombs.filter(t => t.x > 0)).toEqual(L.tombs.filter(t => t.x > 0));
    expect(F.pumpkins.filter(p => p.x > 0)).toEqual(L.pumpkins.filter(p => p.x > 0));
  });
});
