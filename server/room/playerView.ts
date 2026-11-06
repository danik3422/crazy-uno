import type { Game } from '../../src/game/engine/Game';
import type { Card } from '../../src/game/types';
import type { PlayerView } from '../../src/net/protocol';

/**
 * What one viewer may see of the game. Their own hand (and a teammate's) is face up; every other hidden card
 * goes out as an opaque placeholder with a random number that is new each time the card goes out of sight,
 * so nobody can follow a card from hand to hand by its number. The alias book remembers those numbers per viewer.
 */
export interface AliasBook {
  game: Game;
  alias: Map<number, number>;
  used: Set<number>;
  seen: Set<number>;
}

export interface ViewInput {
  /** the viewer's seat (-1: watching) */
  you: number;
  book: AliasBook | null;
  /** the opening deal is running: hidden cards keep their deal order for the animation */
  dealing: boolean;
  /** member id per seat */
  seats: string[];
  /** a person who dropped out: a bot is playing their seat until they come back */
  isOffline: (seat: number) => boolean;
  warmup: PlayerView['warmup'];
}

export function buildPlayerView(g: Game, { you, book, dealing, seats, isOffline, warmup }: ViewInput): PlayerView {
  const s = g.s;
  const over = s.phase === 'over';
  const seenNow = new Set<number>();
  // a card this viewer can see: if it was hidden from them a moment ago, tell them where it was
  const show = (c: Card): Card => {
    seenNow.add(c.id);
    const was = book && !book.seen.has(c.id) ? book.alias.get(c.id) : undefined;
    return was === undefined ? c : { ...c, fromId: was };
  };
  const hide = (c: Card): Card => {
    let id = book?.alias.get(c.id);
    let fromId: number | undefined;
    if (book && (id === undefined || book.seen.has(c.id))) {
      // newly out of sight: a fresh random number; if they just saw it, it flies from where they saw it
      if (book.seen.has(c.id)) fromId = c.id;
      do id = 10_000_000 + Math.floor(Math.random() * 89_999_999); while (book.used.has(id));
      book.used.add(id);
      book.alias.set(c.id, id);
    }
    // the deal order is only needed for the opening animation; afterwards it would identify cards
    return { id: id ?? -1, color: 'wild', type: 'num', value: 0, hidden: true, dealIdx: dealing ? c.dealIdx : undefined, fromId };
  };
  const discard = s.discard.slice(-40).map(show);
  const players = s.players.map((p, i) => {
    return {
      name: p.name,
      bot: p.bot,
      avatar: p.avatar,
      member: seats[i],
      // a person who dropped out: a bot is playing their seat until they come back
      offline: isOffline(i),
      // No Mercy: knocked out, and in what order (the seat is skipped; the van comes for them on every screen)
      out: p.out,
      // hidden hands are sorted by their opaque numbers, so the order tells nothing either
      // a teammate's hand is open too (2 vs 2 and up, as in the mobile game)
      hand: i === you || over || (you >= 0 && !!s.teams && s.teams[i] === s.teams[you]) ? p.hand.map(show) : p.hand.map(hide).sort((a, b) => a.id - b.id),
    };
  });
  if (book) book.seen = seenNow;
  const mine = you === s.cur;
  return {
    you: you >= 0 ? you : null,
    deckCount: s.deck.length,
    warmup,
    state: {
      ...s,
      players,
      deck: [],
      discard,
      effect: null,
      choice: mine ? s.choice : null,
      lastDrawn: mine ? s.lastDrawn : null,
      fx: s.fx.slice(-12),
      // whether the +4 was a bluff is only revealed by challenging it
      challenge: s.challenge ? { ...s.challenge, guilty: false } : null,
      log: s.log.slice(-20),
    },
  };
}
