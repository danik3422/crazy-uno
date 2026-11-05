import { describe, expect, it } from 'vitest';
import { pickVariant, VARIANTS } from './plan';

describe('knock-out van scene', () => {
  it('picks the way a player is taken from the game alone, so every screen picks the same', () => {
    expect(pickVariant(3, 2, 1)).toBe(pickVariant(3, 2, 1));
  });

  it('uses all six ways across a few knock-outs', () => {
    const seen = new Set<string>();
    for (let round = 1; round <= 6; round++) for (let seat = 0; seat < 6; seat++) for (let order = 1; order <= 3; order++) seen.add(pickVariant(round, seat, order));
    expect(seen.size).toBe(VARIANTS.length);
  });
});
