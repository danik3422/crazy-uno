import { Game, type GameSave } from '../../game/engine/Game';
import { STORAGE_KEYS, readJson, writeJson } from '../../lib/storage';

/** A local game in progress and the evening's score, kept on the device so a reload does not lose them. */
interface SaveFile {
  game: GameSave;
  score: Record<string, number>;
}

/** a save older than this is a game nobody is coming back to */
const MAX_AGE_MS = 3 * 24 * 60 * 60_000;

export function readLocalSave(): SaveFile | null {
  const f = readJson<SaveFile>(STORAGE_KEYS.localGame);
  const g = f?.game;
  if (!g || g.v !== 1 || !g.s || !Array.isArray(g.s.players) || g.s.phase === 'over' || Date.now() - g.savedAt > MAX_AGE_MS) return null;
  return { game: g, score: f.score && typeof f.score === 'object' ? f.score : {} };
}

export function writeLocalSave(game: Game, score: Record<string, number>) {
  writeJson(STORAGE_KEYS.localGame, { game: game.toSave(), score } satisfies SaveFile);
}

export function clearLocalSave() {
  writeJson(STORAGE_KEYS.localGame, null);
}

/** What the home screen says about a saved game: which round, how many players and how many cards you hold. */
export function describeSave(f: SaveFile) {
  const s = f.game.s;
  const me = s.players.findIndex(p => !p.bot);
  return { round: s.round, players: s.players.length, cards: me >= 0 ? s.players[me].hand.length : null };
}

/** Back into a saved game (null if it cannot be read). */
export function resumeLocal(f: SaveFile): Game | null {
  try {
    return Game.resume(f.game);
  } catch {
    clearLocalSave();
    return null;
  }
}
