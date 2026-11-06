/*
 * Debug hooks: in dev builds, or any build opened with ?debug, the game, the effects and the renderer are reachable
 * from the browser console (and the end-to-end check scripts use them). In a normal build these do nothing.
 *
 *   window.__uno        the running game          window.__fx      the effect clock (three/effects/fxState)
 *   window.__fit()      on-screen card rectangles window.__van     the knock-out scene being played
 *   window.__vanT = 3.5 pins that scene at 3.5 s  window.__vanVariant = 'flop'  forces how the next player is taken
 *   window.__crash = 'hud' | '3d'  that part throws on its next render (to see the crash card)
 *   window.__knock('all' | 'one')  knocks bots out (online: on the dev server only)
 */

export const DEBUG = import.meta.env.DEV || (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search));

type Hooks = Record<string, unknown>;
const hooks = (): Hooks | null => (typeof window === 'undefined' ? null : (window as unknown as Hooks));

/** Puts `value` on window as `name` (debug only). */
export function exposeDebug(name: string, value: unknown) {
  const w = DEBUG ? hooks() : null;
  if (w) w[name] = value;
}

/** A value set from the console as `window[name]` (debug only), or undefined. */
export function debugValue<T>(name: string): T | undefined {
  return DEBUG ? (hooks()?.[name] as T | undefined) : undefined;
}

/**
 * `window.__crash = 'hud' | '3d'` makes that part throw on its next render, to try the crash card.
 * The flag clears itself, so "Continue" brings the screen back.
 */
export function crashProbe(where: 'hud' | '3d') {
  if (!DEBUG) return;
  const w = window as unknown as { __crash?: string; __crashUntil?: number };
  if (w.__crash !== where) return;
  // React retries a broken render before giving up: keep failing for a moment, like a real bug would
  w.__crashUntil ??= performance.now() + 300;
  if (performance.now() > w.__crashUntil) {
    delete w.__crash;
    delete w.__crashUntil;
    return;
  }
  throw new Error(`test crash in ${where}`);
}
