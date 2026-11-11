import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_RULES } from '../../game/content';
import { Game } from '../../game/engine/Game';
import { seededRng } from '../../game/random';
import { STORAGE_KEYS } from '../../lib/storage';
import { clearLocalSave, describeSave, readLocalSave, resumeLocal, writeLocalSave } from './localSave';

/** a localStorage for the node test environment */
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}

let store: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
});
afterEach(() => vi.unstubAllGlobals());

const newGame = () => new Game({ players: [{ name: 'Me', bot: false }, { name: 'Bot', bot: true }], rules: DEFAULT_RULES }, { rng: seededRng(0.7) });
const raw = () => JSON.parse(store.getItem(STORAGE_KEYS.localGame)!);
const put = (v: unknown) => store.setItem(STORAGE_KEYS.localGame, typeof v === 'string' ? v : JSON.stringify(v));

describe('the local game kept on the device', () => {
  it('saves, reads back and resumes the same game', () => {
    const g = newGame();
    writeLocalSave(g, { Me: 2 });
    const f = readLocalSave()!;
    expect(f.score).toEqual({ Me: 2 });
    expect(describeSave(f)).toEqual({ round: g.s.round, players: 2, cards: g.s.players[0].hand.length });
    const back = resumeLocal(f)!;
    expect(back.s.players.map(p => p.hand.map(c => c.id))).toEqual(g.s.players.map(p => p.hand.map(c => c.id)));
    expect(back.totalCards()).toBe(g.totalCards());
  });

  it('ignores anything it cannot use', () => {
    const g = newGame();
    writeLocalSave(g, {});
    const good = raw();
    put('{broken json');
    expect(readLocalSave()).toBeNull();
    put({ ...good, game: { ...good.game, v: 2 } });
    expect(readLocalSave()).toBeNull();
    put({ ...good, game: { ...good.game, s: { ...good.game.s, players: null } } });
    expect(readLocalSave()).toBeNull();
    put({ ...good, game: { ...good.game, s: { ...good.game.s, phase: 'over' } } });
    expect(readLocalSave()).toBeNull();
    put({ ...good, game: { ...good.game, savedAt: Date.now() - 4 * 24 * 60 * 60_000 } });
    expect(readLocalSave()).toBeNull();
    // a save without a time is not taken for a fresh one
    put({ ...good, game: { ...good.game, savedAt: undefined } });
    expect(readLocalSave()).toBeNull();
    // a broken score is replaced, the game is kept
    put({ ...good, score: 'oops' });
    expect(readLocalSave()!.score).toEqual({});
  });

  it('drops a save that cannot be resumed instead of failing on every start', () => {
    writeLocalSave(newGame(), {});
    const f = readLocalSave()!;
    const broken = { ...f, game: { ...f.game, s: { ...f.game.s, deck: null, discard: null } } } as never;
    expect(resumeLocal(broken)).toBeNull();
    expect(store.getItem(STORAGE_KEYS.localGame)).toBeNull();
    clearLocalSave();
  });
});
