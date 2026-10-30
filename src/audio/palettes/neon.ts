import type { Palette } from './types';
import { explosion, midi, run, shout } from './common';

/** Neon: a synthwave club — synth plucks, arpeggios, bit-crushed zaps, gated snares. */

// A minor: Am – F – C – G, then Am – F – G – E
const CHORDS = [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]];
/** A minor pentatonic, for notes picked at random */
const SCALE = [57, 60, 62, 64, 67, 69, 72];
const pick = () => SCALE[Math.floor(Math.random() * SCALE.length)];

export const neon: Palette = {
  sfx: {
    card: (k, t) => {
      // a short filtered pluck on a random note of the scale, and a tight snap
      k.pluck(t, midi(pick()), 0.16, 0.2, 'sawtooth', 6);
      k.noise(t, 0.04, 'highpass', 3500 * k.vary(2), 0.3, 0.8);
      k.tone(t, 140 * k.vary(1), 0.08, 0.3, 'sine', 55);
    },
    draw: (k, t, n) => {
      for (let i = 0; i < Math.max(1, Math.min(n, 12)); i++) {
        const at = t + i * 0.16 + 0.005;
        k.noise(at, 0.1, 'bandpass', 900 * k.vary(2), 0.2, 3, 5000);
        k.tone(at + 0.06, midi(81 + (i % 3) * 3), 0.05, 0.05, 'square');
      }
    },
    shuffle: (k, t) => {
      k.riffle(t + 0.01, 0.65, 16, (at, i) => k.pluck(at, midi(SCALE[i % SCALE.length] + 12), 0.06, 0.06, 'square', 5));
      k.noise(t, 0.7, 'bandpass', 500, 0.12, 4, 6000);
      k.tone(t + 0.73, 120, 0.1, 0.4, 'sine', 50);
    },
    skip: (k, t) => {
      k.zap(t, 1400 * k.vary(1), 180, 0.2, 0.12);
      k.zap(t + 0.12, 900, 140, 0.18, 0.08);
    },
    reverse: (k, t) => {
      // a reversed swell that snaps off, and an arp that turns round
      k.noise(t, 0.28, 'bandpass', 5000, 0.2, 2, 600, 0.26);
      run(t + 0.05, [69, 72, 76, 81, 76, 72], 0.045, (at, f) => k.pluck(at, f, 0.12, 0.1, 'sawtooth', 5));
    },
    stack: (k, t, n) => {
      const heavy = Math.min(1, n / 6);
      k.tone(t, 160, 0.4 + heavy * 0.2, 0.6, 'sine', 40);
      [45, 52, 57, 60].forEach(m => k.synth(t, midi(m), 0.3 + heavy * 0.15, 0.06, { detune: 12, cutoff: 900, open: 3, attack: 0.005, release: 0.2 }));
      k.zap(t, 600, 60, 0.25, 0.06);
    },
    wild: (k, t) => {
      run(t, [57, 60, 64, 67, 69, 72, 76, 79, 81], 0.035, (at, f) => k.pluck(at, f, 0.18, 0.09, 'sawtooth', 7));
      k.noise(t, 0.4, 'bandpass', 600, 0.12, 5, 8000);
    },
    turn: (k, t) => {
      // two square plucks with a dotted echo
      [0, 0.18].forEach((d, e) => {
        const lv = e ? 0.35 : 1;
        k.pluck(t + d, midi(76), 0.18, 0.14 * lv, 'square', 6);
        k.pluck(t + d + 0.09, midi(83), 0.25, 0.14 * lv, 'square', 6);
      });
    },
    tick: (k, t) => {
      k.tone(t, 1800 * k.vary(0.3), 0.025, 0.14, 'square', undefined, 0.001);
      k.noise(t, 0.02, 'highpass', 8000, 0.1);
    },
    hurry: (k, t) => {
      k.tone(t, 2200, 0.03, 0.14, 'square', undefined, 0.001);
      k.tone(t + 0.1, 2200, 0.03, 0.12, 'square', undefined, 0.001);
    },
    bombTick: (k, t) => {
      k.zap(t, 420, 380, 0.07, 0.16);
      k.tone(t, 60, 0.1, 0.3, 'sine');
    },
    click: (k, t) => k.tone(t, 2400, 0.015, 0.06, 'square', undefined, 0.001),
    uno: (k, t) => {
      shout(k, t);
      run(t + 0.3, [81, 84, 88, 93], 0.05, (at, f) => k.pluck(at, f, 0.3, 0.06, 'square', 6));
    },
    caught: (k, t) => {
      k.zap(t, 2000, 200, 0.35, 0.1);
      k.synth(t + 0.38, 140, 0.4, 0.14, { wave: 'sawtooth', detune: 10, cutoff: 900, glideTo: 380, attack: 0.005, release: 0.2 });
    },
    penalty: (k, t) => {
      k.synth(t, midi(62), 0.22, 0.12, { detune: 10, cutoff: 1200, open: 2, attack: 0.01 });
      k.synth(t + 0.24, midi(57), 0.5, 0.12, { detune: 10, cutoff: 1200, open: 2, attack: 0.01, glideTo: midi(55) });
    },
    challenge: (k, t) => {
      k.noise(t, 0.12, 'bandpass', 1600, 0.4, 0.8);
      k.noise(t + 0.16, 0.12, 'bandpass', 1600, 0.4, 0.8);
      [45, 52, 57, 60].forEach(n => k.synth(t + 0.32, midi(n), 0.9, 0.06, { detune: 12, cutoff: 700, open: 2.5, attack: 0.01, release: 0.5 }));
    },
    win: (k, t) => {
      // a synthwave fanfare: rising arp into a big detuned chord
      run(t, [57, 60, 64, 69, 72, 76, 81], 0.06, (at, f) => k.pluck(at, f, 0.25, 0.09, 'sawtooth', 6));
      [57, 64, 69, 72, 76].forEach(n => k.synth(t + 0.45, midi(n), 1.3, 0.06, { detune: 14, cutoff: 1800, open: 2, attack: 0.02, release: 0.8 }));
      k.tone(t + 0.45, midi(33), 1.0, 0.3, 'triangle');
      run(t + 0.5, [88, 93, 96], 0.08, (at, f) => k.pluck(at, f, 0.4, 0.04, 'square', 4));
    },
    lose: (k, t) => {
      // a tape stop: the chord sags an octave as the machine winds down
      [57, 60, 64].forEach(n => k.synth(t, midi(n), 1.1, 0.07, { detune: 10, cutoff: 1500, glideTo: midi(n - 12), attack: 0.01, release: 0.5 }));
      k.tone(t, midi(45), 1.1, 0.2, 'triangle', midi(33));
    },
    boom: (k, t) => {
      explosion(k, t);
      k.zap(t, 300, 40, 0.5, 0.08);
    },
    thunder: (k, t) => {
      k.zap(t, 3000, 200, 0.15, 0.08);
      k.noise(t + 0.05, 1.6, 'lowpass', 600, 0.8, 0.5, 60);
      k.tone(t + 0.05, 65, 1.2, 0.5, 'sine', 30);
    },
    whoosh: (k, t) => k.noise(t, 0.6, 'bandpass', 300, 0.35, 5, 7000),
    whistle: (k, t) => k.zap(t, 1700, 420, 0.62, 0.06),
    event: (k, t) => {
      // a resonant riser into a chord stab
      k.noise(t, 0.35, 'bandpass', 400, 0.2, 6, 6000, 0.3);
      [57, 64, 69, 72, 76].forEach(n => k.pluck(t + 0.36, midi(n), 0.6, 0.06, 'sawtooth', 5));
      k.tone(t + 0.36, 120, 0.15, 0.4, 'sine', 45);
    },
    meteor: (k, t) => {
      k.noise(t, 0.9, 'bandpass', 6000, 0.25, 5, 200);
      k.tone(t, 800, 0.9, 0.05, 'square', 80, 0.1);
    },
    jackpot: (k, t) => {
      // 8-bit coins
      for (let i = 0; i < 3; i++) {
        k.zap(t + i * 0.14, midi(83), midi(83), 0.05, 0.07);
        k.zap(t + i * 0.14 + 0.05, midi(88), midi(88), 0.12, 0.07);
      }
      k.pluck(t + 0.45, midi(81), 0.5, 0.1, 'sawtooth', 6);
    },
    recolor: (k, t) => {
      k.noise(t, 0.4, 'bandpass', 300, 0.18, 6, 5000);
      run(t + 0.08, [64, 67, 71, 74], 0.07, (at, f) => k.pluck(at, f, 0.22, 0.11, 'square', 5));
    },
    carousel: (k, t) => run(t, [57, 64, 69, 76, 81, 76, 69, 64, 57], 0.06, (at, f) => k.pluck(at, f, 0.18, 0.1, 'sawtooth', 6)),
  },
  trim: {
    card: 0.85, draw: 1.78, shuffle: 0.76, skip: 1.51, reverse: 1.69, stack: 0.56,
    wild: 1.72, turn: 1.45, tick: 1.45, hurry: 1.86, bombTick: 0.6, click: 1.6,
    caught: 1.21, penalty: 1.19, challenge: 1.23, win: 0.76, lose: 0.71, boom: 0.74,
    thunder: 0.93, whoosh: 3.82, whistle: 1.37, event: 0.84, meteor: 1.48, jackpot: 1.7,
    recolor: 1.06, carousel: 1.94,
  },
  song: {
    bpm: 108,
    stepsPerBar: 16,
    bars: 8,
    level: 0.79,
    step(k, step, t, sd) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 8;
      const chord = CHORDS[bar];
      // four on the floor, offbeat hats, a gated snare
      if (s % 4 === 0) k.tone(t, 120, 0.2, 0.6, 'sine', 42);
      if (s % 4 === 2) k.noise(t, 0.04, 'highpass', 8000, 0.08);
      if (s === 4 || s === 12) {
        k.noise(t, 0.18, 'bandpass', 1800, 0.25, 0.8);
        k.noise(t, 0.22, 'lowpass', 3000, 0.08, 0.5);
      }
      // octave bass in eighths
      if (s % 2 === 0) k.pluck(t, midi(chord[0] - 24 + (s % 4 === 2 ? 12 : 0)), sd * 1.6, 0.22, 'sawtooth', 3);
      // the arp: up the chord, an octave above on alternate beats
      const n = chord[step % 3] + (Math.floor(s / 4) % 2 ? 12 : 0);
      k.pluck(t, midi(n + 12), sd * 0.9, 0.035, 'sawtooth', 5);
      // a warm pad that breathes over each bar
      if (s === 0) chord.forEach(m => k.synth(t, midi(m), sd * 16.5, 0.03, { detune: 12, cutoff: 1100, attack: sd * 4, release: sd * 6 }));
    },
  },
};
