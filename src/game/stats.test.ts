import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, addRound, cleanStats, emptyStats, unlockNew } from './stats';

const round = (won: boolean, extra = {}) => ({ won, turns: 20, mode: 'party' as const, theme: 'classic', online: false, teams: false, maxHand: 7, ...extra });

describe('player stats', () => {
  it('counts rounds, wins and streaks', () => {
    let s = emptyStats();
    s = addRound(s, round(true));
    s = addRound(s, round(true));
    s = addRound(s, round(false));
    s = addRound(s, round(true, { turns: 9, maxHand: 14, online: true, mode: 'nomercy' }));
    expect(s.games).toBe(4);
    expect(s.wins).toBe(3);
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(2);
    expect(s.fastestWin).toBe(9);
    expect(s.comebacks).toBe(1);
    expect(s.online).toEqual({ games: 1, wins: 1 });
    expect(s.modes.nomercy).toEqual({ games: 1, wins: 1 });
  });

  it('unlocks each achievement once', () => {
    let s = addRound(emptyStats(), round(true, { turns: 10 }));
    const first = unlockNew(s, 1000);
    expect(first.fresh.map(a => a.id).sort()).toEqual(['firstWin', 'speedrun']);
    s = first.stats;
    expect(unlockNew(s).fresh).toHaveLength(0);
    expect(s.unlocked.firstWin).toBe(1000);
  });

  it('every achievement can be reached, and a damaged record is cleaned up', () => {
    for (const a of ACHIEVEMENTS) expect(a.progress(emptyStats())[1]).toBeGreaterThan(0);
    const s = cleanStats({ wins: 'lots', games: -3, colors: { red: 5 }, unlocked: { firstWin: 5, bad: 'x' }, themes: ['winter', 7] });
    expect(s.wins).toBe(0);
    expect(s.games).toBe(0);
    expect(s.colors).toEqual({ red: 5, yellow: 0, green: 0, blue: 0 });
    expect(s.unlocked).toEqual({ firstWin: 5 });
    expect(s.themes).toEqual(['winter']);
  });
});
