import { describe, expect, it } from 'vitest';
import { randomBot } from './avatars';
import { DEFAULT_RULES, DEFAULT_TABLE } from './content';
import { botNames, render } from '../i18n/core';
import { Game } from './engine';
import { seatByTeams, teamsOf, teamsProblem } from './teams';

describe('teams', () => {
  it('splits evenly by default and fills the short side around the picks', () => {
    expect(teamsOf([{}, {}, {}, {}])).toEqual([0, 1, 0, 1]);
    expect(teamsOf([{ team: 1 }, { team: 1 }, {}, {}])).toEqual([1, 1, 0, 0]);
    expect(teamsOf([{}, { team: 0 }, {}, {}])).toEqual([0, 0, 1, 1]);
  });

  it('needs 4+ players and the same number on each side', () => {
    expect(teamsProblem([0, 1])?.k).toBe('teams.need4');
    expect(teamsProblem([0, 1, 0, 1, 0])?.k).toBe('teams.even');
    expect(teamsProblem([0, 0, 0, 1])).toEqual({ k: 'teams.uneven', p: { a: 3, b: 1 } });
    expect(render(teamsProblem([0, 0, 0, 1]), 'en')).toMatch(/3 vs 1/);
    expect(teamsProblem([0, 0, 1, 1])).toBeNull();
  });

  it('seats the sides alternately, keeping the order within each team', () => {
    expect(seatByTeams(['a', 'b', 'c', 'd', 'e', 'f'], [0, 0, 0, 1, 1, 1])).toEqual({ list: ['a', 'd', 'b', 'e', 'c', 'f'], teams: [0, 1, 0, 1, 0, 1] });
  });

  it('the engine plays the teams it is given', () => {
    const players = ['A', 'B', 'C', 'D'].map((name, i) => ({ name, bot: true, team: [1, 0, 1, 0][i] }));
    const g = new Game({ players, rules: DEFAULT_RULES, table: { ...DEFAULT_TABLE, teams: true }, online: true });
    expect(g.s.teams).toEqual([1, 0, 1, 0]);
    // an uneven split is not played as teams
    const uneven = new Game({ players: players.map(p => ({ ...p, team: 0 })), rules: DEFAULT_RULES, table: { ...DEFAULT_TABLE, teams: true }, online: true });
    expect(uneven.s.teams).toBeNull();
  });
});

describe('new bots', () => {
  it('get a random name and robot face, preferring ones not taken', () => {
    const names = new Set<string>();
    const faces = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const b = randomBot([]);
      names.add(b.name);
      faces.add(b.avatar);
    }
    expect(names.size).toBeGreaterThan(5);
    expect(faces.size).toBeGreaterThan(2);
    const BOTNAMES = botNames();
    const taken = BOTNAMES.slice(1).map(name => ({ name }));
    expect(randomBot(taken).name).toBe(BOTNAMES[0]);
    // every name taken: it gets a number
    expect(randomBot(BOTNAMES.map(name => ({ name })))).toMatchObject({ name: expect.stringMatching(/ 2$/) });
  });
});
