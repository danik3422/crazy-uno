import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES, DEFAULT_TABLE, EVENTS } from './content';
import { Game } from './engine/Game';
import type { Card, Color, EventId, Rules } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** What a (lazy) human does: answers every prompt, sometimes waits out a timer. */
function humanAct(g: Game, rnd: () => number) {
  const s = g.s;
  switch (s.phase) {
    case 'handover': return g.confirmHandover();
    case 'dare': return g.resolveDare(rnd() < 0.5);
    case 'group': return g.doneGroup();
    case 'coin': return s.coin ? g.finishCoin() : g.guessCoin(rnd() < 0.5 ? 'heads' : 'tails');
    case 'choose': {
      const ch = s.choice!;
      if (ch.kind === 'color') return g.resolveChoice('green');
      if (ch.kind === 'card') return g.resolveChoice(g.cp().hand[0].id);
      return g.resolveChoice(s.cur === 0 ? 1 : 0);
    }
    case 'play': {
      if (s.bombDeadline !== null && rnd() < 0.3) return; // let the timer run out
      if (rnd() < 0.05) return; // daydreaming: the turn clock may run out
      if (s.challenge && s.challenge.target === s.cur && rnd() < 0.4) return g.challengeWild4();
      const c = g.cp().hand.find(x => g.playable(x));
      if (c) {
        if (g.cp().hand.length === 2 && rnd() < 0.7) g.callUno();
        g.play(c.id);
      } else if (s.drawn && s.pending === 0) g.pass();
      else g.draw();
    }
  }
}

/** Plays a full game, checking invariants after every step. */
function simulate(seed: number, n: number, rules: Rules, humans = 0, table = DEFAULT_TABLE) {
  let clock = 0;
  const rnd = seeded(seed * 7 + 1);
  const g = new Game(
    { players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: i >= humans })), rules, table },
    { rng: seeded(seed), now: () => clock },
  );
  const total = g.totalCards();
  let steps = 0;
  while (g.s.phase !== 'over' && steps < 20000) {
    // a group dare waits for humans even on a bot's turn
    if (g.catchable() && rnd() < 0.3) {
      const c = g.s.unoCatch!;
      g.catchUno(c.botCatcher ?? (c.victim + 1) % n);
    }
    if (g.cp().bot && g.s.phase !== 'group') g.botAct();
    else humanAct(g, rnd);
    clock += 1000;
    g.checkBomb();
    if (rnd() < 0.2) clock += 30_000;
    g.timeoutTurn();
    g.checkTimeLimit();
    steps++;
    expect(g.totalCards()).toBe(total);
    const ids = new Set([...g.s.deck, ...g.s.discard, ...g.setAside(), ...g.s.players.flatMap(p => p.hand)].map(c => c.id));
    expect(ids.size).toBe(total);
  }
  return { g, steps };
}

