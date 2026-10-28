import { describe, expect, it } from 'vitest';
import { botDecision, countColors } from './bot';
import { DEFAULT_RULES, PRESETS } from './content';
import { buildDeck } from './deck';
import { Game } from './engine';
import { canPlayCard, isCatchable, nextSeat, playableCard } from './rules';
import type { Card, Table } from './types';

const classic = PRESETS.find(p => p.id === 'classic')!.rules;
const card = (c: Partial<Card>): Card => ({ id: 999, color: 'red', type: 'num', value: 1, ...c });

function game(players = 3, table: Partial<Table> = {}) {
  return new Game({
    players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, bot: i > 0 })),
    rules: DEFAULT_RULES,
    online: true,
    table: table as Table,
  });
}

describe('deck', () => {
  it('has the 108 classic cards without crazy cards and dares', () => {
    expect(buildDeck(classic)).toHaveLength(108);
  });

  it('adds 5 crazy cards and a dare per colour, plus 4 wild crazy cards', () => {
    expect(buildDeck({ ...classic, crazy: true, dares: true })).toHaveLength(108 + 4 * 6 + 4);
  });
});

describe('Classic is the official UNO', () => {
  it('has no stacking, no 7-0, no extras; +4 can be challenged and you draw one card', () => {
    expect(classic).toMatchObject({ stack: false, sevenZero: false, crazy: false, dares: false, events: false, punish: false, drawPlay: false, noMercy: false, uno: true, challenge: true });
  });

  it('a +2 cannot be answered with a +2', () => {
    const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: classic, online: true });
    g.s.discard.push(card({ color: 'red', type: 'draw2', value: undefined }));
    g.s.color = 'red';
    g.s.pending = 2;
    g.s.pendingType = 'draw2';
    expect(canPlayCard(g.s, card({ color: 'blue', type: 'draw2', value: undefined }))).toBe(false);
    expect(canPlayCard(g.s, card({ color: 'wild', type: 'wild4', value: undefined }))).toBe(false);
  });

  it('a +4 laid while holding a plain Wild is a bluff that can be caught (official rule)', () => {
    for (const [other, guilty] of [[card({ id: 9101, color: 'wild', type: 'wild', value: undefined }), true], [card({ id: 9102, color: 'wild', type: 'wild4', value: undefined }), false]] as const) {
      const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: classic, online: true });
      const p = g.cp();
      // nothing of the colour in play, only the other wild card
      p.hand = [card({ id: 9100, color: 'wild', type: 'wild4', value: undefined }), other, card({ id: 9103, color: g.s.color === 'red' ? 'blue' : 'red', value: 3 })];
      g.s.pending = 0;
      g.s.drawn = false;
      g.play(9100);
      g.resolveChoice('green');
      expect(g.s.challenge?.guilty).toBe(guilty);
    }
  });
});

describe('matching', () => {
  it('plays on the same colour, the same number or a wild card', () => {
    const g = game();
    g.s.discard = [card({ color: 'red', value: 5 })];
    g.s.color = 'red';
    g.s.pending = 0;
    expect(canPlayCard(g.s, card({ color: 'red', value: 2 }))).toBe(true);
    expect(canPlayCard(g.s, card({ color: 'blue', value: 5 }))).toBe(true);
    expect(canPlayCard(g.s, card({ color: 'wild', type: 'wild', value: undefined }))).toBe(true);
    expect(canPlayCard(g.s, card({ color: 'blue', value: 2 }))).toBe(false);
  });

  it('only answers a waiting penalty with a stacking card or a mirror', () => {
    const g = game();
    g.s.discard = [card({ color: 'red', type: 'draw2', value: undefined })];
    g.s.color = 'red';
    g.s.pending = 2;
    g.s.pendingType = 'draw2';
    expect(canPlayCard(g.s, card({ color: 'red', value: 3 }))).toBe(false);
    expect(canPlayCard(g.s, card({ color: 'blue', type: 'draw2', value: undefined }))).toBe(true);
    expect(canPlayCard(g.s, card({ color: 'green', type: 'mirror', value: undefined }))).toBe(true);
    g.s.rules = { ...g.s.rules, stack: false };
    expect(canPlayCard(g.s, card({ color: 'blue', type: 'draw2', value: undefined }))).toBe(false);
  });

  it('after drawing, only the drawn card may be played', () => {
    const g = game();
    g.s.discard = [card({ color: 'red', value: 5 })];
    g.s.color = 'red';
    g.s.pending = 0;
    g.s.drawn = true;
    g.s.lastDrawn = 7;
    expect(playableCard(g.s, card({ id: 7, color: 'red' }))).toBe(true);
    expect(playableCard(g.s, card({ id: 8, color: 'red' }))).toBe(false);
  });
});

describe('seats', () => {
  it('walks around the table in both directions', () => {
    const g = game(4);
    g.s.cur = 0;
    g.s.dir = 1;
    expect(nextSeat(g.s)).toBe(1);
    expect(nextSeat(g.s, 3)).toBe(0);
    g.s.dir = -1;
    expect(nextSeat(g.s)).toBe(3);
    expect(nextSeat(g.s, 0, 2)).toBe(2);
  });
});

describe('UNO catching', () => {
  it('is open only while the victim still holds one card', () => {
    const g = game();
    g.s.players[1].hand = [card({})];
    g.s.unoCatch = { victim: 1, until: g.s.turn + 1, botCatcher: null, botDelay: 0 };
    expect(isCatchable(g.s)).toBe(true);
    g.s.players[1].hand.push(card({ id: 1000 }));
    expect(isCatchable(g.s)).toBe(false);
  });

  it('uses the table penalty in the draw and in the message', () => {
    const g = game(3, { unoPenalty: 4 });
    g.s.players[1].hand = [card({})];
    g.s.unoCatch = { victim: 1, until: g.s.turn + 1, botCatcher: null, botDelay: 0 };
    g.catchUno(2);
    expect(g.s.players[1].hand).toHaveLength(5);
    expect(g.s.log.at(-1)).toContain('+4');
  });
});

describe('bots', () => {
  it('pick the colour they hold most of', () => {
    const g = game();
    g.s.players[g.s.cur].hand = [card({ color: 'blue' }), card({ color: 'blue' }), card({ color: 'green' })];
    expect(countColors(g.s.players[g.s.cur].hand).blue).toBe(2);
    expect(botDecision(g.s, { kind: 'color', title: '' })).toBe('blue');
  });

  it('never swap hands with their partner', () => {
    const g = game(4, { teams: true });
    g.s.cur = 0;
    // the partner (seat 2) has the fewest cards, but an opponent must be picked
    g.s.players[2].hand = [card({})];
    expect(botDecision(g.s, { kind: 'player', title: '', mode: 'swap' })).not.toBe(2);
  });
});

describe('opening message', () => {
  it('names the real hand size', () => {
    expect(game(3, { handSize: 5 }).s.log[0]).toContain('Раздали по 5');
  });
});
