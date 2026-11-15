import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE, PRESETS } from '../../game/content';
import { Game } from '../../game/engine/Game';
import { computeTargets, makeView, type View } from '../layout';
import { crewRect, outside, pickVariant, plan, screenOf, vanRect, VARIANTS, type Run } from './plan';

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

/*
 * The van stops where the whole scene is on the screen: the van with the tallest roof load, the two and the player,
 * at every seat (seats turn round per viewer online, so every seat is someone's side seat), on every screen.
 */
const SCREENS: [number, number, boolean?][] = [
  [1920, 1080], [1366, 768], [1280, 720], [1024, 768], [2560, 1080], [768, 1024], [1024, 1366], [600, 900], [844, 390, true], [667, 375, true], [932, 430, true],
];
const RULES = PRESETS.find(p => p.id === 'party')!.rules;

function table(players: number, seat: number) {
  const g = new Game({ players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, bot: i > 0 })), rules: { ...RULES, events: false }, table: DEFAULT_TABLE });
  g.s.phase = 'play';
  // the viewer sits at `seat` (as online, where every screen has its own seat at the near edge)
  Object.defineProperty(g, 'seat', { value: () => seat });
  return g;
}

// a phone lies on its side: a notch at each side and the home bar at the bottom
const view = (w: number, h: number, phone?: boolean): View => makeView(w, h, phone ? { t: 0, r: 47, b: 21, l: 47 } : undefined);

describe('the knock-out van stays on the screen', () => {
  for (const [w, h, phone] of SCREENS) {
    it(`${w}×${h}: the van, its roof load, the two and the player stay in frame at every seat`, () => {
      const v = view(w, h, phone);
      const S = screenOf(v);
      for (const players of [3, 4, 6, 8]) {
        for (const viewer of [0, 2]) {
          const g = table(players, viewer % players);
          computeTargets(g, v);
          for (let i = 0; i < players; i++) {
            for (const variant of VARIANTS) {
              const r: Run = plan(g, v, i, 0, null, '#000', variant);
              const van = vanRect(S, r);
              const crew = crewRect(S, r);
              const at = `${players} players, viewer ${viewer}, seat ${i}, ${variant}: van ${JSON.stringify(van)} crew ${JSON.stringify(crew)} frame ${JSON.stringify(S.frame)}`;
              expect(outside(S, van), at).toBeLessThan(0.5);
              expect(outside(S, crew), at).toBeLessThan(0.5);
              // it still comes for this player: they stand near their seat
              expect(Math.hypot(r.P[0] - r.C[0], r.P[1] - r.C[1]), at).toBeGreaterThan(1);
            }
          }
        }
      }
    });
  }

  it('plans quickly enough to start without a hitch', () => {
    const v = view(1280, 720);
    const g = table(8, 0);
    computeTargets(g, v);
    const t0 = performance.now();
    for (let i = 1; i < 8; i++) plan(g, v, i, 0, null, '#000', 'stretcher');
    expect((performance.now() - t0) / 7).toBeLessThan(40);
  });
});
