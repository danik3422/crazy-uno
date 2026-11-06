import { describe, expect, it } from 'vitest';
import { DEFAULT_TABLE, PRESETS } from './content';
import { Game } from './engine/Game';
import { canJumpIn } from './rules';
import type { BotLevel, Card, CardType, Rules } from './types';

const PARTY = PRESETS.find(p => p.id === 'party')!.rules;
const QUIET: Rules = { ...PARTY, jumpIn: true, events: false, dares: false, timer: false, sevenZero: false };

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

let nextId = 50_000;
const card = (type: CardType, color: Card['color'] = 'red', value?: number): Card => ({ id: nextId++, type, color, value });

/**
 * Four people (each with their own screen, so no hand-over curtain), seat 0 to move, red 5 on the pile.
 * Every hand gets a few filler cards that match nothing.
 */
function table(rules: Partial<Rules> = {}, bots = false, botLevel: BotLevel = 'normal', seed = 1) {
  const g = new Game(
    { players: ['A', 'B', 'C', 'D'].map(name => ({ name, bot: bots })), rules: { ...QUIET, ...rules }, online: true, table: { ...DEFAULT_TABLE, botLevel } },
    { rng: seeded(seed) },
  );
  const s = g.s;
  s.cur = 0;
  s.dir = 1;
  s.phase = 'play';
  s.choice = null;
  s.effect = null;
  s.pending = 0;
  s.pendingType = null;
  s.wildStart = false;
  s.rouletteNext = false;
  s.skipNext = [];
  s.unoCatch = null;
  s.players.forEach(p => { p.hand = [card('num', 'blue', 1), card('num', 'green', 2), card('num', 'yellow', 3)]; });
  setTop(g, card('num', 'red', 5));
  return g;
}

function setTop(g: Game, c: Card) {
  g.s.discard.push(c);
  if (c.color !== 'wild') g.s.color = c.color;
}

function give(g: Game, seat: number, c: Card) {
  g.s.players[seat].hand.push(c);
  return c;
}

describe('Jump-In: when it is allowed', () => {
  it('an identical card (same colour and number) may go in out of turn', () => {
    const g = table();
    const c = give(g, 2, card('num', 'red', 5));
    expect(canJumpIn(g.s, 2, c)).toBe(true);
    expect(g.jumpInCandidates()).toEqual([{ seat: 2, card: c }]);
  });

  it('not the same colour with another number, nor the same number in another colour', () => {
    const g = table();
    const a = give(g, 1, card('num', 'red', 6));
    const b = give(g, 2, card('num', 'blue', 5));
    expect(canJumpIn(g.s, 1, a)).toBe(false);
    expect(canJumpIn(g.s, 2, b)).toBe(false);
    expect(g.jumpIn(1, a.id)).toBe(false);
    expect(g.s.cur).toBe(0);
  });

  it('action cards jump in on the same action of the same colour only', () => {
    const g = table();
    setTop(g, card('skip', 'green'));
    expect(canJumpIn(g.s, 1, give(g, 1, card('skip', 'green')))).toBe(true);
    expect(canJumpIn(g.s, 2, give(g, 2, card('skip', 'blue')))).toBe(false);
    expect(canJumpIn(g.s, 3, give(g, 3, card('rev', 'green')))).toBe(false);
  });

  it('never with wild cards', () => {
    for (const type of ['wild', 'wild4', 'chaos', 'dump'] as CardType[]) {
      const g = table();
      const top = card(type, 'wild');
      g.s.discard.push(top);
      g.s.color = 'red';
      expect(canJumpIn(g.s, 1, give(g, 1, card(type, 'wild')))).toBe(false);
    }
  });

  it('not for the player whose turn it is (they just play), and not with the rule off', () => {
    const g = table();
    const mine = give(g, 0, card('num', 'red', 5));
    expect(canJumpIn(g.s, 0, mine)).toBe(false);
    expect(g.jumpIn(0, mine.id)).toBe(false);
    const off = table({ jumpIn: false });
    expect(canJumpIn(off.s, 1, give(off, 1, card('num', 'red', 5)))).toBe(false);
  });

  it('not while a decision is open, nor with a +4 challenge or a colour changed since', () => {
    const g = table();
    const c = give(g, 1, card('num', 'red', 5));
    g.s.phase = 'choose';
    g.s.choice = { kind: 'player', title: { k: 'choice.swap' } as never, mode: 'swap' };
    expect(canJumpIn(g.s, 1, c)).toBe(false);
    g.s.phase = 'play';
    g.s.choice = null;
    g.s.challenge = { by: 3, target: 0, guilty: false };
    expect(canJumpIn(g.s, 1, c)).toBe(false);
    g.s.challenge = null;
    for (const phase of ['dare', 'coin', 'group', 'handover', 'over'] as const) {
      g.s.phase = phase;
      expect(canJumpIn(g.s, 1, c)).toBe(false);
    }
    g.s.phase = 'play';
    // an event recoloured the table: the red 5 is no longer what is in force
    g.s.color = 'blue';
    expect(canJumpIn(g.s, 1, c)).toBe(false);
  });

  it('a knocked-out player cannot', () => {
    const g = table();
    const c = give(g, 1, card('num', 'red', 5));
    g.s.players[1].out = 1;
    expect(canJumpIn(g.s, 1, c)).toBe(false);
  });

  it('with a penalty waiting: only an identical draw card, and only when penalties stack', () => {
    const g = table();
    g.play(give(g, 0, card('draw2', 'red')).id);
    expect(g.s.pending).toBe(2);
    expect(g.s.cur).toBe(1);
    const c = give(g, 3, card('draw2', 'red'));
    expect(canJumpIn(g.s, 3, c)).toBe(true);

    const strict = table({ stack: false });
    strict.play(give(strict, 0, card('draw2', 'red')).id);
    expect(canJumpIn(strict.s, 3, give(strict, 3, card('draw2', 'red')))).toBe(false);
  });
});

