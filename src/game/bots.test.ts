import { describe, expect, it } from 'vitest';
import { BOT_SKILL } from './bot';
import { DEFAULT_TABLE, PRESETS } from './content';
import { Game } from './engine/Game';
import type { BotLevel, Rules } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const rulesOf = (id: string): Rules => ({ ...PRESETS.find(p => p.id === id)!.rules, events: false });

/** A game of bots at `level`, played to the end; checks that no card is lost or doubled on the way. */
function play(level: BotLevel, rules: Rules, players: number, seed: number) {
  const g = new Game(
    { players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, bot: true })), rules, online: true, table: { ...DEFAULT_TABLE, botLevel: level } },
    { rng: seeded(seed) },
  );
  const total = g.totalCards();
  for (let step = 0; step < 3000 && g.s.phase !== 'over'; step++) {
    const before = g.s.log.length;
    g.botAct();
    expect(g.totalCards()).toBe(total);
    // imagined games never leak into the real one
    expect(g.s.log.slice(before).every(l => !['log.wins', 'log.teamWins'].includes(l.k) || g.s.phase === 'over')).toBe(true);
  }
  const ids = new Set([...g.s.deck, ...g.s.discard, ...g.setAside(), ...g.s.players.flatMap(p => p.hand)].map(c => c.id));
  expect(ids.size).toBe(total);
  return g;
}

describe('bot levels', () => {
  it('every level finishes games in every mode', () => {
    for (const level of ['easy', 'normal', 'hard'] as BotLevel[]) {
      for (const mode of ['classic', 'nomercy', 'party']) {
        for (let seed = 1; seed <= (level === 'hard' ? 1 : 20); seed++) {
          expect(play(level, rulesOf(mode), 2 + (seed % 3), seed).s.phase).toBe('over');
        }
      }
    }
  });

  it('a hard bot thinks quickly enough for a phone', () => {
    const t0 = performance.now();
    play('hard', rulesOf('classic'), 3, 7);
    // a whole game of three hard bots, every decision played out many times
    expect(performance.now() - t0).toBeLessThan(15_000);
  });

  it('the autopilot playing for a person is a normal bot whatever the table level', () => {
    let clock = 0;
    const g = new Game(
      { players: [{ name: 'A', bot: false }, { name: 'B', bot: true }], rules: rulesOf('classic'), table: { ...DEFAULT_TABLE, botLevel: 'easy', autopilot: true } },
      { rng: seeded(4), now: () => clock },
    );
    while (g.cp().bot) g.botAct();
    clock += 60_000;
    g.timeoutTurn();
    expect(g.s.log.some(l => l.k === 'log.autopilot')).toBe(true);
  });

  it('easy bots forget UNO more often and catch less than hard ones', () => {
    expect(BOT_SKILL.easy.forgetUno).toBeGreaterThan(BOT_SKILL.normal.forgetUno);
    expect(BOT_SKILL.hard.forgetUno).toBeLessThan(BOT_SKILL.normal.forgetUno);
    expect(BOT_SKILL.hard.noticeUno).toBeGreaterThan(BOT_SKILL.easy.noticeUno);
  });

  it('a saved table without a bot level plays with normal bots', () => {
    const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: rulesOf('classic'), table: { ...DEFAULT_TABLE, botLevel: undefined as never } });
    expect(g.s.table.botLevel).toBe('normal');
  });
});
