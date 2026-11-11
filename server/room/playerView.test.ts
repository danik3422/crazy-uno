import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from '../../src/game/content';
import { Game } from '../../src/game/engine/Game';
import { seededRng } from '../../src/game/random';
import { buildPlayerView, type AliasBook } from './playerView';

const game = (n = 4, teams = false) =>
  new Game(
    { players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: false, team: i % 2 })), rules: { ...DEFAULT_RULES, events: false }, online: true, table: teams ? ({ teams: true } as never) : undefined },
    { rng: seededRng(0.3) },
  );
const book = (g: Game): AliasBook => ({ game: g, alias: new Map(), used: new Set(), seen: new Set() });
const view = (g: Game, you: number, b: AliasBook | null = book(g)) =>
  buildPlayerView(g, { you, book: b, dealing: false, seats: g.s.players.map((_, i) => `m${i}`), isOffline: () => false, warmup: { waiting: [], turning: [], dealAt: null, dealEnd: null } });

describe('what one player may see', () => {
  it('shows only their own hand, never the deck, and hides who bluffed a +4', () => {
    const g = game();
    g.s.challenge = { by: 0, target: 1, guilty: true };
    const v = view(g, 2);
    v.state.players.forEach((p, i) => {
      if (i === 2) expect(p.hand.every(c => !c.hidden)).toBe(true);
      else expect(p.hand.every(c => c.hidden && c.id >= 10_000_000 && c.color === 'wild')).toBe(true);
    });
    expect(v.state.deck).toEqual([]);
    expect(v.deckCount).toBe(g.s.deck.length);
    expect(v.state.challenge!.guilty).toBe(false);
  });

  it('shows a pending choice and the card just drawn only to the player whose turn it is', () => {
    const g = game();
    g.s.choice = { kind: 'player', title: { k: 'choice.swap' } as never, mode: 'swap' };
    g.s.lastDrawn = g.s.players[g.s.cur].hand[0].id;
    const other = (g.s.cur + 1) % 4;
    expect(view(g, g.s.cur).state.choice).not.toBeNull();
    expect(view(g, g.s.cur).state.lastDrawn).not.toBeNull();
    expect(view(g, other).state.choice).toBeNull();
    expect(view(g, other).state.lastDrawn).toBeNull();
  });

  it('opens a teammate\'s hand in teams, but never to someone watching', () => {
    const g = game(4, true);
    expect(g.s.teams).not.toBeNull();
    const mate = g.s.players.findIndex((_, i) => i !== 0 && g.s.teams![i] === g.s.teams![0]);
    const rival = g.s.players.findIndex(( _, i) => g.s.teams![i] !== g.s.teams![0]);
    const v = view(g, 0);
    expect(v.state.players[mate].hand.every(c => !c.hidden)).toBe(true);
    expect(v.state.players[rival].hand.every(c => c.hidden)).toBe(true);
    const watching = view(g, -1, null);
    expect(watching.you).toBeNull();
    expect(watching.state.players.every(p => p.hand.every(c => c.hidden))).toBe(true);
  });

  it('gives a card a new number once it leaves the viewer\'s sight, so it cannot be followed', () => {
    const g = game();
    const b = book(g);
    const card = g.s.players[0].hand[0];
    view(g, 0, b);
    // it goes to player 1 (as in a gift or a swap)
    g.s.players[0].hand.splice(0, 1);
    g.s.players[1].hand.push(card);
    const after = view(g, 0, b).state.players[1].hand;
    expect(after.some(c => c.id === card.id)).toBe(false);
    const moved = after.find(c => c.fromId === card.id);
    expect(moved).toBeDefined();
    // and while it stays out of sight, its number stays the same
    const again = view(g, 0, b).state.players[1].hand.map(c => c.id);
    expect(again).toContain(moved!.id);
  });

  it('shows every hand once the round is over', () => {
    const g = game();
    g.s.phase = 'over';
    expect(view(g, 0).state.players.every(p => p.hand.every(c => !c.hidden))).toBe(true);
  });
});