describe('Jump-In: what it does', () => {
  it('play carries on from the jumper; whoever was moving loses the turn', () => {
    const g = table();
    const c = give(g, 2, card('num', 'red', 5));
    const turn = g.s.turn;
    expect(g.jumpIn(2, c.id, g.top().id)).toBe(true);
    expect(g.top().id).toBe(c.id);
    expect(g.s.cur).toBe(3);
    expect(g.s.turn).toBeGreaterThan(turn);
    expect(g.s.players[2].hand.some(x => x.id === c.id)).toBe(false);
    expect(g.s.log.at(-1)).toMatchObject({ k: 'log.jumpIn' });
    expect(g.s.fx.some(f => f.kind === 'jump' && f.target === 2)).toBe(true);
  });

  it('a skip skips the player after the jumper', () => {
    const g = table();
    setTop(g, card('skip', 'blue'));
    const c = give(g, 1, card('skip', 'blue'));
    expect(g.jumpIn(1, c.id)).toBe(true);
    expect(g.s.cur).toBe(3);
  });

  it('a reverse turns play around from the jumper', () => {
    const g = table();
    setTop(g, card('rev', 'yellow'));
    const c = give(g, 2, card('rev', 'yellow'));
    expect(g.jumpIn(2, c.id)).toBe(true);
    expect(g.s.dir).toBe(-1);
    expect(g.s.cur).toBe(1);
  });

  it('a +2 lands on the player after the jumper; with stacking it adds to the stack', () => {
    const g = table();
    setTop(g, card('draw2', 'green'));
    const c = give(g, 2, card('draw2', 'green'));
    expect(g.jumpIn(2, c.id)).toBe(true);
    expect(g.s.cur).toBe(3);
    expect(g.s.pending).toBe(2);

    const st = table();
    st.play(give(st, 0, card('draw2', 'red')).id);
    const d = give(st, 3, card('draw2', 'red'));
    expect(st.jumpIn(3, d.id)).toBe(true);
    expect(st.s.pending).toBe(4);
    expect(st.s.cur).toBe(0);
  });

  it('down to one card: the jumper must call UNO and can be caught', () => {
    const g = table();
    const c = card('num', 'red', 5);
    g.s.players[1].hand = [c, card('num', 'blue', 9)];
    expect(g.jumpIn(1, c.id)).toBe(true);
    expect(g.s.unoCatch?.victim).toBe(1);
    expect(g.catchable()).toBe(true);
    g.catchUno(3);
    expect(g.s.players[1].hand.length).toBe(1 + g.s.table.unoPenalty);

    const ok = table();
    const d = card('num', 'red', 5);
    ok.s.players[1].hand = [d, card('num', 'blue', 9)];
    expect(ok.jumpIn(1, d.id, ok.top().id, true)).toBe(true);
    expect(ok.s.unoCatch).toBeNull();
    expect(ok.s.fx.some(f => f.kind === 'uno')).toBe(true);
  });

  it('jumping in with your last card wins', () => {
    const g = table();
    const c = card('num', 'red', 5);
    g.s.players[3].hand = [c];
    expect(g.jumpIn(3, c.id)).toBe(true);
    expect(g.s.phase).toBe('over');
    expect(g.s.winner).toBe(3);
  });

  it('a jumped-in card that needs a decision asks the jumper', () => {
    const g = table({ sevenZero: true });
    setTop(g, card('num', 'blue', 7));
    const c = give(g, 2, card('num', 'blue', 7));
    expect(g.jumpIn(2, c.id)).toBe(true);
    expect(g.s.phase).toBe('choose');
    expect(g.s.cur).toBe(2);
  });

  it('two jump in at once: the first counts, the second is refused because the top card changed', () => {
    const g = table();
    const top = g.top().id;
    const a = give(g, 1, card('num', 'red', 5));
    const b = give(g, 3, card('num', 'red', 5));
    expect(g.jumpIn(3, b.id, top)).toBe(true);
    // seat 1 still holds a red 5, same face as the new top, but it saw the old one
    expect(g.jumpIn(1, a.id, top)).toBe(false);
    expect(g.s.players[1].hand.some(x => x.id === a.id)).toBe(true);
    expect(g.top().id).toBe(b.id);
    // looking at the new top it may jump in again
    expect(g.jumpIn(1, a.id, g.top().id)).toBe(true);
  });

  it('the cards in play stay the same', () => {
    const g = table();
    const total = g.totalCards();
    g.jumpIn(2, give(g, 2, card('num', 'red', 5)).id);
    expect(g.totalCards()).toBe(total + 1);
  });
});

