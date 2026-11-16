import { describe, expect, it } from 'vitest';
import { MIN_SLOT, pickSlot, slotEdges } from './touchSlots';

const widths = (e: number[]) => e.slice(1).map((x, i) => x - e[i]);

/** a fan of n cards, `step` px apart, each card `card` px wide, starting at x */
const fan = (n: number, step: number, card = 70, x = 170) => [...Array.from({ length: n }, (_, i) => x + i * step), x + (n - 1) * step + card];

describe('touch strips along the hand', () => {
  it('a roomy hand keeps the strips where its cards show', () => {
    const nat = fan(7, 40);
    expect(slotEdges(nat, MIN_SLOT, 0, 667)).toEqual(nat);
  });

  it('a crowded hand gives every card at least a fingertip, centred on the hand', () => {
    const nat = fan(15, 18.6);
    const e = slotEdges(nat, MIN_SLOT, 4, 663);
    for (const w of widths(e)) expect(w).toBeGreaterThanOrEqual(MIN_SLOT - 1e-6);
    expect((e[0] + e[e.length - 1]) / 2).toBeCloseTo((nat[0] + nat[nat.length - 1]) / 2, 5);
  });

  it('never leaves the screen: a hand near the edge is slid back, a huge one shares the screen', () => {
    const e = slotEdges(fan(20, 10, 70, 10), MIN_SLOT, 4, 663);
    expect(e[0]).toBeGreaterThanOrEqual(4);
    const huge = slotEdges(fan(40, 5), MIN_SLOT, 4, 663);
    expect(huge[0]).toBeGreaterThanOrEqual(4 - 1e-6);
    expect(huge[huge.length - 1]).toBeLessThanOrEqual(663 + 1e-6);
    for (const w of widths(huge)) expect(w).toBeCloseTo(659 / 40, 5);
  });

  it('a wide card (raised, or the last one) gives width back before the narrow ones get less than a fingertip', () => {
    const nat = [100, 110, 120, 200, 210, 280];
    const e = slotEdges(nat, MIN_SLOT, 0, 1000);
    const w = widths(e);
    expect(Math.min(...w)).toBeGreaterThanOrEqual(MIN_SLOT - 1e-6);
    expect(w[2]).toBeGreaterThan(w[0]);
    expect(e[e.length - 1] - e[0]).toBeCloseTo(180, 5);
  });

  it('picks the strip under the finger, every card in order as it slides', () => {
    const e = slotEdges(fan(25, 6), MIN_SLOT, 4, 663);
    const seen: number[] = [];
    let cur: number | null = null;
    for (let x = e[0] + 1; x < e[e.length - 1]; x += 2) {
      cur = pickSlot(e, x, cur);
      if (seen[seen.length - 1] !== cur) seen.push(cur);
    }
    expect(seen).toEqual(Array.from({ length: 25 }, (_, i) => i));
  });

  it('holds on to the picked card a little past its edge, and lets go further on', () => {
    const e = [0, 30, 60, 90];
    expect(pickSlot(e, 33, 0)).toBe(0);
    expect(pickSlot(e, 33, null)).toBe(1);
    expect(pickSlot(e, 37, 0)).toBe(1);
    expect(pickSlot(e, -50, null)).toBe(0);
    expect(pickSlot(e, 500, null)).toBe(2);
  });
});
