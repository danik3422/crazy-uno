import { describe, expect, it } from 'vitest';
import { MERCY_LIMIT, PRESETS } from './content';
import { buildDeck } from './deck';
import { Game } from './engine';
import { canPlayCard } from './rules';
import type { Card, CardType, Color } from './types';

const NO_MERCY = PRESETS.find(p => p.id === 'nomercy')!.rules;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function game(players = 3, seed = 1) {
  return new Game(
    { players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, bot: true })), rules: NO_MERCY, online: true },
    { rng: seeded(seed) },
  );
}

let nextId = 10_000;
const card = (type: CardType, color: Card['color'] = 'red', value?: number): Card => ({ id: nextId++, type, color, value });

/** Puts `c` in the current player's hand and plays it. */
function play(g: Game, c: Card) {
  g.cp().hand.push(c);
  expect(g.play(c.id)).toBe(true);
}

describe('No Mercy deck', () => {
  it('has the 168 cards of UNO Show ’Em No Mercy', () => {
    const deck = buildDeck(NO_MERCY);
    expect(deck).toHaveLength(168);
    const count = (t: CardType) => deck.filter(c => c.type === t).length;
    expect(count('num')).toBe(80);
    expect([count('skip'), count('rev'), count('draw2'), count('discardAll')]).toEqual([12, 12, 12, 12]);
    expect([count('draw4'), count('skipAll')]).toEqual([8, 8]);
    expect([count('wildRev4'), count('wild6'), count('wild10'), count('roulette')]).toEqual([8, 4, 4, 8]);
    expect(count('wild') + count('wild4')).toBe(0);
  });
});

describe('No Mercy stacking', () => {
  it('only takes a draw card at least as big as the last one', () => {
    const g = game();
    g.s.pending = 4;
    g.s.pendingLast = 4;
    expect(canPlayCard(g.s, card('draw2', g.s.color))).toBe(false);
    expect(canPlayCard(g.s, card('draw4', 'blue'))).toBe(true);
    expect(canPlayCard(g.s, card('wild10', 'wild'))).toBe(true);
    expect(canPlayCard(g.s, card('num', g.s.color, 3))).toBe(false);
  });

  it('adds up the stack and the one who cannot answer takes it all', () => {
    const g = game();
    const first = g.s.cur;
    play(g, card('draw2', g.s.color));
    play(g, card('draw4', 'blue'));
    expect(g.s.pending).toBe(6);
    expect(g.s.pendingLast).toBe(4);
    const victim = g.s.cur;
    const before = g.s.players[victim].hand.length;
    g.draw();
    expect(g.s.players[victim].hand.length).toBe(before + 6);
    expect(g.s.cur).not.toBe(victim);
    expect(first).not.toBe(victim);
  });
});

describe('No Mercy cards', () => {
  it('Skip Everyone gives the same player another turn', () => {
    const g = game(4);
    const me = g.s.cur;
    play(g, card('skipAll', g.s.color));
    expect(g.s.cur).toBe(me);
  });

  it('Discard All drops every card of its colour', () => {
    const g = game();
    const me = g.cp();
    const col = g.s.color as Color;
    me.hand.push(card('num', col, 1), card('num', col, 2));
    const keep = me.hand.filter(c => c.color !== col).length;
    play(g, card('discardAll', col));
    expect(me.hand.filter(c => c.color === col)).toHaveLength(0);
    expect(me.hand).toHaveLength(keep);
  });

  it('Wild Reverse +4 turns the table round and the new next player faces +4', () => {
    const g = game(4);
    const me = g.s.cur;
    const dir = g.s.dir;
    play(g, card('wildRev4', 'wild'));
    g.resolveChoice('green');
    expect(g.s.dir).toBe(-dir);
    expect(g.s.cur).toBe((me - dir + 4) % 4);
    expect(g.s.pending).toBe(4);
  });

  it('Wild Reverse +4 with two players: it skips the other player and the one who played it faces +4 (official rule)', () => {
    const g = game(2);
    const me = g.s.cur;
    play(g, card('wildRev4', 'wild'));
    g.resolveChoice('green');
    expect(g.s.cur).toBe(me);
    expect(g.s.pending).toBe(4);
    // they may stack it back at the other player
    play(g, card('wild6', 'wild'));
    g.resolveChoice('red');
    expect(g.s.cur).not.toBe(me);
    expect(g.s.pending).toBe(10);
  });

  it('a Reverse with two players left (the rest knocked out) works like a skip', () => {
    const g = game(3);
    const me = g.s.cur;
    const other = g.nextIdx();
    const third = g.nextIdx(other);
    // the third player is out of the game
    g.s.players[third].out = 1;
    g.s.deck.unshift(...g.s.players[third].hand);
    g.s.players[third].hand = [];
    play(g, card('rev', g.s.color));
    expect(g.s.cur).toBe(me);
  });

  it('Colour Roulette: the next player names a colour and draws until it comes up', () => {
    const g = game(3);
    play(g, card('roulette', 'wild'));
    const victim = g.s.cur;
    expect(g.s.phase).toBe('choose');
    expect(g.s.choice).toMatchObject({ kind: 'color', mode: 'roulette' });
    const before = g.s.players[victim].hand.length;
    g.resolveChoice('blue');
    const hand = g.s.players[victim].hand;
    expect(hand.length).toBeGreaterThan(before);
    // the last card drawn is the colour they asked for (unless the mercy rule stopped them first)
    if (!g.s.players[victim].out) expect(hand[hand.length - 1].color).toBe('blue');
    expect(g.s.cur).not.toBe(victim);
  });

  it('drawing goes on until a card can be played, and that card has to be played', () => {
    const g = game();
    const me = g.cp();
    me.hand = [card('num', g.s.color === 'red' ? 'blue' : 'red', 9)];
    g.s.discard.push(card('num', g.s.color, 1));
    g.draw();
    if (g.cp() === me) {
      expect(me.hand.some(c => g.playable(c))).toBe(true);
      g.pass();
      expect(g.cp()).toBe(me); // no passing in No Mercy
    }
  });
});

