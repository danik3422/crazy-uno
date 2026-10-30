import type { Kit } from '../kit';
import { midi } from '../kit';
import { shoutUno } from '../voice';

/**
 * Recipes shared by several tables, with knobs for each table's colour.
 * A table's palette mixes these with its own sounds.
 */

export { midi };

/** A card laid on the table: a papery snap and a soft thud. `tone` = brightness of the snap. */
export function cardSlap(k: Kit, t: number, o: { snap?: number; thud?: number; level?: number } = {}) {
  const v = k.vary(1.5);
  const lv = o.level ?? 1;
  const snap = (o.snap ?? 2300) * v;
  k.noise(t, 0.07, 'bandpass', snap, 0.45 * lv, 0.8, snap * 0.52);
  k.noise(t, 0.05, 'lowpass', 500, 0.3 * lv, 0.7);
  k.tone(t, (o.thud ?? 120) * v, 0.07, 0.3 * lv, 'sine', (o.thud ?? 120) * 0.5);
}

/** One soft slide per card, in step with the cards leaving the deck. */
export function slides(k: Kit, t: number, count: number, o: { from?: number; to?: number; gap?: number; level?: number } = {}, extra?: (at: number, i: number) => void) {
  const n = Math.max(1, Math.min(count, 12));
  for (let i = 0; i < n; i++) {
    const v = k.vary(2);
    const at = t + i * (o.gap ?? 0.16) + k.jit(0.006) + 0.006;
    k.noise(at, 0.12, 'bandpass', (o.from ?? 1500) * v, 0.26 * (o.level ?? 1), 0.9, (o.to ?? 3800) * v);
    extra?.(at, i);
  }
}

/** A riffle shuffle: quick paper clicks that speed up, then the deck squared on the table. */
export function riffleShuffle(k: Kit, t: number, o: { click?: number; level?: number } = {}) {
  const lv = o.level ?? 1;
  k.riffle(t + 0.01, 0.65, 16, at => k.noise(at, 0.03, 'bandpass', ((o.click ?? 2400) + Math.random() * 900) * k.vary(1), 0.22 * lv, 1));
  k.noise(t + 0.73, 0.09, 'lowpass', 900, 0.4 * lv, 0.8);
  k.tone(t + 0.73, 110, 0.07, 0.25 * lv, 'sine', 70);
}

/** An explosion: a falling roar and a deep thump. `dark` lowers it. */
export function explosion(k: Kit, t: number, o: { dark?: number; level?: number; long?: number } = {}) {
  const d = o.dark ?? 1;
  const lv = o.level ?? 1;
  const len = o.long ?? 1;
  k.noise(t, 1.3 * len, 'lowpass', 800 / d, 0.9 * lv, 0.7, 70);
  k.tone(t, 85 / d, 0.9 * len, 0.85 * lv, 'sine', 30);
}

/** Thunder: a crack and a long rolling rumble. */
export function thunderRoll(k: Kit, t: number, o: { crack?: number; level?: number } = {}) {
  const lv = o.level ?? 1;
  k.noise(t, 0.2, 'highpass', o.crack ?? 2500, 0.4 * lv, 0.7);
  k.noise(t + 0.05, 1.8, 'lowpass', 500, 0.85 * lv, 0.5, 60);
  k.tone(t + 0.05, 65, 1.2, 0.5 * lv, 'sine', 30);
}

/** The shouted "UNO!"; returns when the shout ends. The table adds its own sparkle on top. */
export function shout(k: Kit, t: number): number {
  const end = shoutUno(k.ctx, k.out, t, k.noiseBuf);
  k.hold(t, end + 0.12);
  return end;
}

/** Notes of a chord in a quick run. */
export function run(t: number, notes: number[], gap: number, f: (at: number, freq: number, i: number) => void) {
  notes.forEach((n, i) => f(t + i * gap, midi(n), i));
}
