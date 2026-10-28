import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './content';
import { Game } from './engine';
import { eventDue } from './events';

const never = () => 0.999;

function state(turn: number, lastEventTurn: number, events: boolean) {
  const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events }, online: true });
  g.s.turn = turn;
  g.s.lastEventTurn = lastEventTurn;
  return g.s;
}

describe('event timing', () => {
  it('never fires with the rule off or in the first two turns', () => {
    expect(eventDue(state(50, 0, false), () => 0)).toBe(false);
    expect(eventDue(state(2, 0, true), () => 0)).toBe(false);
  });

  it('waits for the minimum gap, then fires on a lucky roll', () => {
    // normal frequency: at least 4 turns apart
    expect(eventDue(state(13, 10, true), () => 0)).toBe(false);
    expect(eventDue(state(14, 10, true), () => 0)).toBe(true);
    expect(eventDue(state(14, 10, true), never)).toBe(false);
  });

  it('is forced after a long quiet stretch', () => {
    expect(eventDue(state(23, 10, true), never)).toBe(true);
  });
});
