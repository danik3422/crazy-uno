import { COLORS } from './content';
import type { Rng } from './random';
import { activeSeats, drawValue, nextSeat, sameTeam } from './rules';
import type { BotLevel, Card, Choice, Color, State } from './types';

/**
 * How bots (and the autopilot that stands in for an absent person) decide.
 * Pure functions: the engine applies the decision.
 *
 * Three levels, picked per table:
 * - easy: plays any card that fits, often forgets «UNO!», rarely catches anyone;
 * - normal: sensible, with a little randomness (the autopilot always plays like this);
 * - hard: before each move plays it out in many imagined games and picks what wins most often
 *   (so it hits whoever is about to win, keeps wild cards when that pays off, and so on),
 *   and almost never forgets «UNO!». See `thinkAhead` in the engine.
 */

/** The table-talk side of each level: UNO calls, catching others, challenging a +4. */
export const BOT_SKILL: Record<BotLevel, {
  /** chance to forget «UNO!» on the second-to-last card */
  forgetUno: number;
  /** chance that some bot notices a missing «UNO!» */
  noticeUno: number;
  /** how long before a bot catches it: base + random spread, ms */
  catchMs: [number, number];
  /** chance to challenge a +4 */
  challenge: number;
  /** Jump-In: chance to spot an identical card and lay it out of turn */
  jumpIn: number;
  /** how long before they jump in: base + random spread, ms */
  jumpMs: [number, number];
}> = {
  easy: { forgetUno: 0.45, noticeUno: 0.3, catchMs: [2600, 2600], challenge: 0.1, jumpIn: 0.2, jumpMs: [1100, 300] },
  normal: { forgetUno: 0.2, noticeUno: 0.55, catchMs: [1400, 2200], challenge: 0.35, jumpIn: 0.6, jumpMs: [800, 500] },
  hard: { forgetUno: 0.03, noticeUno: 0.9, catchMs: [900, 1100], challenge: 0.35, jumpIn: 0.92, jumpMs: [500, 350] },
};

/** A bot laying a card out of turn (Jump-In): who, which card, after how long, and whether it calls UNO with it. */
export interface BotJump {
  seat: number;
  cardId: number;
  delay: number;
  uno: boolean;
}

/**
 * Jump-In: of the bots holding a card exactly like the top one, which (if any) notices and jumps in, and after how long.
 * Each one notices by their level's chance; the quickest of those wins.
 */
export function pickBotJump(s: State, candidates: { seat: number; card: Card }[], rng: Rng): BotJump | null {
  const skill = BOT_SKILL[s.table.botLevel];
  let best: BotJump | null = null;
  for (const { seat, card } of candidates) {
    if (!s.players[seat]?.bot || rng() >= skill.jumpIn) continue;
    const delay = skill.jumpMs[0] + Math.floor(rng() * skill.jumpMs[1]);
    const uno = rng() > skill.forgetUno;
    if (!best || delay < best.delay) best = { seat, cardId: card.id, delay, uno };
  }
  return best;
}

/** Cards that hurt the next player: played eagerly once that player is close to winning. */
const ATTACK_CARDS: readonly Card['type'][] = ['draw2', 'wild4', 'skip', 'bomb', 'rain', 'draw4', 'wild6', 'wild10', 'wildRev4', 'skipAll', 'roulette'];

export function countColors(hand: Card[]): Record<Color, number> {
  const counts: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  hand.forEach(c => { if (c.color !== 'wild') counts[c.color]++; });
  return counts;
}

/**
 * Picks which of the playable `options` the current player lays: at random for an easy bot, by rule of thumb otherwise.
 * (A hard bot weighs its options by playing them out, see `thinkAhead` in the engine; this is its fallback.)
 */
export function pickBotCard(s: State, options: Card[], rng: Rng, level: BotLevel = 'normal'): Card {
  if (level === 'easy') return options[Math.floor(rng() * options.length)];
  return pickNormal(s, options, rng);
}

/** A bit of randomness keeps normal bots unpredictable. */
function pickNormal(s: State, options: Card[], rng: Rng): Card {
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
    // with two players a Wild Reverse +4 lands on whoever plays it: only a last resort
    if (c.type === 'wildRev4' && activeSeats(s).length === 2) r -= 30;
    return r;
  };
  options.sort((a, b) => score(b) - score(a));
  return options[0];
}

/** Answers a choice prompt: a colour, a card to gift, or a target player. `rng` lets an easy bot choose at random. */
export function botDecision(s: State, choice: Choice, level: BotLevel = 'normal', rng?: Rng): string | number {
  const me = s.players[s.cur];
  if (level === 'easy' && rng && choice.kind === 'color' && rng() < 0.5) return COLORS[Math.floor(rng() * COLORS.length)];
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
