/**
 * Small JSON wrappers around localStorage. Storage can be missing or blocked
 * (private mode, sandboxed frames), so reads fall back to null and writes are best effort.
 */

/** Every key the app keeps in localStorage, in one place. */
export const STORAGE_KEYS = {
  /** online room code + seat token, to get back in after a reload */
  session: 'crazy-uno-session',
  /** the room this browser was kicked from, with its old seat token: the server turns that token away */
  kicked: 'crazy-uno-kicked',
  name: 'crazy-uno-name',
  avatar: 'crazy-uno-avatar',
  /** players, rules, table and theme of the last local (one device) game */
  localSetup: 'crazy-uno-cfg-v2',
  sound: 'crazy-uno-sound',
  haptics: 'crazy-uno-haptics',
  /** the player's own record and achievements (game/stats.ts) */
  stats: 'crazy-uno-stats',
  /** a local game in progress, to carry on after a reload (app/storage/localSave.ts) */
  localGame: 'crazy-uno-local-game',
  /** which tutorials (classic, No Mercy) were played or skipped (ui/tutorial) */
  tutorial: 'crazy-uno-tutorial',
} as const;

export function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

/** Saves `value` as JSON; `null` removes the key. */
export function writeJson(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the value just won't survive a reload */
  }
}
