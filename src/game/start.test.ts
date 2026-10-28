import { describe, expect, it } from 'vitest';
import { PRESETS } from './content';
import { Game } from './engine';
import type { CardType, Rules } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const rulesOf = (id: string): Rules => PRESETS.find(p => p.id === id)!.rules;

/** Deals many classic rounds and keeps the first one that opened with each kind of card. */
function openings(rules: Rules, n = 4) {
  const found = new Map<CardType, { g: Game; first: number }>();
  for (let seed = 1; seed <= 600; seed++) {
    const g = new Game({ players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: true })), rules, online: true }, { rng: seeded(seed) });
    const name = /Первым ходит (P\d)/.exec(g.s.log[0])![1];
    const t = g.s.discard[0].type;
    if (!found.has(t)) found.set(t, { g, first: Number(name.slice(1)) });
  }
  return found;
}

describe('the first card ("Первая карта действует")', () => {
  const found = openings({ ...rulesOf('classic'), startAction: true, events: false });

  it('turns up every kind of classic card but a +4', () => {
    expect([...found.keys()].sort()).toEqual(['draw2', 'num', 'rev', 'skip', 'wild']);
  });

  it('Skip: the first player misses the turn', () => {
    const { g, first } = found.get('skip')!;
    expect(g.s.cur).toBe((first + 1) % 4);
    expect(g.s.log.some(l => l.includes('Пропуск'))).toBe(true);
  });

  it('Reverse: the dealer starts and play goes the other way', () => {
    const { g, first } = found.get('rev')!;
    expect(g.s.dir).toBe(-1);
    expect(g.s.cur).toBe((first + 3) % 4);
  });

  it('+2: the first player draws 2 and loses the turn', () => {
    const { g, first } = found.get('draw2')!;
    expect(g.s.cur).toBe(first);
    expect(g.s.pending).toBe(2);
    const before = g.s.players[first].hand.length;
    g.botAct();
    expect(g.s.players[first].hand.length).toBe(before + 2);
    expect(g.s.cur).not.toBe(first);
  });

  it('Wild: the first player picks the colour and then moves', () => {
    const { g, first } = found.get('wild')!;
    expect(g.s.cur).toBe(first);
    expect(g.s.phase).toBe('choose');
    expect(g.s.choice).toMatchObject({ kind: 'color' });
    g.botAct();
    expect(g.s.phase).toBe('play');
    expect(g.s.cur).toBe(first);
    expect(g.s.log.at(-1)).toMatch(/Цвет теперь/);
  });

  it('with the rule off the pile always starts with a number (Classic, as in the 2023 Mattel rules)', () => {
    expect(rulesOf('classic').startAction).toBe(false);
    for (const mode of ['classic', 'party']) {
      const off = openings({ ...rulesOf(mode), events: false });
      expect([...off.keys()]).toEqual(['num']);
    }
  });

  it('games that open with an action card play to the end without losing a card', () => {
    for (const { g } of found.values()) {
      const total = g.totalCards();
      for (let k = 0; k < 3000 && g.s.phase !== 'over'; k++) g.botAct();
      expect(g.s.phase).toBe('over');
      expect(g.totalCards()).toBe(total);
    }
  });
});
