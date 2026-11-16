import { describe, expect, it } from 'vitest';
import { Placer, reservedRects, type HudZones } from './decorKit';
import { makeView, type Rect } from '../layout';

/* Placing props in a phone's free room: clear of everything kept, apart from each other, never on the table. */

const W = 844;
const H = 390;
const view = makeView(W, H);
const touches = (a: Rect, b: Rect) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

describe('Placer', () => {
  const plates: Rect[] = [
    { x0: 8, y0: 6, x1: 121, y1: 34 },
    { x0: 750, y0: 6, x1: 836, y1: 46 },
    { x0: 356, y0: -2, x1: 488, y1: 74 },
    { x0: 14, y0: 60, x1: 155, y1: 136 },
    { x0: 691, y0: 60, x1: 828, y1: 136 },
  ];
  const zones: HudZones = { rects: plates, keep: [...plates, ...reservedRects(view)], view, version: 1 };
  const ball = { r: 1, y: 1, rx: 0.8 };

  it('keeps the hand and the dock corners of a phone on its side', () => {
    const r = reservedRects(view);
    expect(r).toHaveLength(3);
    expect(Math.max(...r.map(q => q.y1))).toBeGreaterThanOrEqual(H);
  });

  it('places props clear of the kept rectangles and of each other, off the table, as big as allowed', () => {
    const P = new Placer(W, H, zones);
    const spots = [-1, 1].flatMap(side => P.strip(side));
    const placed = Array.from({ length: 4 }, () => P.place(spots, ball, { maxPx: 50, minPx: 15, onScreen: 0.9 }));
    expect(placed.every(Boolean)).toBe(true);
    const boxes = placed.map(p => ({ ...P.boxAt(p!.x, ball.y * p!.s, p!.z, ball.r * p!.s, ball.rx * p!.s) }));
    boxes.forEach((b, i) => {
      for (const k of zones.keep) expect(touches(b, k)).toBe(false);
      for (let j = i + 1; j < boxes.length; j++) expect(touches(b, boxes[j])).toBe(false);
      expect((b.y1 - b.y0) / 2).toBeLessThanOrEqual(50.5);
      expect(P.onTable(placed[i]!.x, placed[i]!.z)).toBe(false);
    });
  });

  it('keeps a prop where it was while that spot is still clear', () => {
    const P = new Placer(W, H, zones);
    const spots = P.strip(-1);
    const first = P.place(spots, ball, { maxPx: 40, minPx: 15 })!;
    const again = new Placer(W, H, zones).place([...P.strip(1), ...spots], ball, { maxPx: 40, minPx: 15 }, first);
    expect(again).toBe(first);
  });

  it('gives up when there is no room at all', () => {
    const full: HudZones = { ...zones, keep: [{ x0: -10, y0: -10, x1: W + 10, y1: H + 10 }] };
    const P = new Placer(W, H, full);
    expect(P.place([-1, 1].flatMap(s => P.strip(s)), ball, { maxPx: 40, minPx: 10 })).toBeNull();
  });
});
