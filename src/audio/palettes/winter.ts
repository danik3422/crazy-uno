import type { Palette } from './types';
import { cardSlap, explosion, midi, riffleShuffle, run, shout, slides } from './common';

/** Winter: a cosy snowy evening — sleigh bells, soft crunchy snow, glassy ice chimes, a warm celesta. */

// a gentle waltz in F: F – Dm – Bb – C, then F – Am – Gm7 – C7
const CHORDS = [[41, 57, 60, 65], [38, 57, 62, 65], [46, 58, 62, 65], [48, 55, 60, 64], [41, 57, 60, 65], [45, 57, 60, 64], [43, 58, 62, 65], [48, 58, 60, 64]];
// the celesta tune, [step in the 4-bar phrase (12 per bar), note]
const TUNE: [number, number][] = [[0, 77], [4, 76], [8, 77], [12, 81], [20, 79], [24, 82], [28, 81], [32, 79], [36, 77], [40, 76], [44, 72]];

/** a glassy ice chime (FM with a non-integer ratio rings like glass) */
const ice = (k: Parameters<Palette['sfx']['card']>[0], at: number, f: number, dur: number, peak: number) => k.fm(at, f, dur, peak, 3.53, 0.9, dur * 0.4);

export const winter: Palette = {
  sfx: {
    card: (k, t) => {
      // a card dropped on a soft wool cloth, with a dusting of snow
      cardSlap(k, t, { snap: 1900, thud: 110, level: 0.85 });
      k.crunch(t, 0.06, 0.07, 2600);
    },
    draw: (k, t, n) => slides(k, t, n, { from: 1300, to: 3200 }, (at, i) => {
      if (i === 0) k.jingle(at + 0.04, 0.12);
    }),
    shuffle: (k, t) => {
      riffleShuffle(k, t, { click: 2200 });
      k.jingle(t + 0.74, 0.18);
    },
    skip: (k, t) => {
      ice(k, t, midi(88), 0.25, 0.14);
      ice(k, t + 0.09, midi(81), 0.35, 0.14);
    },
    reverse: (k, t) => run(t, [77, 81, 84, 89, 84, 81], 0.055, (at, f) => ice(k, at, f, 0.25, 0.1)),
    stack: (k, t, n) => {
      // a snowball thump and a low, warm chord
      const heavy = Math.min(1, n / 6);
      k.crunch(t, 0.18, 0.3, 900);
      k.tone(t, 95, 0.22 + heavy * 0.15, 0.55, 'sine', 45);
      [53, 60, 65].forEach(m => k.celesta(t, midi(m - (heavy > 0.5 ? 2 : 0)), 0.5, 0.06));
    },
    wild: (k, t) => {
      run(t, [65, 69, 72, 77, 81, 84, 89], 0.045, (at, f) => k.celesta(at, f, 0.5, 0.08));
      k.jingle(t + 0.3, 0.14);
    },
    turn: (k, t) => {
      k.celesta(t, midi(77), 0.55, 0.18);
      k.celesta(t + 0.12, midi(84), 0.7, 0.17);
    },
    tick: (k, t) => ice(k, t, 2100 * k.vary(0.3), 0.06, 0.16),
    hurry: (k, t) => {
      ice(k, t, 2600, 0.06, 0.16);
      ice(k, t + 0.1, 2600, 0.06, 0.13);
    },
    bombTick: (k, t) => {
      k.wood(t, 650, 0.22);
      k.bell(t + 0.01, midi(84), 0.18, 0.05);
    },
    click: (k, t) => ice(k, t, 2600, 0.04, 0.06),
    uno: (k, t) => {
      shout(k, t);
      k.jingle(t + 0.3, 0.16);
      k.jingle(t + 0.45, 0.12);
      run(t + 0.32, [84, 89, 93], 0.07, (at, f) => k.celesta(at, f, 0.6, 0.05));
    },
    caught: (k, t) => {
      // slipping on the ice, and a soft landing in a drift
      k.fm(t, 1600, 0.4, 0.12, 3.53, 0.6, 0.3, 380);
      k.crunch(t + 0.42, 0.22, 0.3, 1000);
      k.tone(t + 0.42, 140, 0.2, 0.3, 'sine', 70);
    },
    penalty: (k, t) => {
      k.celesta(t, midi(70), 0.3, 0.16);
      k.celesta(t + 0.22, midi(65), 0.6, 0.16);
      k.tone(t + 0.22, midi(41), 0.4, 0.12, 'triangle');
    },
    challenge: (k, t) => {
      k.wood(t, 240, 0.45);
      k.wood(t + 0.16, 240, 0.45);
      [41, 53, 56, 60].forEach(n => k.synth(t + 0.32, midi(n), 1.0, 0.05, { wave: 'triangle', cutoff: 1400, attack: 0.05, release: 0.6 }));
    },
    win: (k, t) => {
      // sleigh bells ringing in a celesta fanfare over a warm horn chord
      for (let i = 0; i < 4; i++) k.jingle(t + i * 0.16, 0.13);
      run(t, [65, 69, 72, 77, 81, 84, 89], 0.07, (at, f) => k.celesta(at, f, 0.8, 0.08));
      [53, 60, 65, 69].forEach(n => k.synth(t + 0.4, midi(n), 1.3, 0.05, { wave: 'sawtooth', detune: 6, cutoff: 900, attack: 0.08, release: 0.7 }));
    },
    lose: (k, t) => {
      run(t, [77, 74, 70, 69, 65], 0.18, (at, f) => k.celesta(at, f, 0.7, 0.1));
      k.noise(t, 1.2, 'highpass', 6000, 0.03, 0.7, undefined, 0.3);
    },
    boom: (k, t) => {
      // a roof avalanche: a muffled roar and a soft white crash
      explosion(k, t, { dark: 1.15 });
      k.crunch(t, 0.4, 0.25, 800);
    },
    thunder: (k, t) => {
      // the ice cracks, then the rumble rolls over the hills
      for (let i = 0; i < 5; i++) ice(k, t + i * 0.025, 3000 + Math.random() * 2000, 0.08, 0.06);
      k.noise(t, 0.15, 'highpass', 3000, 0.3, 0.7);
      k.noise(t + 0.05, 1.6, 'lowpass', 450, 0.8, 0.5, 60);
      k.tone(t + 0.05, 62, 1.2, 0.5, 'sine', 30);
    },
    whoosh: (k, t) => k.noise(t, 0.8, 'bandpass', 500, 0.35, 2, 2600, 0.25),
    whistle: (k, t) => {
      // the wind whistling down a chimney
      k.noise(t, 0.62, 'bandpass', 2400, 0.4, 14, 600, 0.05);
      k.tone(t, 1700, 0.62, 0.05, 'sine', 420, 0.05);
    },
    event: (k, t) => {
      k.noise(t, 0.4, 'bandpass', 600, 0.15, 1.5, 4000, 0.3);
      k.jingle(t + 0.3, 0.15);
      [77, 81, 84, 89].forEach((n, i) => k.celesta(t + 0.3 + i * 0.08, midi(n), 0.8, 0.09));
    },
    meteor: (k, t) => {
      k.noise(t, 0.9, 'bandpass', 3000, 0.28, 1.4, 250);
      k.tone(t, 900, 0.9, 0.06, 'sine', 140, 0.1);
      ice(k, t, midi(96), 0.4, 0.03);
    },
    jackpot: (k, t) => {
      for (let i = 0; i < 9; i++) ice(k, t + i * 0.055, midi(77 + [0, 4, 7, 12, 7, 12, 16, 12, 19][i]), 0.35, 0.08);
      k.jingle(t + 0.5, 0.16);
    },
    recolor: (k, t) => {
      k.noise(t, 0.4, 'bandpass', 1500, 0.12, 2, 7000);
      run(t + 0.1, [77, 81, 84, 88], 0.08, (at, f) => ice(k, at, f, 0.4, 0.1));
    },
    carousel: (k, t) => {
      run(t, [65, 72, 77, 81, 84, 81, 77, 72, 65], 0.07, (at, f) => k.celesta(at, f, 0.35, 0.09));
      k.jingle(t, 0.1);
    },
  },
  trim: {
    card: 1.34, draw: 0.7, skip: 1.12, reverse: 1.16, stack: 0.8, wild: 0.93,
    tick: 1.08, hurry: 1.36, bombTick: 1.15, click: 1.16, caught: 1.05, penalty: 0.81,
    challenge: 1.18, win: 1.59, lose: 1.45, boom: 0.79, thunder: 0.92, whoosh: 1.31,
    whistle: 1.59, event: 1.29, meteor: 1.16, jackpot: 1.19, recolor: 1.19, carousel: 1.07,
  },
  song: {
    bpm: 90,
    stepsPerBar: 12,
    bars: 8,
    level: 2.22,
    step(k, step, t, sd) {
      const s = step % 12;
      const bar = Math.floor(step / 12) % 8;
      const chord = CHORDS[bar];
      // a waltz: warm bass on one, soft chords on two and three
      if (s === 0) k.tone(t, midi(chord[0]), sd * 9, 0.14, 'triangle', undefined, 0.02);
      if (s === 4 || s === 8) chord.slice(1).forEach(n => k.pluck(t, midi(n), sd * 3, 0.03, 'triangle', 3));
      // a pad of warm strings underneath
      if (s === 0) chord.slice(1).forEach(n => k.synth(t, midi(n), sd * 14, 0.02, { wave: 'sawtooth', detune: 8, cutoff: 700, attack: sd * 4, release: sd * 6 }));
      // sleigh bells on the beat, softly
      if (s % 4 === 0) k.jingle(t, s === 0 ? 0.05 : 0.03);
      // the celesta tune, and arpeggios in between
      if (bar < 4) {
        const ph = bar * 12 + s;
        for (const [at, n] of TUNE) if (at === ph) k.celesta(t, midi(n), sd * 7, 0.06);
      } else if (s % 2 === 0) {
        k.celesta(t, midi(chord[1 + ((s / 2) % 3)] + 12), sd * 4, 0.04);
      }
    },
  },
};