describe('mercy rule', () => {
  it(`knocks out a player with ${MERCY_LIMIT} cards and skips them from then on`, () => {
    const g = game(3);
    const total = g.totalCards();
    const victim = g.nextIdx();
    play(g, card('wild10', 'wild'));
    g.resolveChoice('red');
    g.s.players[victim].hand.push(...g.s.deck.splice(0, MERCY_LIMIT - 10 - g.s.players[victim].hand.length));
    const deckBefore = g.s.deck.length;
    g.draw();
    expect(g.s.players[victim].out).toBe(1);
    expect(g.s.players[victim].hand).toHaveLength(0);
    expect(g.s.log.some(l => l.includes('выбывает'))).toBe(true);
    // their cards are set aside, not back in the deck: nothing lost (the test added one card of its own, the +10)
    expect(g.s.deck.length).toBe(deckBefore - 10);
    expect(g.totalCards()).toBe(total + 1);
    for (let i = 0; i < 6; i++) {
      expect(g.s.cur).not.toBe(victim);
      g.s.phase = 'play';
      g.pass();
      g.s.drawn = true;
      g.pass();
    }
  });

  it('the set-aside hand comes back only when the deck runs out and is reshuffled', () => {
    const g = game(3);
    const victim = g.nextIdx();
    const p = g.s.players[victim];
    p.hand.push(...g.s.deck.splice(0, MERCY_LIMIT - p.hand.length - 1));
    play(g, card('draw2', g.s.color));
    g.draw();
    expect(p.out).toBe(1);
    const aside = g.setAside().length;
    expect(aside).toBeGreaterThanOrEqual(MERCY_LIMIT);
    // empty the deck: the next card drawn reshuffles the pile together with the set-aside hand
    g.s.discard.push(...g.s.deck.splice(0));
    const total = g.totalCards();
    g.s.phase = 'play';
    g.s.drawn = false;
    g.s.pending = 0;
    g.draw();
    expect(g.totalCards()).toBe(total);
    expect(g.setAside()).toHaveLength(0);
    expect(g.s.deck.length).toBeGreaterThanOrEqual(aside - 1);
  });

  it('the last player standing wins', () => {
    const g = game(2);
    const me = g.s.cur;
    const other = g.nextIdx();
    g.s.players[other].hand.push(...g.s.deck.splice(0, MERCY_LIMIT));
    play(g, card('num', g.s.color, 5));
    expect(g.s.phase).toBe('over');
    expect(g.s.winner).toBe(me);
    expect(g.s.loser).toBe(other);
  });
});

describe('No Mercy games with bots', () => {
  it('always finish, never lose a card, and never let a knocked-out player move', () => {
    for (let seed = 1; seed <= 150; seed++) {
      const g = game(2 + (seed % 5), seed);
      const total = g.totalCards();
      for (let step = 0; step < 4000 && g.s.phase !== 'over'; step++) {
        expect(g.cp().out).toBeFalsy();
        g.botAct();
        expect(g.totalCards()).toBe(total);
        for (const p of g.s.players) if (p.out) expect(p.hand).toHaveLength(0);
      }
      expect(g.s.phase).toBe('over');
      expect(g.s.players[g.s.winner!].out).toBeFalsy();
    }
  });
});
