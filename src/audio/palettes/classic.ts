import type { Palette } from './types';
import { cardSlap, explosion, midi, riffleShuffle, run, shout, slides, thunderRoll } from './common';

/** Classic: a bright game-show stage — crisp card slaps, marimba dings, brass stabs, a studio band. */

// I–V–vi–IV twice, the second time ending on the V to lead back round
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62], [53, 57, 60], [55, 59, 62]];
// a little marimba hook, [step in the 2-bar phrase, note]
const HOOK: [number, number][] = [[0, 72], [3, 74], [6, 76], [10, 79], [14, 76], [16, 74], [19, 72], [22, 74], [26, 67]];

export const classic: Palette = {
  sfx: {
    card: (k, t) => cardSlap(k, t),
    draw: (k, t, n) => slides(k, t, n),
    shuffle: (k, t) => riffleShuffle(k, t),
    skip: (k, t) => {
      // "nope": two knocks and a marimba step down
      k.wood(t, 900, 0.3);
      k.mallet(t + 0.09, midi(79), 0.22, 0.2);
      k.mallet(t + 0.18, midi(72), 0.3, 0.2);
    },
    reverse: (k, t) => run(t, [72, 76, 79, 84, 79, 76], 0.055, (at, f) => k.mallet(at, f, 0.22, 0.16)),
    stack: (k, t, n) => {
      // a brass "dun!" that gets heavier the more cards it costs
      const heavy = Math.min(1, n / 6);
      [48, 55, 60, 64].forEach(m => k.brass(t, midi(m - (heavy > 0.5 ? 2 : 0)), 0.32 + heavy * 0.2, 0.09));
      k.tone(t, 110, 0.18, 0.5, 'sine', 50);
      k.noise(t, 0.12, 'bandpass', 1800, 0.25, 0.8);
    },
    wild: (k, t) => {
      run(t, [67, 69, 72, 74, 76, 79, 81, 84], 0.04, (at, f) => k.mallet(at, f * k.vary(0.1), 0.25, 0.12));
      k.bell(t + 0.34, midi(88), 0.7, 0.07);
    },
    turn: (k, t) => {
      // "your turn": two soft marimba notes going up
      k.mallet(t, midi(76), 0.35, 0.22);
      k.mallet(t + 0.11, midi(83), 0.5, 0.22);
    },
    tick: (k, t) => k.wood(t, 1200 * k.vary(0.3), 0.22),
    hurry: (k, t) => {
      k.wood(t, 1500, 0.24);
      k.wood(t + 0.12, 1500, 0.18);
      k.bell(t, midi(93), 0.15, 0.03);
    },
    bombTick: (k, t) => {
      // an alarm clock: a sharp tick and a tiny bell
      k.wood(t, 2000, 0.2);
      k.bell(t + 0.01, midi(86), 0.12, 0.06);
    },
    click: (k, t) => k.wood(t, 1600, 0.08),
    uno: (k, t) => {
      shout(k, t);
      [84, 88, 91, 96].forEach((n, i) => k.bell(t + 0.3 + i * 0.06, midi(n), 0.7, 0.07));
    },
    caught: (k, t) => {
      // a slide whistle down and a springy "boing"
      k.tone(t, 1300, 0.38, 0.16, 'sine', 380);
      k.tone(t + 0.4, 160, 0.4, 0.3, 'triangle', 380);
      k.tone(t + 0.4, 320, 0.25, 0.08, 'sine', 760);
    },
    penalty: (k, t) => {
      k.brass(t, midi(62), 0.22, 0.12);
      k.brass(t + 0.24, midi(57), 0.5, 0.12);
    },
    challenge: (k, t) => {
      // the judge's gavel twice, then a low dramatic chord
      k.wood(t, 220, 0.5);
      k.wood(t + 0.16, 220, 0.5);
      [48, 55, 60, 63].forEach(n => k.brass(t + 0.32, midi(n), 0.9, 0.06));
    },
    win: (k, t) => {
      // a fanfare: brass pick-up notes into a held chord, bells on top
      ([[67, 0, 0.14], [72, 0.14, 0.14], [76, 0.28, 0.14], [79, 0.42, 0.3], [76, 0.62, 0.12], [79, 0.74, 0.9]] as const).forEach(([n, d, len]) =>
        k.brass(t + d, midi(n), len, 0.13));
      [60, 64, 67].forEach(n => k.brass(t + 0.74, midi(n), 1.0, 0.06));
      [84, 88, 91, 96].forEach((n, i) => k.bell(t + 0.78 + i * 0.07, midi(n), 1.1, 0.06));
    },
    lose: (k, t) => {
      // the gentle "wah wah wah waaah" of a sad trombone
      [62, 61, 60].forEach((n, i) => k.brass(t + i * 0.32, midi(n), 0.3, 0.11));
      k.synth(t + 0.96, midi(59), 0.9, 0.11, { wave: 'sawtooth', detune: 7, cutoff: midi(59) * 2.4, attack: 0.04, release: 0.4, glideTo: midi(57) });
    },
    boom: (k, t) => explosion(k, t),
    thunder: (k, t) => thunderRoll(k, t),
    whoosh: (k, t) => k.noise(t, 0.6, 'bandpass', 350, 0.4, 1.6, 3500),
    whistle: (k, t) => k.tone(t, 1700, 0.62, 0.12, 'sine', 420, 0.03),
    event: (k, t) => {
      // a drum roll into a "ta-da" chime
      for (let i = 0; i < 8; i++) k.noise(t + i * 0.035, 0.04, 'bandpass', 1700, 0.08 + i * 0.02, 0.8);
      k.noise(t + 0.3, 0.3, 'bandpass', 2600, 0.15, 0.7);
      [79, 83, 86, 91].forEach((n, i) => k.bell(t + 0.3 + i * 0.07, midi(n), 0.9, 0.11));
    },
    meteor: (k, t) => {
      k.noise(t, 0.9, 'bandpass', 3200, 0.3, 1.4, 260);
      k.tone(t, 900, 0.9, 0.08, 'sine', 120, 0.1);
    },
    jackpot: (k, t) => {
      // coins: a cascade of bright dings
      for (let i = 0; i < 9; i++) k.bell(t + i * 0.055 + k.jit(0.008), midi(84 + [0, 4, 7, 12, 7, 12, 16, 12, 19][i]), 0.3, 0.06);
      k.brass(t + 0.5, midi(72), 0.5, 0.08);
      k.brass(t + 0.5, midi(76), 0.5, 0.06);
    },
    recolor: (k, t) => {
      // a paint-brush swish and four colour notes
      k.noise(t, 0.35, 'bandpass', 600, 0.25, 1.4, 4000);
      run(t + 0.1, [72, 76, 79, 83], 0.07, (at, f) => k.mallet(at, f, 0.3, 0.14));
    },
    carousel: (k, t) => run(t, [72, 76, 79, 84, 88, 84, 79, 76, 72], 0.06, (at, f) => k.mallet(at, f, 0.25, 0.12)),
  },
  trim: {
    card: 1.15, draw: 1.24, shuffle: 1.35, skip: 0.83, reverse: 0.8, stack: 0.9,
    wild: 0.83, turn: 0.91, tick: 0.92, hurry: 1.04, bombTick: 1.24, click: 0.83,
    caught: 0.88, penalty: 1.17, challenge: 1.17, win: 1.05, lose: 1.42, boom: 0.78,
    thunder: 0.93, whoosh: 1.77, whistle: 0.83, meteor: 1.04, jackpot: 1.36, recolor: 0.92,
  },
  song: {
    bpm: 116,
    stepsPerBar: 16,
    bars: 8,
    level: 0.90,
    step(k, step, t, sd) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 8;
      const chord = CHORDS[bar];
      const root = chord[0];
      // drums: kick, a soft clap, closed hats
      if (s === 0 || s === 8 || s === 10) k.tone(t, 110, 0.16, 0.6, 'sine', 45);
      if (s === 4 || s === 12) k.noise(t, 0.12, 'bandpass', 1500, 0.28, 0.9);
      if (s % 2 === 0) k.noise(t, 0.03, 'highpass', 9000, s % 4 === 2 ? 0.08 : 0.05);
      // bass
      if (s === 0 || s === 6 || s === 8 || s === 14) k.pluck(t, midi(root - 24 + (s === 14 ? 7 : 0)), sd * 2.2, 0.32, 'triangle', 6);
      // offbeat piano-ish stabs
      if (s === 2 || s === 6 || s === 10 || s === 14) chord.forEach(n => k.pluck(t, midi(n), sd * 1.2, 0.05, 'triangle', 4));
      // the hook on odd phrases
      if (bar % 4 < 2) {
        const ph = (bar % 2) * 16 + s;
        for (const [at, n] of HOOK) if (at === ph) k.mallet(t, midi(n), sd * 3, 0.08);
      }
    },
  },
};