describe('Jump-In: bots', () => {
  it('a hard bot with the same card plans to jump in after a human-like pause, decided once per top card', () => {
    let planned = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = table({}, true, 'hard', seed);
      const c = give(g, 2, card('num', 'red', 5));
      const plan = g.botJumpPlan();
      if (!plan) continue;
      planned++;
      expect(plan).toMatchObject({ seat: 2, cardId: c.id, top: g.top().id });
      expect(plan.delay).toBeGreaterThanOrEqual(500);
      expect(plan.delay).toBeLessThanOrEqual(1400);
      // asking again does not roll again
      expect(g.botJumpPlan()).toEqual(plan);
      expect(g.jumpIn(plan.seat, plan.cardId, plan.top, plan.uno)).toBe(true);
      expect(g.s.cur).toBe(3);
      // the card is gone: no plan for the new top
      expect(g.botJumpPlan()).toBeNull();
    }
    expect(planned).toBeGreaterThan(30);
  });

  it('easy bots jump in far less often than hard ones', () => {
    const rate = (level: BotLevel) => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const g = table({}, true, level, seed);
        give(g, 1, card('num', 'red', 5));
        if (g.botJumpPlan()) n++;
      }
      return n / 200;
    };
    const easy = rate('easy');
    const hard = rate('hard');
    expect(easy).toBeLessThan(0.35);
    expect(hard).toBeGreaterThan(0.8);
  });

  it('no plan for people, nor once the chance has passed', () => {
    const g = table({}, false);
    give(g, 1, card('num', 'red', 5));
    expect(g.botJumpPlan()).toBeNull();

    const b = table({}, true, 'hard', 3);
    const c = give(b, 1, card('num', 'red', 5));
    // the bot lost the card in the meantime
    b.s.players[1].hand = b.s.players[1].hand.filter(x => x.id !== c.id);
    expect(b.botJumpPlan()).toBeNull();
  });

  it('whole games with bots jumping in whenever they plan to stay sound', () => {
    let jumps = 0;
    for (let seed = 1; seed <= 25; seed++) {
      let clock = 0;
      const g = new Game(
        { players: Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, bot: true })), rules: { ...PARTY, jumpIn: true, sevenZero: true }, online: true, table: { ...DEFAULT_TABLE, botLevel: 'normal' } },
        { rng: seeded(seed), now: () => clock },
      );
      const total = g.totalCards();
      for (let step = 0; step < 4000 && g.s.phase !== 'over'; step++) {
        const plan = g.botJumpPlan();
        if (plan && g.jumpIn(plan.seat, plan.cardId, plan.top, plan.uno)) jumps++;
        else if (g.s.phase === 'group') g.doneGroup();
        else g.botAct();
        clock += 1000;
        g.checkBomb();
        expect(g.totalCards()).toBe(total);
        expect(g.s.players[g.s.cur].out).toBeFalsy();
      }
      expect(g.s.phase).toBe('over');
    }
    expect(jumps).toBeGreaterThan(10);
  });
});
