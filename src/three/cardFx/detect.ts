import type { Card, Color, State } from '../../game/types';
import { msgWords } from '../../i18n/msg';

/**
 * Works out which card effect to show from two snapshots of the game (before and after an update).
 * Pure, so it is unit-tested; the 3D side only turns its answers into animations.
 */

export interface Snap {
  topId: number | null;
  cur: number;
  phase: State['phase'];
  choiceKind: string | null;
  choiceMode: string | null;
  effectId: number | null;
  hands: number[];
  firstIds: (number | null)[];
  logLen: number;
  outs: boolean[];
  pending: number;
}

export function snap(s: State): Snap {
  const top = s.discard[s.discard.length - 1];
  return {
    topId: top ? top.id : null,
    cur: s.cur,
    phase: s.phase,
    choiceKind: s.choice?.kind ?? null,
    choiceMode: (s.choice as { mode?: string } | null)?.mode ?? null,
    effectId: s.effect?.card.id ?? null,
    hands: s.players.map(p => p.hand.length),
    firstIds: s.players.map(p => (p.hand[0] && !p.hand[0].hidden ? p.hand[0].id : null)),
    logLen: s.log.length,
    outs: s.players.map(p => !!p.out),
    pending: s.pending,
  };
}

export interface PlayTrigger {
  kind: 'play';
  card: Card;
  actor: number;
  /** who it hits, in order */
  targets: number[];
  /** cards involved (penalty, cards dumped, cards swapped) */
  n: number;
  /** waits for a decision (colour, partner) */
  waits: boolean;
  /** the decision was already made in the same update: the colour picked */
  color: Color | null;
  /** direction of play after the card */
  dir: 1 | -1;
  /** mirror: a penalty was bounced */
  reflected: boolean;
}

export interface ResolveTrigger {
  kind: 'resolve';
  cardId: number;
  card: Card | null;
  actor: number;
  color: Color;
  targets: number[];
  n: number;
}

/** No Mercy: someone was knocked out (too many cards) */
export interface KnockoutTrigger {
  kind: 'knockout';
  target: number;
}

/** A penalty was taken: the real cards fly from the deck to `target`, the hit lands with the last of them. */
export interface TakeTrigger {
  kind: 'take';
  target: number;
  n: number;
}

export type Trigger = PlayTrigger | ResolveTrigger | KnockoutTrigger | TakeTrigger;

type NextIdx = (from: number, steps?: number) => number;

const PENALTY: Partial<Record<Card['type'], number>> = { draw2: 2, draw4: 4, wild4: 4, wildRev4: 4, wild6: 6, wild10: 10 };

/** everyone still in the game except `actor`, in turn order from the actor */
function others(s: State, actor: number, next: NextIdx) {
  const out: number[] = [];
  let i = actor;
  for (let k = 0; k < s.players.length; k++) {
    i = next(i);
    if (i === actor || out.includes(i)) break;
    if (!s.players[i].out) out.push(i);
  }
  return out;
}

/** Who got the swap or the gift: the hand that changed, else the name in the newest log line. */
function partner(prev: Snap, s: State, actor: number, gift: boolean, next: NextIdx): number {
  const n = s.players.length;
  for (let i = 0; i < n; i++) {
    if (i === actor) continue;
    const grew = s.players[i].hand.length - (prev.hands[i] ?? 0);
    if (gift ? grew === 1 : grew !== 0) return i;
  }
  if (!gift) {
    for (let i = 0; i < n; i++) {
      if (i === actor) continue;
      const first = s.players[i].hand[0];
      const id = first && !first.hidden ? first.id : null;
      if (id !== null && prev.firstIds[i] !== null && id !== prev.firstIds[i]) return i;
    }
  }
  // the names mentioned in the newest log lines
  const words = s.log.slice(prev.logLen).flatMap(msgWords);
  for (let i = 0; i < n; i++) if (i !== actor && words.includes(s.players[i].name)) return i;
  return next(actor);
}

