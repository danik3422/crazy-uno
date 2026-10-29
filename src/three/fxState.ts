/**
 * Mutable, render-loop friendly effect clock shared by 3D components.
 * Times are seconds from performance.now(); components read these inside useFrame.
 */
export const fxState = {
  shakeUntil: 0,
  shakeAmp: 0,
  chaosUntil: 0,
  boomAt: -100,
  winAt: -100,
  /** cards whose target changes before this moment wait for it (meteor impact etc.) */
  holdUntil: 0,
  /** hand cards do a double spin (recolor events) */
  spinUntil: 0,
  /** camera rolled upside down */
  upsideUntil: 0,
  /** direction arrows race around (carousel) */
  carouselUntil: 0,
  eventAt: -100,
  /** when the card just played touches the pile (the flash and the ring start then) */
  landAt: -100,
  meteor: { at: -100, target: 0 },
  lightning: { at: -100, target: 0 },
  burst: { at: -100, target: 0 },
  /** where the deck stack is right now, relative to its resting spot (it is shuffled mid-table, then slides over) */
  deckOffset: [0, 0, 0] as [number, number, number],
  /** the deck cards are inside the riffle animation: hide the real top cards meanwhile */
  shuffling: false,
  /** the stack shows its own top (shuffling, or turned another way than its resting angle): real cards on it hide */
  deckHidesTop: false,
  /** opening deal (perf seconds): cards stay in the deck until dealAt, Infinity while the table is loading */
  dealAt: Infinity,
  dealEnd: Infinity,
  /** no big reveal of drawn cards before this (perf seconds): the hands being laid out at the start or after a reconnect are not draws */
  revealFrom: Infinity,
  /** barrel-plane mascot: a swoop across the arena, victory laps, or a bombing run on one player */
  mascot: { at: -100, mode: 'fly' as MascotMode, seed: 0, target: 0 },
  /** bombing run: cards that land in a hand during [at, until) burst out of the explosion instead of leaving the deck */
  drop: { at: -100, until: -100, pos: [0, 4, 0] as [number, number, number] },
  /** the falling bomb: released at `at` from `from`, hits `to` BOMB_FALL seconds later */
  bombFall: { at: -100, from: [0, 0, 0] as [number, number, number], to: [0, 0, 0] as [number, number, number] },
};

export type MascotMode = 'fly' | 'loop' | 'bomber';
export const BOMBER_TIME = 4.2;
/** the plane is right above its target halfway through the run */
export const BOMBER_DROP = BOMBER_TIME / 2;
/** the bomb leaves the plane a moment before it is overhead (it keeps the plane's forward speed) */
export const BOMB_RELEASE = BOMBER_DROP - 0.3;
/** seconds from release to impact */
export const BOMB_FALL = 0.62;

export function summonMascot(mode: MascotMode = 'fly', delay = 0, target = 0) {
  fxState.mascot = { at: nowSec() + delay, mode, seed: Math.random(), target };
}

export const nowSec = () => performance.now() / 1000;

export function shake(amp: number, dur: number) {
  fxState.shakeAmp = amp;
  fxState.shakeUntil = nowSec() + dur;
}

export const METEOR_FALL = 0.9;
export const SPIN_TIME = 1.3;

/** dev builds, or any build opened with ?debug: the game, effects and renderer are reachable from the console */
export const DEBUG = import.meta.env.DEV || (typeof location !== 'undefined' && /[?&]debug\b/.test(location.search));
if (DEBUG && typeof window !== 'undefined') (window as unknown as { __fx: typeof fxState }).__fx = fxState;
