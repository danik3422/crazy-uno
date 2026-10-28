import { COLORS } from './content';
import type { Card, Rules } from './types';

/**
 * Every card of a fresh deck, in a fixed order and without ids
 * (the engine shuffles it and only then numbers the cards).
 *
 * Classic, per colour: one 0, two of each 1–9, two Skip / Reverse / +2,
 * plus one of each crazy card and a dare when those rules are on.
 * Wild cards: four Wild and four +4, plus two Chaos and two Dump with crazy cards.
 *
 * No Mercy (168 cards), per colour: two of each 0–9, three Skip / Reverse / +2 / Discard All,
 * two coloured +4 and two Skip Everyone. Wild cards: eight Reverse +4, four +6, four +10, eight Colour Roulette.
 */
export function buildDeck(rules: Rules): Card[] {
  const deck: Card[] = [];
  const add = (color: Card['color'], type: Card['type'], value?: number) => deck.push({ id: 0, color, type, value });
  for (const c of COLORS) {
    if (rules.noMercy) {
      for (let n = 0; n <= 9; n++) { add(c, 'num', n); add(c, 'num', n); }
      for (const t of ['skip', 'rev', 'draw2', 'discardAll'] as const) for (let i = 0; i < 3; i++) add(c, t);
      for (const t of ['draw4', 'skipAll'] as const) { add(c, t); add(c, t); }
    } else {
      add(c, 'num', 0);
      for (let n = 1; n <= 9; n++) { add(c, 'num', n); add(c, 'num', n); }
      for (const t of ['skip', 'rev', 'draw2'] as const) { add(c, t); add(c, t); }
    }
    if (rules.crazy) for (const t of ['swap', 'gift', 'bomb', 'rain', 'mirror'] as const) add(c, t);
    if (rules.dares) add(c, 'dare');
  }
  if (rules.noMercy) {
    for (let i = 0; i < 8; i++) { add('wild', 'wildRev4'); add('wild', 'roulette'); }
    for (let i = 0; i < 4; i++) { add('wild', 'wild6'); add('wild', 'wild10'); }
  } else for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'wild4'); }
  if (rules.crazy) for (let i = 0; i < 2; i++) { add('wild', 'chaos'); add('wild', 'dump'); }
  return deck;
}
