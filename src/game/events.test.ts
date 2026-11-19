import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES } from './content';
import { Game } from './engine/Game';
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

describe('coin of fate', () => {
  /** a person's turn, waiting on the coin; the dice are set by `roll` */
  function coinTurn() {
    let roll = 0.1;
    const g = new Game(
      { players: [{ name: 'Me', bot: false }, { name: 'Bot', bot: true }], rules: { ...DEFAULT_RULES, events: true }, online: true },
      { rng: () => roll },
    );
    g.s.cur = 0;
    g.s.phase = 'coin';
    g.s.coin = null;
    return { g, setRoll: (r: number) => { roll = r; } };
  }

  it('a right guess sheds 2 cards, then the turn goes on', () => {
    const { g, setRoll } = coinTurn();
    const before = g.s.players[0].hand.length;
    setRoll(0.1); // heads
    g.guessCoin('heads');
    expect(g.s.coin).toEqual({ guess: 'heads', result: 'heads', win: true });
    expect(g.s.players[0].hand.length).toBe(before - 2);
    // a second guess while the result shows changes nothing
    g.guessCoin('tails');
    expect(g.s.coin?.guess).toBe('heads');
    g.finishCoin();
    expect(g.s.coin).toBeNull();
    expect(g.s.phase).toBe('play');
    expect(g.s.cur).toBe(0);
  });

  it('a wrong guess draws 2 cards', () => {
    const { g, setRoll } = coinTurn();
    const before = g.s.players[0].hand.length;
    setRoll(0.9); // tails
    g.guessCoin('heads');
    expect(g.s.coin).toEqual({ guess: 'heads', result: 'tails', win: false });
    expect(g.s.players[0].hand.length).toBe(before + 2);
    g.finishCoin();
    expect(g.s.phase).toBe('play');
  });

  it('a right guess never empties the hand (shedding stops at one card)', () => {
    const { g, setRoll } = coinTurn();
    g.s.players[0].hand = g.s.players[0].hand.slice(0, 2);
    setRoll(0.1);
    g.guessCoin('heads');
    expect(g.s.players[0].hand.length).toBe(1);
  });

  it('finishing before guessing does nothing', () => {
    const { g } = coinTurn();
    g.finishCoin();
    expect(g.s.phase).toBe('coin');
  });
});
