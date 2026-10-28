import { COLORS } from './content';
import type { Rng } from './random';
import { drawValue, nextSeat, sameTeam } from './rules';
import type { Card, Choice, Color, State } from './types';

/**
 * How bots (and the autopilot that stands in for an absent person) decide.
 * Pure functions: the engine applies the decision.
 */

/** Cards that hurt the next player: played eagerly once that player is close to winning. */
const ATTACK_CARDS: readonly Card['type'][] = ['draw2', 'wild4', 'skip', 'bomb', 'rain', 'draw4', 'wild6', 'wild10', 'wildRev4', 'skipAll', 'roulette'];

export function countColors(hand: Card[]): Record<Color, number> {
  const counts: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach(c => { if (c.color !== 'wild') counts[c.color]++; });
  return counts;
}

/** Picks which of the playable `options` the current player lays. A bit of randomness keeps bots unpredictable. */
export function pickBotCard(s: State, options: Card[], rng: Rng): Card {
  const me = s.players[s.cur];
  const nextIsClose = s.players[nextSeat(s)].hand.length <= 2;
  const counts = countColors(me.hand);
  const biggestColor = Math.max(...COLORS.map(c => counts[c]));
  const fewestElsewhere = Math.min(...s.players.filter(o => o !== me && !o.out).map(o => o.hand.length));
  const score = (c: Card) => {
    let r = rng() * 3;
    if (c.color === 'wild') r -= 6; // keep wild cards for later
    if (ATTACK_CARDS.includes(c.type)) r += nextIsClose ? 10 : 1;
    if (c.type === 'num') r += (c.value ?? 0) / 3; // shed high numbers first
    if (c.type === 'dump') r += biggestColor * 2;
    if (c.type === 'discardAll') r += counts[c.color as Color] * 2;
    // a penalty stack: answer with the smallest card that still beats it, keep the big ones
    if (s.pending) r -= drawValue(c) / 2;
    if (c.type === 'swap') r += fewestElsewhere < me.hand.length - 2 ? 8 : -8;
    if (c.type === 'mirror' && s.pending) r += 20;
    return r;
  };
  options.sort((a, b) => score(b) - score(a));
  return options[0];
}

/** Answers a choice prompt: a colour, a card to gift, or a target player. */
export function botDecision(s: State, choice: Choice): string | number {
  const me = s.players[s.cur];
  if (choice.kind === 'color') {
    const counts = countColors(me.hand);
    return COLORS.slice().sort((a, b) => counts[b] - counts[a])[0];
  }
  if (choice.kind === 'card') {
    // give away the highest number, never a wild card if there is anything else
    const nonWild = me.hand.filter(c => c.color !== 'wild');
    const pool = nonWild.length ? nonWild : me.hand;
    return pool.reduce((a, b) => ((b.value ?? -1) > (a.value ?? -1) ? b : a)).id;
  }
  // swap with / gift to the opponent with the fewest cards; never pick the partner
  let target = -1;
  s.players.forEach((o, i) => {
    if (i === s.cur || o.out || sameTeam(s, i, s.cur)) return;
    if (target < 0 || o.hand.length < s.players[target].hand.length) target = i;
  });
  return target >= 0 ? target : (s.cur + 1) % s.players.length;
}

/** The opponents who could catch `victim` forgetting UNO (a partner keeps quiet). */
export function botCatchers(s: State, victim: number): number[] {
  return s.players.map((x, i) => (x.bot && i !== victim && !sameTeam(s, i, victim) ? i : -1)).filter(i => i >= 0);
}

/** How long a bot "thinks" before its next step, ms. */
export function botThinkMs(s: State): number {
  if (s.phase === 'choose') return 700;
  if (s.drawn) return 650;
  return 950 + Math.random() * 700;
}

/** Bots pause after a random event so its banner and animation can finish first. */
export const EVENT_PAUSE_MS = 2800;
