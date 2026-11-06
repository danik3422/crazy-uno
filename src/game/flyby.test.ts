import { describe, expect, it } from 'vitest';
import { PRESETS } from './content';
import { Game } from './engine/Game';

function seeded(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** plays a bots-only game for a while and lists the mascot fly-bys it called for */
function flybys(seed: number) {
  const rules = PRESETS.find(p => p.id === 'party')!.rules;
  const g = new Game({ players: Array.from({ length: 4 }, (_, i) => ({ name: `P${i}`, bot: true })), rules, online: true }, { rng: seeded(seed) });
  const seen: string[] = [];
  let last = 0;
  for (let k = 0; k < 3000 && g.s.phase !== 'over'; k++) {
    g.botAct();
    for (const f of g.s.fx) if (f.id > last) { last = f.id; if (f.kind === 'flyby') seen.push(`${g.s.turn}:${f.seed}`); }
  }
  return seen;
}

describe('mascot fly-bys', () => {
  it('are decided by the game, so every screen gets the same flight', () => {
    const a = flybys(7);
    expect(a.length).toBeGreaterThan(0);
    expect(a).toEqual(flybys(7));
    for (const x of a) expect(Number(x.split(':')[1])).toBeLessThan(1000);
  });
});
