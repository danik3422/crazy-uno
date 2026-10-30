import type { Kit } from '../kit';

/** Every gameplay sound. Each table's palette has its own version of all of them. */
export const SFX_IDS = [
  // cards
  'card', 'draw', 'shuffle', 'skip', 'reverse', 'stack', 'wild',
  // turns and clocks
  'turn', 'tick', 'hurry', 'bombTick', 'click',
  // calls and verdicts
  'uno', 'caught', 'penalty', 'challenge', 'win', 'lose',
  // effects and event stingers
  'boom', 'thunder', 'whoosh', 'whistle', 'event', 'meteor', 'jackpot', 'recolor', 'carousel',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

/**
 * Writes one sound into `k.out`, starting at context time `t`.
 * `count` is how many of it (cards drawn); most sounds ignore it.
 */
export type SfxFn = (k: Kit, t: number, count: number) => void;

/** A music loop: called for every 16th-note step, schedules that step's notes into `k.out`. */
export interface Song {
  bpm: number;
  /** 16th steps in a bar (16 for 4/4, 12 for a waltz) */
  stepsPerBar: number;
  /** bars before the loop starts over */
  bars: number;
  /** level of this song on the music bus (they are normalised to sound equally loud) */
  level: number;
  step(k: Kit, step: number, t: number, stepDur: number): void;
}

export interface Palette {
  sfx: Record<SfxId, SfxFn>;
  /** per-sound trims (linear gain), measured so each sound is about as loud as on the other tables */
  trim?: Partial<Record<SfxId, number>>;
  song: Song;
}
