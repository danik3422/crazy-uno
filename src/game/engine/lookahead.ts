import { seededRng, shuffle, type Rng } from '../random';
import type { Card, Color, State } from '../types';
import type { Game } from './Game';

/** How many imagined games a hard bot plays out for each move it considers. */
const HARD_ROLLOUTS = 100;
/** An imagined game stops after this many steps (it almost always ends long before). */
const ROLLOUT_STEPS = 500;
/**
 * All imagined games of one decision together take at most this many steps. Long games (No Mercy, big tables)
 * with many cards to choose from would otherwise take half a second, and online that holds up every room on the
 * server. Counted in steps, not milliseconds, so a seeded game plays the same on any machine.
 */
const STEP_BUDGET = 20_000;
/** However long the games, every move gets at least this many tries. */
const MIN_ROLLOUTS = 12;

/** What thinking ahead needs from the game it thinks about. */
export interface LookaheadTools {
  s: State;
  rng: Rng;
  /** colours a player is known to lack (they drew on them) */
  knownLacks: (seat: number) => ReadonlySet<Color>;
  /** a new game that starts from `state` (an imagined one) */
  spawn: (state: State, rng: Rng) => Game;
}

/**
 * Tries each of `moves` in many imagined games and returns the index of the one that wins most often.
 * The bot only uses what it could know at a real table: its own hand, the pile and how many cards
 * everyone holds. The cards it cannot see are dealt at random for every imagined game,
 * and everyone then plays on like a normal bot.
 */
export function thinkAhead(t: LookaheadTools, moves: ((g: Game) => void)[]): number {
  const me = t.s.cur;
  const wins = moves.map(() => 0);
  let steps = 0;
  // whole rounds only (every move tried on the same deals), so the comparison stays fair when the budget runs out
  for (let k = 0; k < HARD_ROLLOUTS && (k < MIN_ROLLOUTS || steps < STEP_BUDGET); k++) {
    // the same imagined deal for every move, so they are compared on equal terms
    const seed = t.rng();
    moves.forEach((move, i) => {
      const g = imagine(t, seededRng(seed));
      move(g);
      const r = playOut(g, me);
      wins[i] += r.score;
      steps += r.steps;
    });
  }
  let best = 0;
  wins.forEach((w, i) => { if (w > wins[best]) best = i; });
  return best;
}

/** A copy of the game as the current player sees it, with every hidden card dealt at random. */
function imagine(t: LookaheadTools, rng: Rng): Game {
  const s = structuredClone(t.s);
  const me = s.cur;
  const hidden = shuffle([...s.deck, ...s.players.flatMap((p, i) => (i === me ? [] : p.hand))], rng);
  s.players.forEach((p, i) => {
    p.bot = true;
    if (i === me) return;
    // someone who drew on a colour gets none of it in the imagined deal (as long as there is enough else to give)
    const lacks = t.knownLacks(i);
    const size = p.hand.length;
    const hand: Card[] = [];
    for (let k = hidden.length - 1; k >= 0 && hand.length < size; k--) {
      const c = hidden[k];
      if (c.color === 'wild' || !lacks.has(c.color)) hand.push(...hidden.splice(k, 1));
    }
    while (hand.length < size && hidden.length) hand.push(hidden.pop()!);
    p.hand = hand;
  });
  s.deck = hidden;
  s.log = [];
  s.fx = [];
  // no surprises and no clocks in the imagination, and everyone in it plays like a normal bot
  s.rules = { ...s.rules, events: false };
  s.table = { ...s.table, botLevel: 'normal' };
  s.unoCatch = null;
  s.endsAt = null;
  return t.spawn(s, rng);
}

/** Plays an imagined game to the end. Score: 1 if `me` (or my team) wins, 0 if not, ½ if it never ends. */
function playOut(g: Game, me: number): { score: number; steps: number } {
  const s = g.s;
  let k = 0;
  for (; k < ROLLOUT_STEPS && s.phase !== 'over'; k++) g.botAct(true);
  if (s.phase !== 'over' || s.winner === null) return { score: 0.5, steps: k };
  return { score: s.winner === me || g.sameTeam(s.winner, me) ? 1 : 0, steps: k };
}
