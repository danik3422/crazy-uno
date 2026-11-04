import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, PRESETS } from './content';
import { Game, type GameSave } from './engine';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe('saving a local game and picking it up again', () => {
  it('carries on from a save with every card in place, to the end of the round', () => {
    for (const rules of [DEFAULT_RULES, PRESETS.find(p => p.id === 'nomercy')!.rules]) {
      for (let seed = 1; seed <= 20; seed++) {
        let clock = 1_000_000;
        const now = () => clock;
        const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...rules, events: false } }, { rng: seeded(seed), now });
        const total = g.totalCards();
        for (let i = 0; i < 25 && g.s.phase !== 'over'; i++) g.botAct();
        if (g.s.phase === 'over') continue;
        // written to the device and read back, as the app does
        const save = JSON.parse(JSON.stringify(g.toSave())) as GameSave;
        clock += 10 * 60_000; // the page was closed for ten minutes
        const back = Game.resume(save, { rng: seeded(seed + 99), now });
        expect(back.resumed).toBe(true);
        expect(back.totalCards()).toBe(total);
        expect(back.s.cur).toBe(g.s.cur);
        expect(back.s.players.map(p => p.hand.length)).toEqual(g.s.players.map(p => p.hand.length));
        // the turn clock did not run out while the page was closed
        if (back.s.turnDeadline !== null) expect(back.s.turnDeadline).toBeGreaterThan(clock);
        for (let i = 0; i < 3000 && back.s.phase !== 'over'; i++) back.botAct();
        expect(back.s.phase).toBe('over');
        expect(back.totalCards()).toBe(total);
      }
    }
  });

  it('does not replay the effects that were already shown', () => {
    const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: DEFAULT_RULES }, { rng: seeded(3) });
    for (let i = 0; i < 15 && g.s.phase !== 'over'; i++) g.botAct();
    const back = Game.resume(JSON.parse(JSON.stringify(g.toSave())));
    const last = back.s.fx.reduce((m, f) => Math.max(m, f.id), 0);
    expect(back.fxBaseline).toBe(last);
  });
});
