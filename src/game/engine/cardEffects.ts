import { msg, type Msg } from '../../i18n/msg';
import type { Params, StrKey } from '../../i18n/types';
import { shuffle, type Rng } from '../random';
import { activeSeats, drawValue } from '../rules';
import type { Card, Choice, Color, Fx, FxKind, Player, State } from '../types';

/** What a card's effect may touch: the state plus a few of the engine's moves (the same idea as EventTools). */
export interface EffectTools {
  s: State;
  rng: Rng;
  /** whose card it is */
  current: () => Player;
  nextIdx: (from?: number) => number;
  /** stop and wait for a decision (a colour, a player, a card); the effect carries on in Game.resolveChoice */
  ask: (choice: Choice) => void;
  /** done: the turn moves on (or the round ends) */
  finish: () => void;
  reverse: () => void;
  addPending: (card: Card) => void;
  rotateHands: () => void;
  give: (p: Player, n: number) => Card[];
  /** a seat with no cards left, or -1 */
  emptyHand: () => number;
  say: (k: StrKey, p?: Params) => void;
  fx: (kind: FxKind, text?: Msg, extra?: Partial<Fx>) => void;
}

/** Applies the card just played (state.effect). Cards that need a decision stop at `ask` and continue in Game.resolveChoice. */
export function applyCardEffect(t: EffectTools) {
  const s = t.s;
  const e = s.effect!;
  const card = e.card;
  const p = t.current();
  // players still in the game (No Mercy knocks some out): with two left, a reverse works like a skip
  const n = activeSeats(s).length;
  const nextName = s.players[t.nextIdx()].name;
  switch (card.type) {
    case 'num':
      if (s.rules.sevenZero && card.value === 7) return t.ask({ kind: 'player', title: msg('choice.seven'), mode: 'swap' });
      if (s.rules.sevenZero && card.value === 0) {
        t.rotateHands();
        t.say('log.zero');
        t.fx('flip');
      }
      break;
    case 'skip':
      e.steps = 2;
      t.say('log.skip', { who: nextName });
      break;
    case 'rev':
      t.reverse();
      // with two players a reverse works like a skip
      if (n === 2) e.steps = 2;
      t.say('log.rev');
      break;
    case 'draw2':
    case 'draw4':
      t.addPending(card);
      if (s.pending > drawValue(card)) t.say('log.stack', { n: s.pending });
      break;
    case 'wild6':
    case 'wild10':
      return t.ask({ kind: 'color', title: msg('choice.wildN', { n: drawValue(card) }) });
    case 'wildRev4':
      // reverse first: the +4 goes to whoever moves next in the new direction. With two players the official
      // rule is that it skips the other player and YOU draw 4 (unless you stack it back at them)
      t.reverse();
      if (n === 2) e.steps = 2;
      t.say('log.wildRev4');
      return t.ask({ kind: 'color', title: msg('choice.wildRev4') });
    case 'skipAll':
      // everyone else is skipped: round the table and back to you
      e.steps = activeSeats(s).length;
      t.say('log.skipAll', { who: p.name });
      break;
    case 'discardAll': {
      const col = card.color as Color;
      const out = p.hand.filter(c => c.color === col);
      p.hand = p.hand.filter(c => c.color !== col);
      s.discard.splice(s.discard.length - 1, 0, ...out);
      t.say('log.discardAll', { who: p.name, color: col, n: out.length });
      break;
    }
    case 'roulette':
      s.rouletteNext = true;
      t.say('log.roulette', { who: nextName });
      t.fx('toast', msg('log.roulette', { who: nextName }));
      break;
    case 'wild':
      return t.ask({ kind: 'color', title: msg('choice.wild') });
    case 'wild4':
      return t.ask({ kind: 'color', title: msg('choice.wildN', { n: 4 }) });
    case 'swap':
      return t.ask({ kind: 'player', title: msg('choice.swap'), mode: 'swap' });
    case 'gift':
      return t.ask({ kind: 'card', title: msg('choice.gift') });
    case 'bomb':
      s.bombNext = true;
      t.say('log.bomb', { who: p.name, to: nextName });
      t.fx('toast', msg('fx.bomb', { to: nextName }));
      break;
    case 'dare':
      if (s.rules.dares) {
        s.dareNext = true;
        t.say('log.dare', { who: nextName });
      }
      break;
    case 'rain':
      s.players.forEach(o => { if (o !== p && !o.out) t.give(o, 1); });
      t.say('log.rain');
      t.fx('toast', msg('fx.rain'));
      break;
    case 'mirror':
      t.reverse();
      if (s.pending > 0) {
        t.say('log.mirror', { n: s.pending });
        t.fx('toast', msg('fx.mirror', { n: s.pending }));
      } else {
        if (n === 2) e.steps = 2;
        t.say('log.mirrorRev');
      }
      break;
    case 'chaos': {
      const all = shuffle(s.players.flatMap(x => x.hand), t.rng);
      s.players.forEach(x => { x.hand = []; });
      let i = s.cur;
      while (all.length) {
        i = t.nextIdx(i);
        s.players[i].hand.push(all.pop()!);
      }
      t.say('log.chaos');
      t.fx('chaos', msg('fx.chaos'));
      if (t.emptyHand() >= 0) break;
      return t.ask({ kind: 'color', title: msg('choice.chaos') });
    }
    case 'dump':
      return t.ask({ kind: 'color', title: msg('choice.dump'), mode: 'dump' });
  }
  t.finish();
}