describe('Game engine', () => {
  it('finishes bot games with every card accounted for', () => {
    let finished = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const { g } = simulate(seed, 2 + (seed % 7), DEFAULT_RULES);
      if (g.s.phase === 'over') {
        finished++;
        expect(g.s.players[g.s.winner!].hand.length).toBe(0);
      }
    }
    expect(finished).toBeGreaterThanOrEqual(297);
  });

  it('works with every rule switched off and on', () => {
    const off = Object.fromEntries(Object.keys(DEFAULT_RULES).map(k => [k, false])) as unknown as Rules;
    const on = Object.fromEntries(Object.keys(DEFAULT_RULES).map(k => [k, true])) as unknown as Rules;
    for (let seed = 1; seed <= 80; seed++) {
      expect(simulate(seed, 4, off).g.s.phase).toBe('over');
      expect(simulate(seed + 1000, 3, on).g.s.phase).toBe('over');
    }
  });

  it('finishes games with humans, every event and timer path', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const n = 2 + (seed % 5);
      const { g } = simulate(seed, n, DEFAULT_RULES, 1 + (seed % n));
      expect(g.s.phase).toBe('over');
    }
  });

  it('applies each random event without losing cards', () => {
    for (const id of Object.keys(EVENTS) as EventId[]) {
      for (const human of [true, false]) {
        const g = new Game({ players: [{ name: 'A', bot: !human }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: DEFAULT_RULES }, { rng: seeded(11) });
        const total = g.totalCards();
        const counts = g.s.players.map(p => p.hand.length);
        g.fireEvent(id);
        expect(g.totalCards()).toBe(total);
        expect(g.s.players.every(p => p.hand.length > 0)).toBe(true);
        if (id === 'meteor') expect(g.s.players.reduce((a, p) => a + p.hand.length, 0)).toBe(counts.reduce((a, b) => a + b) + 10);
        if (id === 'blind') expect(g.s.blindTurns).toBe(3);
        if (id === 'lightning') expect(g.s.skipNext.length).toBe(1);
        expect(g.s.fx.some(f => f.kind === 'event')).toBe(true);
      }
    }
  });

  it('skips the turn of a player struck by lightning', () => {
    const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(5) });
    const victim = g.nextIdx();
    g.s.skipNext.push(victim);
    const before = g.s.cur;
    while (g.s.cur === before && g.s.phase !== 'over') g.botAct();
    expect(g.s.cur).not.toBe(victim);
    expect(g.s.skipNext).toEqual([]);
  });

  describe('lightning does not let the struck player dodge what is aimed at them', () => {
    /** Three bots, no random events; the current player gets a card of `type` that fits the pile. */
    function setup(type: Card['type']) {
      const g = new Game({ players: [{ name: 'A', bot: true }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(5) });
      const s = g.s;
      expect(s.phase).toBe('play');
      const card = s.deck.splice(s.deck.findIndex(c => c.type === type), 1)[0];
      s.players[s.cur].hand.push(card);
      s.color = card.color as Color;
      const victim = g.nextIdx();
      s.skipNext.push(victim);
      return { g, s, card, victim, after: g.nextIdx(victim) };
    }

    it('the struck player takes the waiting +2 and loses the turn; the next player draws nothing', () => {
      const { g, s, card, victim, after } = setup('draw2');
      const total = g.totalCards();
      const hands = s.players.map(p => p.hand.length);
      expect(g.play(card.id)).toBe(true);
      expect(s.players[victim].hand.length).toBe(hands[victim] + 2);
      expect(s.players[after].hand.length).toBe(hands[after]);
      expect(s.cur).toBe(after);
      expect(s.phase).toBe('play');
      expect(s.pending).toBe(0);
      expect(s.pendingType).toBeNull();
      expect(s.skipNext).toEqual([]);
      expect(g.totalCards()).toBe(total);
    });

    it('the colour roulette is still spun by the struck player, and that is their lost turn', () => {
      const { g, s, card, victim, after } = setup('num');
      s.rouletteNext = true;
      const before = s.players[victim].hand.length;
      g.play(card.id);
      expect(s.cur).toBe(victim);
      expect(s.phase).toBe('choose');
      expect(s.choice).toMatchObject({ kind: 'color', mode: 'roulette' });
      // the strike is spent on this turn, not saved for the next one
      expect(s.skipNext).toEqual([]);
      g.resolveChoice('red');
      expect(s.players[victim].hand.length).toBeGreaterThan(before);
      expect(s.cur).toBe(after);
      expect(s.rouletteNext).toBe(false);
    });
  });

  it('plays a stand-in for a person who dropped out at the normal level, not the bots\' hard one', () => {
    /** One move by the first player of the same fresh game; whether they thought ahead (as a hard bot does). */
    const thinks = (standIn: boolean) => {
      const g = new Game(
        { players: [{ name: 'A', bot: true }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events: false }, table: { ...DEFAULT_TABLE, botLevel: 'hard' } },
        { rng: seeded(9) },
      );
      expect(g.s.phase).toBe('play');
      expect(g.cp().hand.filter(c => g.playable(c)).length).toBeGreaterThan(1);
      g.cp().standIn = standIn;
      const think = vi.spyOn(g as unknown as { thinkAhead: () => number }, 'thinkAhead');
      g.botAct();
      return think.mock.calls.length > 0;
    };
    expect(thinks(false)).toBe(true);
    expect(thinks(true)).toBe(false);
  });

  it('settles a two-step decision (a gift: which card, then to whom) when the turn clock runs out', () => {
    let clock = 0;
    const g = new Game(
      { players: [{ name: 'A', bot: false }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false, timer: true } },
      { rng: seeded(7), now: () => clock },
    );
    const s = g.s;
    for (let i = 0; i < 200 && !(s.cur === 0 && s.phase === 'play'); i++) {
      if (g.cp().bot) g.botAct();
      else if (s.phase === 'choose') g.resolveChoice('red');
      else g.draw();
    }
    expect(s.cur).toBe(0);
    expect(s.turnDeadline).not.toBeNull();
    const me = s.players[0];
    me.hand.push({ id: 99_999, color: s.color, type: 'gift' });
    const n = me.hand.length;
    g.play(99_999);
    expect(s.choice?.kind).toBe('card');
    clock = s.turnDeadline! + 1;
    g.timeoutTurn();
    // the gift went out in full and the turn moved on; nothing is left waiting without a clock
    expect(me.hand.length).toBe(n - 2);
    expect(s.choice).toBeNull();
    expect(s.cur).not.toBe(0);
  });

  it('lets "UNO!" be called only with two cards and one of them playable', () => {
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: false }], rules: { ...DEFAULT_RULES, events: false, uno: true } }, { rng: seeded(3) });
    g.confirmHandover();
    const s = g.s;
    const p = s.players[s.cur];
    const other = (['red', 'yellow', 'green', 'blue'] as const).find(c => c !== s.color)!;
    // a full hand: nothing happens
    g.callUno();
    expect(s.unoCalled).toBe(false);
    // two cards, neither playable: still nothing
    p.hand = [{ id: 9101, color: other, type: 'num', value: 9 === g.top()?.value ? 8 : 9 }, { id: 9102, color: other, type: 'num', value: 9 === g.top()?.value ? 8 : 9 }];
    if (!p.hand.some(c => g.playable(c))) {
      g.callUno();
      expect(s.unoCalled).toBe(false);
    }
    // two cards, one playable: it counts
    p.hand = [{ id: 9103, color: s.color as never, type: 'num', value: 1 }, { id: 9104, color: other, type: 'num', value: 2 }];
    g.callUno();
    expect(s.unoCalled).toBe(true);
  });

  it('settles a +4 challenge both ways', () => {
    for (const guilty of [true, false]) {
      const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: false }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(9) });
      g.confirmHandover();
      const s = g.s;
      const a = s.cur;
      const b = g.nextIdx();
      // A holds a +4 and (maybe) a card of the colour in play
      s.players[a].hand = [
        { id: 9001, color: 'wild', type: 'wild4' },
        { id: 9002, color: guilty ? s.color : (['red', 'yellow', 'green', 'blue'].find(c => c !== s.color) as never), type: 'num', value: 5 },
        { id: 9003, color: (['red', 'yellow', 'green', 'blue'].find(c => c !== s.color) as never), type: 'num', value: 7 },
      ];
      expect(g.play(9001)).toBe(true);
      g.resolveChoice('red');
      g.confirmHandover();
      expect(s.cur).toBe(b);
      expect(s.challenge?.target).toBe(b);
      const aBefore = s.players[a].hand.length;
      const bBefore = s.players[b].hand.length;
      g.challengeWild4();
      if (guilty) {
        expect(s.players[a].hand.length).toBe(aBefore + 4);
        expect(s.pending).toBe(0);
        expect(s.cur).toBe(b);
      } else {
        expect(s.players[b].hand.length).toBe(bBefore + 6);
        expect(s.cur).not.toBe(b);
      }
    }
  });

  it('accepting a +4 with nothing to answer it takes the cards at once', () => {
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: false }], rules: { ...DEFAULT_RULES, events: false, stack: false } }, { rng: seeded(9) });
    g.confirmHandover();
    const s = g.s;
    const a = s.cur;
    const b = g.nextIdx();
    const other = (['red', 'yellow', 'green', 'blue'] as const).find(c => c !== s.color)!;
    s.players[a].hand = [{ id: 9001, color: 'wild', type: 'wild4' }, { id: 9003, color: other, type: 'num', value: 7 }, { id: 9004, color: other, type: 'num', value: 8 }];
    expect(g.play(9001)).toBe(true);
    g.resolveChoice('red');
    g.confirmHandover();
    expect(s.challenge?.target).toBe(b);
    // B holds nothing that could answer a +4
    s.players[b].hand = [{ id: 9010, color: 'blue', type: 'num', value: 3 }, { id: 9011, color: 'green', type: 'num', value: 5 }];
    g.declineChallenge();
    expect(s.players[b].hand.length).toBe(6);
    expect(s.pending).toBe(0);
    expect(s.cur).not.toBe(b);
  });

  it('lets others catch a missing UNO, and the victim save themselves', () => {
    const mk = () => {
      const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: false }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(4) });
      g.confirmHandover();
      const s = g.s;
      s.players[s.cur].hand = [{ id: 9100, color: s.color, type: 'num', value: 3 }, { id: 9101, color: 'wild', type: 'wild' }];
      const victim = s.cur;
      g.play(9100); // no UNO called
      return { g, victim };
    };
    const { g, victim } = mk();
    expect(g.catchable()).toBe(true);
    g.catchUno(victim); // you cannot catch yourself
    expect(g.s.players[victim].hand.length).toBe(1);
    g.catchUno((victim + 1) % 3);
    expect(g.s.players[victim].hand.length).toBe(3);
    expect(g.catchable()).toBe(false);

    const t = mk();
    t.g.lateUno(t.victim);
    expect(t.g.catchable()).toBe(false);
    t.g.catchUno((t.victim + 1) % 3);
    expect(t.g.s.players[t.victim].hand.length).toBe(1);
  });

  it('a person who lets the clock run out draws one card and loses the turn (autopilot off)', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(2), now: () => clock });
    while (g.cp().bot) g.botAct();
    const who = g.s.cur;
    const before = g.cp().hand.length;
    const pile = g.s.discard.length;
    clock += 31_000;
    g.timeoutTurn();
    expect(g.s.cur).not.toBe(who);
    expect(g.s.players[who].hand.length).toBe(before + 1);
    expect(g.s.discard.length).toBe(pile); // nothing was played for them
    expect(g.s.log.at(-1)?.k).toBe('log.timeoutDraw');
  });

  it('a waiting penalty is taken in full when the clock runs out', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(3), now: () => clock });
    while (g.cp().bot) g.botAct();
    const who = g.s.cur;
    const before = g.cp().hand.length;
    g.s.pending = 4;
    g.s.pendingType = 'wild4';
    clock += 31_000;
    g.timeoutTurn();
    expect(g.s.players[who].hand.length).toBe(before + 4);
    expect(g.s.pending).toBe(0);
    expect(g.s.cur).not.toBe(who);
  });

  it('the server can still hand a dropped player to autopilot with the setting off', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(2), now: () => clock });
    while (g.cp().bot) g.botAct();
    clock += 31_000;
    g.timeoutTurn(true);
    expect(g.s.log.some(l => l.k === 'log.autopilot')).toBe(true);
  });

  it('plays the turn for a person whose clock ran out (autopilot on)', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events: false }, table: { ...DEFAULT_TABLE, autopilot: true } }, { rng: seeded(2), now: () => clock });
    while (g.cp().bot) g.botAct();
    const who = g.s.cur;
    expect(g.s.turnDeadline).not.toBeNull();
    clock += 29_000;
    g.timeoutTurn();
    g.checkTimeLimit();
    expect(g.s.cur).toBe(who);
    clock += 2_000;
    g.timeoutTurn();
    g.checkTimeLimit();
    expect(g.s.cur !== who || g.s.phase === 'over').toBe(true);
  });

  it('plays 2v2 with partners opposite, and the team wins together', () => {
    let teamWins = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const n = [4, 6, 8][seed % 3];
      const { g } = simulate(seed, n, DEFAULT_RULES, seed % 2, { ...DEFAULT_TABLE, teams: true });
      expect(g.s.phase).toBe('over');
      expect(g.s.teams).toEqual(Array.from({ length: n }, (_, i) => i % 2));
      expect(g.s.winTeam).toBe(g.s.teams![g.s.winner!]);
      // the punishment never lands on the winning side
      if (g.s.loser !== null) expect(g.s.teams![g.s.loser]).not.toBe(g.s.winTeam);
      teamWins++;
    }
    expect(teamWins).toBe(120);
    // an odd table cannot play teams
    const odd = new Game({ players: Array.from({ length: 5 }, (_, i) => ({ name: `P${i}`, bot: true })), rules: DEFAULT_RULES, table: { ...DEFAULT_TABLE, teams: true } });
    expect(odd.s.teams).toBeNull();
  });

  it('runs a quick round: 5 cards, 15 s turns, and the fewest cards win when time is up', () => {
    let clock = 0;
    const g = new Game(
      { players: [{ name: 'A', bot: false }, { name: 'B', bot: true }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false }, table: { ...DEFAULT_TABLE, quick: true } },
      { rng: seeded(21), now: () => clock },
    );
    expect(g.s.players.every(p => p.hand.length === 5)).toBe(true);
    expect(g.s.table.turnSec).toBe(15);
    expect(g.s.endsAt).toBe(5 * 60_000);
    g.s.players[2].hand.splice(1);
    clock = 5 * 60_000 + 1;
    g.checkTimeLimit();
    expect(g.s.phase).toBe('over');
    expect(g.s.timeUp).toBe(true);
    expect(g.s.winner).toBe(2);
  });

  it('uses the table numbers: hand size, bomb time, UNO penalty', () => {
    const clock = 0;
    const g = new Game(
      { players: [{ name: 'A', bot: false }, { name: 'B', bot: false }, { name: 'C', bot: true }], rules: { ...DEFAULT_RULES, events: false }, table: { ...DEFAULT_TABLE, handSize: 10, bombSec: 5, unoPenalty: 4 } },
      { rng: seeded(4), now: () => clock },
    );
    expect(g.s.players[0].hand.length).toBe(10);
    g.confirmHandover();
    const s = g.s;
    s.players[s.cur].hand = [{ id: 9100, color: s.color, type: 'num', value: 3 }, { id: 9101, color: 'wild', type: 'wild' }];
    const victim = s.cur;
    g.play(9100);
    g.catchUno((victim + 1) % 3);
    expect(s.players[victim].hand.length).toBe(5);
  });

  it('rejects illegal moves and stacks penalties', () => {
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: false }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(7) });
    expect(g.s.phase).toBe('handover');
    expect(g.play(g.cp().hand[0].id)).toBe(false);
    g.confirmHandover();
    expect(g.s.phase).toBe('play');
    const bad = g.cp().hand.find(c => !g.canPlay(c));
    if (bad) expect(g.play(bad.id)).toBe(false);

    g.s.pending = 2;
    g.s.pendingType = 'draw2';
    const before = g.cp().hand.length;
    const who = g.s.cur;
    g.draw();
    expect(g.s.players[who].hand.length).toBe(before + 2);
    expect(g.s.pending).toBe(0);
    expect(g.s.cur).not.toBe(who);
  });

  it('times out a bomb on a human', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(3), now: () => clock });
    while (g.cp().bot) g.botAct();
    // plant a bomb for the human manually
    g.s.bombDeadline = clock + 10_000;
    g.s.timerKind = 'bomb';
    const who = g.s.cur;
    const before = g.s.players[who].hand.length;
    clock += 10_001;
    g.checkBomb();
    expect(g.s.players[who].hand.length).toBe(before + 3);
  });
});
