import { describe, expect, it } from 'vitest';
import { PRESETS } from '../../../game/content';
import { Game } from '../../../game/engine';
import type { Card, CardType, Rules } from '../../../game/types';
import { detect, snap, type PlayTrigger, type ResolveTrigger } from './detect';

const rulesOf = (id: string): Rules => PRESETS.find(p => p.id === id)!.rules;

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function game(rules: Rules, players = 4) {
  const g = new Game({ players: Array.from({ length: players }, (_, i) => ({ name: `P${i}`, bot: true })), rules: { ...rules, events: false }, online: true }, { rng: seeded(3) });
  g.s.phase = 'play';
  return g;
}

let nextId = 50_000;
const card = (type: CardType, color: Card['color'], value?: number): Card => ({ id: nextId++, type, color, value });

/** plays `c` for the current player and returns what the effects layer would see */
function playAndDetect(g: Game, c: Card) {
  g.cp().hand.push(c);
  const before = snap(g.s);
  g.play(c.id);
  return { before, out: detect(before, g.s, (f, s) => g.nextIdx(f, s)) };
}

describe('card effect detection', () => {
  it('leaves knocked-out players out of every effect', () => {
    for (const c of [() => card('num', 'red', 0), () => card('skipAll', 'red')]) {
      const g = game({ ...rulesOf('nomercy'), sevenZero: true });
      g.s.color = 'red';
      g.s.discard.push(card('num', 'red', 5));
      const gone = g.nextIdx(g.s.cur);
      g.s.players[gone].out = 1;
      g.s.players[gone].hand = [];
      const { out } = playAndDetect(g, c());
      const t = out.find(x => x.kind === 'play') as PlayTrigger;
      expect(t.targets.length).toBeGreaterThan(0);
      expect(t.targets).not.toContain(gone);
    }
  });

  it('aims a skip at the player who misses the turn', () => {
    const g = game(rulesOf('classic'));
    const actor = g.s.cur;
    const victim = g.nextIdx(actor);
    const { out } = playAndDetect(g, card('skip', g.s.color));
    expect(out).toHaveLength(1);
    const t = out[0] as PlayTrigger;
    expect(t.card.type).toBe('skip');
    expect(t.actor).toBe(actor);
    expect(t.targets).toEqual([victim]);
  });

  it('sends a +2 at whoever has to answer it', () => {
    const g = game(rulesOf('classic'));
    const { out } = playAndDetect(g, card('draw2', g.s.color));
    const t = out[0] as PlayTrigger;
    expect(t.n).toBe(2);
    expect(t.targets).toEqual([g.s.cur]);
  });

  it('waits for the colour of a wild +4, then aims it at the victim', () => {
    const g = game(rulesOf('classic'));
    const { out } = playAndDetect(g, card('wild4', 'wild'));
    const t = out[0] as PlayTrigger;
    expect(t.waits).toBe(true);
    expect(t.n).toBe(4);
    const before = snap(g.s);
    g.resolveChoice('blue');
    const r = detect(before, g.s, (f, s) => g.nextIdx(f, s));
    expect(r).toHaveLength(1);
    const res = r[0] as ResolveTrigger;
    expect(res.kind).toBe('resolve');
    expect(res.color).toBe('blue');
    expect(res.targets).toEqual([g.s.cur]);
  });

  it('skips everyone else with skip all', () => {
    const g = game(rulesOf('nomercy'));
    const actor = g.s.cur;
    const { out } = playAndDetect(g, card('skipAll', g.s.color));
    const t = out[0] as PlayTrigger;
    expect(t.targets).toHaveLength(3);
    expect(t.targets).not.toContain(actor);
  });

  it('finds the swap partner from the hands that changed', () => {
    const g = game(rulesOf('party'));
    const actor = g.s.cur;
    playAndDetect(g, card('swap', g.s.color));
    const partner = (actor + 2) % 4;
    g.s.players[partner].hand.push(card('num', 'red', 3));
    const before = snap(g.s);
    g.resolveChoice(partner);
    const r = detect(before, g.s, (f, s) => g.nextIdx(f, s))[0] as ResolveTrigger;
    expect(r.targets).toEqual([partner]);
  });

  it('counts the cards a discard-all throws away', () => {
    const g = game(rulesOf('nomercy'));
    const col = g.s.color;
    g.cp().hand = g.cp().hand.filter(c => c.color !== col);
    g.cp().hand.push(card('num', col, 1), card('num', col, 2), card('num', col, 3));
    const { out } = playAndDetect(g, card('discardAll', col));
    expect((out[0] as PlayTrigger).n).toBe(3);
  });

  it('shows nothing for a plain number card', () => {
    const g = game({ ...rulesOf('classic'), sevenZero: false });
    const { out } = playAndDetect(g, card('num', g.s.color, 5));
    expect(out).toEqual([]);
  });
});

describe('penalty hit', () => {
  it('lands on whoever finally draws the stacked penalty', () => {
    const g = game(rulesOf('classic'));
    playAndDetect(g, card('draw2', g.s.color));
    const victim = g.s.cur;
    const before = snap(g.s);
    g.draw();
    const out = detect(before, g.s, (f, s) => g.nextIdx(f, s));
    expect(out).toContainEqual({ kind: 'take', target: victim, n: 2 });
  });

  it('is not set off by an ordinary draw', () => {
    const g = game(rulesOf('classic'));
    const before = snap(g.s);
    g.draw();
    expect(detect(before, g.s, (f, s) => g.nextIdx(f, s)).filter(t => t.kind === 'take')).toEqual([]);
  });
});
