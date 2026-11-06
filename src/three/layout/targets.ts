import type { GameView } from '../../game/view';
import { DEAL_STEP_MS, dealTiming } from '../../net/protocol';
import { dropZone } from '../cards/drag';
import { placeFan } from './fanTargets';
import { placeHand, type PlaceCtx } from './handTargets';
import { seatPos } from './seats';
import { DECK_SHOWN, DECK_TOP, arena, deckSpot, pileScale, spawn } from './table';
import type { Target, Vec3, View } from './types';

const PI = Math.PI;
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Where every card on the table should be right now: the deck, the pile, your hand and each opponent's fan.
 * Also updates what the effects read from the layout (the deck spot, the seats, the drop zone).
 */
export function computeTargets(g: GameView, v: View): Map<number, Target> {
  const s = g.s;
  const out = new Map<number, Target>();
  const n = s.players.length;
  const A = arena(v);
  const deck = deckSpot(g, v);
  // right on top of the real top cards, so a card waiting for its deal does not hover over the deck
  spawn.pos = [deck[0], DECK_TOP + DECK_SHOWN * 0.016 + 0.006, deck[2]];
  Object.assign(dropZone, { x: A.discard[0], z: A.discard[2], radius: v.portrait ? 2.2 : 2.6, handZ: A.hand.z });
  spawn.seats = s.players.map((_, i) => {
    if (i === g.seat()) return [0, 0.3, A.hand.z - 0.4] as Vec3;
    const [x, , z] = seatPos(g, i, v);
    return [x, 0.6, z] as Vec3;
  });
  // one card at a time around the table, then the first card of the pile
  const step = DEAL_STEP_MS / 1000;
  // the pile's first card comes last, once the deck has left the middle (see dealTiming)
  const pileAt = dealTiming(n, s.table?.handSize ?? 7).pileMs / 1000;
  const dealDelay = (idx?: number) => (idx === undefined ? pileAt : idx * step);

  // the deck: only the top few real cards sit on the endless stack (DeckStack draws the rest)
  const dn = s.deck.length;
  s.deck.forEach((c, i) => {
    const fromTop = dn - 1 - i;
    out.set(c.id, {
      pos: [deck[0] + (hash(c.id) - 0.5) * 0.04, DECK_TOP + (DECK_SHOWN - fromTop) * 0.016, deck[2] + (hash(c.id + 9) - 0.5) * 0.04],
      rot: [PI / 2, -0.35 + 0.08 * (hash(c.id) - 0.5), 0],
      zone: 'deck', interactive: false, dim: false, delay: 0, hidden: fromTop >= DECK_SHOWN,
    });
  });

  // the pile: a messy fan of the last cards, newest on top; only the top few are drawn (the rest are covered),
  // and they rest on the table, not on the hidden ones
  const dl = s.discard.length;
  const PILE_SHOWN = 10;
  const ps = pileScale(v);
  s.discard.forEach((c, i) => {
    const layer = Math.max(0, i - (dl - PILE_SHOWN));
    out.set(c.id, {
      pos: [A.discard[0] + (hash(c.id) - 0.5) * 0.55 * ps, 0.02 + layer * 0.016, A.discard[2] + (hash(c.id + 3) - 0.5) * 0.4 * ps],
      rot: [-PI / 2, (hash(c.id + 5) - 0.5) * 1.3, 0],
      zone: 'discard', interactive: false, dim: false, delay: dealDelay(c.dealIdx), hidden: i < dl - PILE_SHOWN, scale: ps,
    });
  });

  const seat = g.seat();
  const viewer = g.viewer();
  const over = s.phase === 'over';
  const myTurn = viewer !== null && viewer === s.cur;

  const ctx: PlaceCtx = { g, v, A, out, dealDelay, seat, viewer, myTurn, over };
  s.players.forEach((p, pi) => {
    if (pi === seat) placeHand(ctx, p);
    else placeFan(ctx, p, pi);
  });
  return out;
}
