import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE, PRESETS } from '../../game/content';
import { Game } from '../../game/engine/Game';
import type { Card, Color } from '../../game/types';
import { cardsRect, handRoom, makeView, viewSize } from './fit';
import { computeTargets } from './targets';
import type { Target, Vec3 } from './types';

/*
 * Every screen size the game is played on: your hand must lie whole on the screen, clear of the HUD's corner panels,
 * however many cards you hold and however many people sit at the table; so must every opponent's fan.
 */

const SCREENS: [number, number][] = [
  [1920, 1080], [1366, 768], [1280, 1024], [1024, 768], [2560, 1440], [2560, 1080], [3440, 1440],
  [768, 1024], [1024, 1366], [1180, 820], [600, 900], [844, 390], [667, 375], [932, 430], [740, 360],
];
const RULES = PRESETS.find(p => p.id === 'party')!.rules;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

let nextId = 90_000;
const filler = (): Card => ({ id: nextId++, type: 'num', color: 'green', value: 3 });

/** A local table with you at seat 0 and `bots` bots, your hand grown to `cards` cards. */
function table(bots: number, cards: number, myTurn: boolean) {
  const g = new Game(
    { players: [{ name: 'Me', bot: false }, ...Array.from({ length: bots }, (_, i) => ({ name: `Bot ${i}`, bot: true }))], rules: { ...RULES, events: false }, table: DEFAULT_TABLE },
    { rng: seeded(bots * 31 + cards) },
  );
  const me = g.s.players[0];
  while (me.hand.length < cards) me.hand.push(filler());
  me.hand.length = cards;
  g.s.phase = 'play';
  g.s.cur = myTurn ? 0 : 1;
  return g;
}

const inside = (r: { x0: number; y0: number; x1: number; y1: number }, w: number, h: number) =>
  r.x0 >= -0.5 && r.y0 >= -0.5 && r.x1 <= w + 0.5 && r.y1 <= h + 0.5;

describe('the table fits the screen', () => {
  for (const [w, h] of SCREENS) {
    it(`${w}×${h}: your hand and every fan stay whole on screen and clear of the HUD`, () => {
      const v = makeView(w, h);
      const { w: vw, h: vh } = viewSize(v);
      const room = handRoom(v);
      for (const bots of [1, 3, 5, 7]) {
        for (const cards of [1, 7, 14, 24, 36]) {
          for (const myTurn of [false, true]) {
            const g = table(bots, cards, myTurn);
            const ts = computeTargets(g, v);
            const hand: Target[] = g.s.players[0].hand.map(c => ts.get(c.id)!);
            const r = cardsRect(v, hand);
            const at = `${bots} bots, ${cards} cards, ${myTurn ? 'my turn' : 'waiting'}: ${JSON.stringify(r)} room ${JSON.stringify(room)}`;
            expect(inside(r, vw, vh), at).toBe(true);
            expect(r.y1, at).toBeLessThanOrEqual(room.bottom + 1);
            expect(r.x0, at).toBeGreaterThanOrEqual(room.x0 - 1);
            expect(r.x1, at).toBeLessThanOrEqual(room.x1 + 1);
            // the hand never reaches the pile (the top card's middle stays in view)
            const top = g.s.discard[g.s.discard.length - 1];
            const pile = cardsRect(v, [{ ...ts.get(top.id)!, scale: 0.01 }]);
            expect(pile.y1, `pile, ${at}`).toBeLessThan(r.y0);
            // the deck (its top cards and the stack under them) lies whole on screen, clear of the hand
            const deck = [...ts.values()].filter(t => t.zone === 'deck' && !t.hidden);
            const dr = cardsRect(v, [...deck, ...deck.map(t => ({ ...t, pos: [t.pos[0], 0, t.pos[2]] as Vec3 }))]);
            expect(inside(dr, vw, vh), `deck ${JSON.stringify(dr)}, ${at}`).toBe(true);
            expect(dr.y1 < r.y0 || dr.x1 < r.x0 || dr.x0 > r.x1, `deck ${JSON.stringify(dr)} over the hand, ${at}`).toBe(true);
            for (let i = 1; i <= bots; i++) {
              const fan0 = cardsRect(v, g.s.players[i].hand.map(c => ts.get(c.id)!));
              // bounding boxes of tilted cards: a crowded table may let their corners touch, never more
              const ox = Math.max(0, Math.min(dr.x1, fan0.x1) - Math.max(dr.x0, fan0.x0));
              const oy = Math.max(0, Math.min(dr.y1, fan0.y1) - Math.max(dr.y0, fan0.y0));
              const clear = ox * oy <= 0.01 * (dr.x1 - dr.x0) * (dr.y1 - dr.y0);
              expect(clear, `deck ${JSON.stringify(dr)} over seat ${i} ${JSON.stringify(fan0)}, ${at}`).toBe(true);
            }
            for (let i = 1; i <= bots; i++) {
              const fan = cardsRect(v, g.s.players[i].hand.map(c => ts.get(c.id)!));
              expect(inside(fan, vw, vh), `seat ${i}, ${at}: ${JSON.stringify(fan)}`).toBe(true);
              // nor any opponent's fan
              const apart = fan.y1 < r.y0 || fan.x1 < r.x0 || fan.x0 > r.x1;
              expect(apart, `seat ${i} fan ${JSON.stringify(fan)} over the hand, ${at}`).toBe(true);
            }
          }
        }
      }
    });
  }

  it('the card you drew and can play is held up whole on screen', () => {
    for (const [w, h] of SCREENS) {
      const v = makeView(w, h);
      const { w: vw, h: vh } = viewSize(v);
      const g = table(3, 8, true);
      const s = g.s;
      const top = s.discard[s.discard.length - 1];
      const color: Color = top.color === 'wild' ? 'red' : top.color;
      const drawn: Card = { id: nextId++, type: 'num', color, value: 9 };
      s.color = color;
      s.players[0].hand.push(drawn);
      s.drawn = true;
      s.lastDrawn = drawn.id;
      const t = computeTargets(g, v).get(drawn.id)!;
      expect(t.held, `${w}×${h}`).toBe(true);
      expect(inside(cardsRect(v, [t], 1.15), vw, vh), `${w}×${h}: ${JSON.stringify(cardsRect(v, [t], 1.15))}`).toBe(true);
    }
  });
});
