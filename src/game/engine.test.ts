import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, EVENTS } from './content';
import { Game } from './engine';
import type { EventId, Rules } from './types';

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
function simulate(seed: number, n: number, rules: Rules, humans = 0) {
  let clock = 0;
  const rnd = seeded(seed * 7 + 1);
  const g = new Game(
    { players: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, bot: i >= humans })), rules },
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
    steps++;
    expect(g.totalCards()).toBe(total);
    const ids = new Set([...g.s.deck, ...g.s.discard, ...g.s.players.flatMap(p => p.hand)].map(c => c.id));
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
        { id: 9003, color: 'wild', type: 'wild' },
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

  it('plays the turn for a person whose clock ran out', () => {
    let clock = 0;
    const g = new Game({ players: [{ name: 'A', bot: false }, { name: 'B', bot: true }], rules: { ...DEFAULT_RULES, events: false } }, { rng: seeded(2), now: () => clock });
    while (g.cp().bot) g.botAct();
    const who = g.s.cur;
    expect(g.s.turnDeadline).not.toBeNull();
    clock += 29_000;
    g.timeoutTurn();
    expect(g.s.cur).toBe(who);
    clock += 2_000;
    g.timeoutTurn();
    expect(g.s.cur !== who || g.s.phase === 'over').toBe(true);
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
