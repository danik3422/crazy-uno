import type { Palette } from './types';
import { cardSlap, explosion, midi, riffleShuffle, run, shout, slides, thunderRoll } from './common';

/** Halloween: a haunted night — creaky wood, organ stabs, ghostly "ooo" glides, bat flutters, a music box. */

// D minor: Dm – Bb – Gm – A, then Dm – F – Gm – A7
const CHORDS = [[50, 57, 62, 65], [46, 58, 62, 65], [43, 58, 62, 67], [45, 57, 61, 64], [50, 57, 62, 65], [41, 57, 60, 65], [43, 58, 62, 67], [45, 55, 61, 64]];
// the music box tune, [step in the 4-bar phrase (12 per bar, a slow 6/8 feel in 16ths), note]
const TUNE: [number, number][] = [[0, 74], [4, 77], [8, 81], [16, 82], [20, 81], [24, 77], [28, 76], [32, 74], [36, 73], [40, 74], [48, 69]];

export const halloween: Palette = {
  sfx: {
    card: (k, t) => {
      // a card on an old wooden table: a darker slap and a hollow knock
      cardSlap(k, t, { snap: 1700, thud: 95 });
      k.wood(t + 0.005, 320 * k.vary(1), 0.1);
    },
    draw: (k, t, n) => slides(k, t, n, { from: 1000, to: 2600 }, (at, i) => {
      if (i === 0) k.wood(at + 0.05, 900 * k.vary(2), 0.06);
    }),
    shuffle: (k, t) => {
      riffleShuffle(k, t, { click: 1800 });
      k.creak(t + 0.1, 0.45, 900, 0.05);
    },
    skip: (k, t) => k.flutter(t, 0.35, 2200 * k.vary(1), 0.3, 18),
    reverse: (k, t) => {
      k.ghost(t, midi(64), midi(71), 0.25, 0.14);
      k.ghost(t + 0.22, midi(71), midi(62), 0.3, 0.14);
    },
    stack: (k, t, n) => {
      // an organ "dunnn" and a heavy door thud
      const heavy = Math.min(1, n / 6);
      [38, 45, 50, 53].forEach(m => k.organ(t, midi(m), 0.45 + heavy * 0.25, 0.06));
      k.tone(t, 100, 0.2, 0.5, 'sine', 45);
      k.noise(t, 0.15, 'lowpass', 600, 0.3);
    },
    wild: (k, t) => run(t, [62, 65, 68, 71, 74, 77, 80, 83], 0.05, (at, f) => k.celesta(at, f, 0.5, 0.08)),
    turn: (k, t) => {
      // a music box: a minor third up
      k.celesta(t, midi(81), 0.6, 0.17);
      k.celesta(t + 0.13, midi(84), 0.7, 0.15);
    },
    tick: (k, t) => k.wood(t, 700 * k.vary(0.3), 0.26),
    hurry: (k, t) => {
      k.wood(t, 850, 0.26);
      k.celesta(t + 0.02, midi(87), 0.2, 0.05);
    },
    bombTick: (k, t) => {
      k.wood(t, 500, 0.28);
      k.bell(t, midi(61), 0.3, 0.06);
    },
    click: (k, t) => k.wood(t, 1100, 0.08),
    uno: (k, t) => {
      shout(k, t);
      run(t + 0.3, [86, 89, 93, 98], 0.07, (at, f) => k.celesta(at, f, 0.6, 0.06));
    },
    caught: (k, t) => {
      k.ghost(t, midi(79), midi(62), 0.55, 0.16);
      k.tone(t + 0.5, 150, 0.35, 0.25, 'triangle', 330);
    },
    penalty: (k, t) => {
      k.organ(t, midi(62), 0.22, 0.12);
      k.organ(t + 0.24, midi(56), 0.55, 0.12);
    },
    challenge: (k, t) => {
      // "dun dun dunnn"
      k.wood(t, 200, 0.45);
      k.wood(t + 0.16, 200, 0.45);
      [38, 50, 53, 56].forEach(n => k.organ(t + 0.32, midi(n), 1.0, 0.05));
    },
    win: (k, t) => {
      [50, 57, 62, 66, 69].forEach(n => k.organ(t + 0.1, midi(n), 1.4, 0.045));
      run(t, [74, 78, 81, 86, 90, 93, 98], 0.07, (at, f) => k.celesta(at, f, 0.7, 0.07));
      k.flutter(t + 0.5, 0.6, 2500, 0.15, 20);
    },
    lose: (k, t) => {
      k.ghost(t, midi(74), midi(62), 1.2, 0.14);
      [50, 53, 56].forEach(n => k.organ(t + 0.15, midi(n), 1.2, 0.04));
    },
    boom: (k, t) => explosion(k, t, { dark: 1.1 }),
    thunder: (k, t) => {
      thunderRoll(k, t, { crack: 2000 });
      k.creak(t + 0.9, 0.6, 700, 0.04);
    },
    whoosh: (k, t) => {
      k.noise(t, 0.7, 'bandpass', 300, 0.35, 2.5, 1800);
      k.ghost(t + 0.1, midi(67), midi(74), 0.5, 0.06);
    },
    whistle: (k, t) => k.ghost(t, 1500, 420, 0.62, 0.12),
    event: (k, t) => {
      // an organ chord and bats leaving the belfry
      [50, 57, 62, 65].forEach(n => k.organ(t, midi(n), 0.7, 0.05));
      k.flutter(t + 0.15, 0.6, 2400, 0.2, 18);
      run(t + 0.3, [86, 89, 93], 0.08, (at, f) => k.celesta(at, f, 0.5, 0.06));
    },
    meteor: (k, t) => {
      k.noise(t, 0.9, 'bandpass', 2600, 0.28, 1.6, 220);
      k.ghost(t, midi(84), midi(60), 0.9, 0.06);
    },
    jackpot: (k, t) => {
      for (let i = 0; i < 9; i++) k.celesta(t + i * 0.055, midi(74 + [0, 3, 7, 12, 15, 19, 24, 19, 24][i]), 0.4, 0.07);
      k.organ(t + 0.5, midi(62), 0.5, 0.06);
    },
    recolor: (k, t) => {
      k.ghost(t, midi(62), midi(74), 0.45, 0.09);
      run(t + 0.1, [74, 77, 81, 84], 0.08, (at, f) => k.celesta(at, f, 0.4, 0.09));
    },
    carousel: (k, t) => run(t, [62, 69, 74, 77, 81, 77, 74, 69, 62], 0.07, (at, f) => k.celesta(at, f, 0.35, 0.09)),
  },
  trim: {
    card: 1.18, draw: 1.28, shuffle: 1.36, skip: 4.65, reverse: 2.04, stack: 0.92,
    turn: 1.08, tick: 0.78, hurry: 0.9, bombTick: 0.9, click: 0.83, uno: 0.91,
    caught: 1.17, penalty: 0.97, challenge: 1.16, win: 1.29, lose: 1.14, boom: 0.8,
    thunder: 0.9, whoosh: 2.1, whistle: 1.94, event: 1.15, meteor: 1.49, jackpot: 1.3,
    recolor: 1.24, carousel: 1.16,
  },
  song: {
    bpm: 92,
    stepsPerBar: 12,
    bars: 8,
    level: 1.22,
    step(k, step, t, sd) {
      const s = step % 12;
      const bar = Math.floor(step / 12) % 8;
      const chord = CHORDS[bar];
      // a slow, swaying 6/8: pizzicato bass on the two big beats, a soft tom
      if (s === 0 || s === 6) k.pluck(t, midi(chord[0] - 12 + (s === 6 ? 7 : 0)), sd * 3, 0.3, 'triangle', 4);
      if (s === 0) k.tone(t, 85, 0.3, 0.35, 'sine', 45);
      if (s === 9 && bar % 2) k.tone(t, 120, 0.2, 0.2, 'sine', 70);
      // organ chords breathing in and out
      if (s === 0) chord.slice(1).forEach(n => k.organ(t, midi(n), sd * 11, 0.028));
      // the music box tune on top, every other phrase
      if (bar >= 4) {
        const ph = (bar - 4) * 12 + s;
        for (const [at, n] of TUNE) if (at === ph) k.celesta(t, midi(n), sd * 6, 0.06);
      } else if (s === 3 || s === 9) {
        k.celesta(t, midi(chord[1 + (s === 9 ? 2 : 1)] + 12), sd * 4, 0.03);
      }
    },
  },
};