export function detect(prev: Snap | null, s: State, next: NextIdx): Trigger[] {
  if (!prev) return [];
  const out: Trigger[] = [];
  s.players.forEach((p, i) => { if (p.out && !prev.outs[i]) out.push({ kind: 'knockout', target: i }); });
  // the stacked penalty was drawn: whoever's hand grew by it takes the hit (a knock-out has its own effect)
  if ((prev.pending ?? 0) > 0 && s.pending === 0) {
    s.players.forEach((p, i) => {
      const grew = p.hand.length - (prev.hands[i] ?? 0);
      if (grew >= 2 && !p.out) out.push({ kind: 'take', target: i, n: grew });
    });
  }
  const top = s.discard[s.discard.length - 1];
  const played = !!top && top.id !== prev.topId && prev.topId !== null;

  // a decision was made (colour, partner): the effect waiting for it goes on
  const left = prev.phase === 'choose' && prev.effectId !== null && (s.phase !== 'choose' || (s.effect?.card.id ?? null) !== prev.effectId);
  if (left && !played) {
    const actor = prev.cur;
    const card = s.discard.find(c => c.id === prev.effectId) ?? null;
    if (prev.choiceKind === 'player') {
      const gift = prev.choiceMode === 'gift';
      out.push({ kind: 'resolve', cardId: prev.effectId!, card, actor, color: s.color, targets: [partner(prev, s, actor, gift, next)], n: 0 });
    } else if (prev.choiceKind === 'color') {
      const roulette = prev.choiceMode === 'roulette';
      const dumped = Math.max(0, (prev.hands[actor] ?? 0) - (s.players[actor]?.hand.length ?? 0));
      out.push({ kind: 'resolve', cardId: prev.effectId!, card, actor, color: s.color, targets: [roulette ? actor : s.cur], n: dumped });
    }
  }
  if (!played) return out;

  const actor = prev.cur;
  const t = top.type;
  const waiting = s.phase === 'choose' && s.effect?.card.id === top.id;
  const base = { kind: 'play' as const, card: top, actor, n: 0, waits: false, color: null, dir: s.dir, reflected: false };
  const victim = () => [s.cur];
  switch (t) {
    case 'num':
      if (s.rules.sevenZero && top.value === 0) {
        // the hands moved one seat on: every seat, in turn order
        out.push({ ...base, targets: [actor, ...others(s, actor, next)] });
      } else if (s.rules.sevenZero && top.value === 7) {
        out.push({ ...base, waits: waiting, targets: waiting ? [] : [partner(prev, s, actor, false, next)], n: 3 });
      }
      break;
    case 'skip':
      out.push({ ...base, targets: [next(actor, 1)] });
      break;
    case 'rev':
      out.push({ ...base, targets: [] });
      break;
    case 'draw2':
    case 'draw4':
      out.push({ ...base, targets: victim(), n: PENALTY[t]! });
      break;
    case 'skipAll':
    case 'rain':
      out.push({ ...base, targets: others(s, actor, next) });
      break;
    case 'discardAll':
      out.push({ ...base, targets: [], n: Math.max(1, (prev.hands[actor] ?? 0) - s.players[actor].hand.length - 1) });
      break;
    case 'roulette':
      // the next player names the colour and digs for it
      out.push({ ...base, waits: true, targets: victim() });
      break;
    case 'bomb':
    case 'dare':
      // the next player (a bot may already have moved on: panicked at the bomb, shrugged off the dare)
      out.push({ ...base, targets: [next(actor, 1)] });
      break;
    case 'mirror':
      out.push({ ...base, targets: victim(), reflected: s.pending > 0 });
      break;
    case 'swap':
    case 'gift':
      out.push({ ...base, waits: waiting || (s.phase === 'choose' && s.effect?.card.id === top.id), targets: waiting ? [] : [partner(prev, s, actor, t === 'gift', next)] });
      break;
    case 'wild':
    case 'wild4':
    case 'wild6':
    case 'wild10':
    case 'wildRev4':
    case 'chaos':
    case 'dump':
      out.push({
        ...base,
        waits: waiting,
        color: waiting ? null : s.color,
        targets: waiting ? [] : victim(),
        n: PENALTY[t] ?? (t === 'dump' && !waiting ? Math.max(0, (prev.hands[actor] ?? 0) - s.players[actor].hand.length - 1) : 0),
      });
      break;
  }
  return out;
}
