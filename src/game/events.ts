import { msg, type Msg } from '../i18n/msg';
import type { Params, StrKey } from '../i18n/types';
import { COLORS, EVENTS, GROUP_DARE_COUNT } from './content';
import { pick, randomIndex, type Rng } from './random';
import { activeSeats } from './rules';
import type { Card, EventId, Fx, FxKind, Player, State } from './types';

/**
 * Random "crazy events": what each one does to the table, and how often they happen.
 * The engine decides when to roll for one and hands over the few tools an event needs.
 */

/** What an event may do to the game. Provided by the engine. */
export interface EventTools {
  s: State;
  rng: Rng;
  /** the player whose turn it is */
  current(): Player;
  /** at least one person (not a bot) is at the table */
  hasHumans(): boolean;
  /** deal `n` cards from the deck; returns what was actually dealt */
  give(p: Player, n: number): Card[];
  /** move one random card out of `from`'s hand */
  takeRandomCard(from: Player): Card;
  /** put up to `k` random cards back under the deck, leaving at least one; returns how many */
  shedRandom(p: Player, k: number): number;
  /** every hand moves on to the next player */
  rotateHands(): void;
  say(k: StrKey, p?: Params): void;
  fx(kind: FxKind, text?: Msg, extra?: Partial<Fx>): void;
}

/** Minimum turns between events, chance per turn after that, and the gap after which one is forced. */
const FREQUENCY = {
  rare: { gap: 7, chance: 0.08, max: 20 },
  normal: { gap: 4, chance: 0.15, max: 13 },
  often: { gap: 3, chance: 0.3, max: 7 },
} as const;

/** Should an event fire at the start of this turn? Rolls the dice only once the minimum gap has passed. */
export function eventDue(s: State, rng: Rng): boolean {
  if (!s.rules.events || s.turn <= 2) return false;
  const since = s.turn - s.lastEventTurn;
  const freq = FREQUENCY[s.table.events];
  return since >= freq.gap && (rng() < freq.chance || since >= freq.max);
}

/** Applies a random event (or `forced`). Returns true when it waits for player input (group dare, coin). */
export function fireEvent(t: EventTools, forced?: EventId): boolean {
  const { s, rng } = t;
  // knocked-out players (No Mercy) are out of the events too
  const active = activeSeats(s);
  const n = active.length;
  const p = t.current();
  // a group dare needs people to do it
  const ids = (Object.keys(EVENTS) as EventId[]).filter(id => id !== 'group' || t.hasHumans());
  const id = forced ?? pick(ids, rng);
  const ev = EVENTS[id];
  const randomPlayer = () => pick(active, rng);
  const randomColor = () => pick(COLORS, rng);
  const title = msg(`ev.${id}`);
  const banner = (k: StrKey, p?: Params, target?: number) => {
    const sub = msg(k, p);
    t.fx('event', title, { sub, icon: ev.icon, target });
    t.say('log.event', { icon: ev.icon, title, sub });
  };

  switch (id) {
    case 'meteor': {
      const target = randomPlayer();
      const got = t.give(s.players[target], 10).length;
      banner('evs.meteor', { who: s.players[target].name, n: got }, target);
      t.fx('meteor', undefined, { target });
      break;
    }
    case 'recolor':
      s.players.forEach(pl => pl.hand.forEach(c => { if (c.color !== 'wild') c.color = randomColor(); }));
      s.color = randomColor();
      banner('evs.recolor', { color: s.color });
      t.fx('spin');
      break;
    case 'mono': {
      const col = randomColor();
      s.players.forEach(pl => pl.hand.forEach(c => { if (c.color !== 'wild') c.color = col; }));
      s.color = col;
      banner('evs.mono', { color: col });
      t.fx('spin');
      break;
    }
    case 'carousel':
      t.rotateHands();
      banner('evs.carousel');
      t.fx('carousel');
      break;
    case 'robin': {
      // the leader (fewest cards) gives up to 2 cards to whoever has the most
      const order = active.slice().sort((a, b) => s.players[a].hand.length - s.players[b].hand.length);
      const rich = s.players[order[0]];
      const poor = s.players[order[order.length - 1]];
      const m = rich === poor ? 0 : Math.min(2, rich.hand.length - 1);
      for (let i = 0; i < m; i++) poor.hand.push(t.takeRandomCard(rich));
      if (m) banner('evs.robin', { a: rich.name, n: m, b: poor.name }, order[0]);
      else banner('evs.robinNone', undefined, order[0]);
      break;
    }
    case 'upside':
      banner('evs.upside');
      t.fx('upside');
      break;
    case 'blind':
      s.blindTurns = n;
      banner('evs.blind');
      break;
    case 'blitz':
      s.blitzTurns = n;
      banner('evs.blitz');
      break;
    case 'lightning': {
      const target = randomPlayer();
      s.skipNext.push(target);
      banner('evs.lightning', { who: s.players[target].name }, target);
      t.fx('lightning', undefined, { target });
      break;
    }
    case 'bomber': {
      const target = randomPlayer();
      const got = t.give(s.players[target], 3).length;
      banner('evs.bomber', { who: s.players[target].name, n: got }, target);
      t.fx('bomber', undefined, { target });
      break;
    }
    case 'jackpot': {
      const target = randomPlayer();
      const m = t.shedRandom(s.players[target], 3);
      banner(m ? 'evs.jackpot' : 'evs.jackpotNone', { who: s.players[target].name, n: m }, target);
      t.fx('jackpot', undefined, { target });
      break;
    }
    case 'group':
      s.dare = msg('groupDare', { i: randomIndex(GROUP_DARE_COUNT, rng) });
      banner('evs.group');
      s.phase = 'group';
      return true;
    case 'coin':
      banner('evs.coin', { who: p.name });
      if (!p.bot) {
        // a person guesses; the engine waits in the 'coin' phase
        s.coin = null;
        s.phase = 'coin';
        return true;
      }
      flipCoin(t, rng() < 0.5 ? 'heads' : 'tails');
      s.coin = null;
      break;
  }
  return false;
}

/** The coin of fate: guess right and shed 2 cards, guess wrong and draw 2. */
export function flipCoin(t: EventTools, guess: 'heads' | 'tails') {
  const { s, rng } = t;
  const p = t.current();
  const result = rng() < 0.5 ? 'heads' : 'tails';
  const win = guess === result;
  s.coin = { guess, result, win };
  if (win) {
    const m = t.shedRandom(p, 2);
    t.say('log.coinWin', { side: result, who: p.name, n: m });
  } else {
    t.give(p, 2);
    t.say('log.coinLose', { side: result, who: p.name });
  }
}
