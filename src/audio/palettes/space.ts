import type { Palette } from './types';
import { explosion, midi, run, shout } from './common';

/** Space: zero gravity — soft sci-fi blips, sweeps, theremin glides and deep whooshes. */

// dreamy: Cmaj7 – Am9 – Fmaj7 – G6, then Em7 – Am7 – Dm9 – G
const CHORDS = [[48, 55, 64, 71], [45, 55, 60, 64], [41, 57, 60, 64], [43, 55, 59, 64], [40, 55, 59, 62], [45, 55, 60, 64], [38, 57, 60, 64], [43, 55, 59, 62]];
const STARS = [76, 79, 83, 84, 86, 88, 91];

export const space: Palette = {
  sfx: {
    card: (k, t) => {
      // a soft landing: a blip that settles and a cushion of air
      const v = k.vary(2);
      k.fm(t, 700 * v, 0.12, 0.14, 2, 1.5, 0.05, 420 * v);
      k.noise(t, 0.09, 'lowpass', 900, 0.4, 0.7);
      k.tone(t, 110 * v, 0.1, 0.32, 'sine', 55);
    },
    draw: (k, t, n) => {
      for (let i = 0; i < Math.max(1, Math.min(n, 12)); i++) {
        const at = t + i * 0.16 + 0.005;
        const v = k.vary(2);
        k.tone(at, 500 * v, 0.14, 0.08, 'sine', 1400 * v, 0.01);
        k.noise(at, 0.12, 'bandpass', 1200 * v, 0.14, 1.2, 3000);
      }
    },
    shuffle: (k, t) => {
      k.noise(t, 0.7, 'bandpass', 300, 0.2, 2, 2400, 0.2);
      k.riffle(t + 0.01, 0.65, 14, (at, i) => k.tone(at, midi(STARS[i % STARS.length]) * k.vary(0.2), 0.05, 0.05, 'sine', undefined, 0.002));
      k.tone(t + 0.73, 90, 0.18, 0.35, 'sine', 45);
    },
    skip: (k, t) => k.theremin(t, midi(79), midi(67), 0.32, 0.12),
    reverse: (k, t) => {
      k.tone(t, 400, 0.18, 0.12, 'sine', 1200, 0.01);
      k.tone(t + 0.19, 1200, 0.18, 0.12, 'sine', 400, 0.005);
      k.noise(t, 0.38, 'bandpass', 600, 0.1, 3, 2000);
    },
    stack: (k, t, n) => {
      // a deep "vwomm" pressing down
      const heavy = Math.min(1, n / 6);
      k.tone(t, 180, 0.5 + heavy * 0.3, 0.55, 'sine', 40);
      k.noise(t, 0.6, 'bandpass', 2400, 0.25, 2, 150);
      k.fm(t, midi(48), 0.5, 0.08, 1.5, 3, 0.3);
    },
    wild: (k, t) => {
      k.theremin(t, midi(67), midi(79), 0.45, 0.07);
      run(t + 0.1, [76, 79, 83, 86, 88, 91], 0.05, (at, f) => k.fm(at, f, 0.45, 0.05, 3.5, 1, 0.2));
    },
    turn: (k, t) => {
      // a sonar ping with its echo
      [0, 0.22, 0.44].forEach((d, i) => k.fm(t + d, midi(84), 0.5, 0.18 * [1, 0.35, 0.12][i], 2, 0.6, 0.1));
      k.fm(t + 0.1, midi(91), 0.5, 0.12, 2, 0.6, 0.1);
    },
    tick: (k, t) => k.fm(t, 1300 * k.vary(0.3), 0.06, 0.16, 1.5, 1.2, 0.03),
    hurry: (k, t) => {
      k.fm(t, 1700, 0.06, 0.16, 1.5, 1.2, 0.03);
      k.fm(t + 0.1, 1700, 0.06, 0.14, 1.5, 1.2, 0.03);
    },
    bombTick: (k, t) => {
      k.tone(t, 220, 0.14, 0.3, 'sine', 180);
      k.fm(t, 880, 0.08, 0.06, 1.41, 2, 0.04);
    },
    click: (k, t) => k.fm(t, 2000, 0.03, 0.06, 1.5, 1, 0.02),
    uno: (k, t) => {
      shout(k, t);
      run(t + 0.3, [84, 88, 91, 96], 0.06, (at, f) => k.fm(at, f, 0.6, 0.06, 3.5, 1, 0.2));
    },
    caught: (k, t) => {
      // a UFO warble that dives
      k.theremin(t, 1300, 300, 0.5, 0.12);
      k.fm(t + 0.45, 200, 0.4, 0.14, 0.5, 4, 0.4, 420);
    },
    penalty: (k, t) => {
      k.fm(t, midi(74), 0.2, 0.14, 1, 1.5, 0.15);
      k.fm(t + 0.22, midi(69), 0.45, 0.14, 1, 1.5, 0.3, midi(67));
    },
    challenge: (k, t) => {
      k.tone(t, 70, 0.2, 0.5, 'sine', 50);
      k.tone(t + 0.18, 70, 0.2, 0.5, 'sine', 50);
      [48, 55, 63, 67].forEach(n => k.synth(t + 0.32, midi(n), 1.0, 0.05, { wave: 'triangle', cutoff: 1500, attack: 0.08, release: 0.6 }));
    },
    win: (k, t) => {
      [48, 55, 64, 71, 76].forEach(n => k.synth(t, midi(n), 1.6, 0.05, { wave: 'triangle', cutoff: 2500, attack: 0.25, release: 0.9 }));
      run(t + 0.1, [72, 76, 79, 83, 84, 88, 91, 95, 96], 0.07, (at, f) => k.fm(at, f, 0.6, 0.06, 3.5, 1, 0.2));
      k.theremin(t + 0.7, midi(84), midi(91), 0.8, 0.04);
    },
    lose: (k, t) => {
      k.theremin(t, midi(76), midi(64), 1.3, 0.1);
      [45, 52, 60].forEach(n => k.synth(t, midi(n), 1.4, 0.04, { wave: 'triangle', cutoff: 1200, attack: 0.2, release: 0.8 }));
    },
    boom: (k, t) => {
      explosion(k, t, { dark: 1.2 });
      k.noise(t, 1.2, 'bandpass', 2000, 0.2, 2, 100);
    },
    thunder: (k, t) => {
      // an electric storm: a crackle of sparks and a rumble
      for (let i = 0; i < 6; i++) k.noise(t + i * 0.03 + k.jit(0.01), 0.03, 'highpass', 4000, 0.3, 0.8);
      k.noise(t + 0.05, 1.6, 'lowpass', 450, 0.85, 0.5, 60);
      k.tone(t + 0.05, 60, 1.2, 0.5, 'sine', 30);
    },
    whoosh: (k, t) => {
      k.noise(t, 0.8, 'bandpass', 200, 0.4, 1.6, 2500);
      k.tone(t, 80, 0.7, 0.2, 'sine', 160, 0.2);
    },
    whistle: (k, t) => k.theremin(t, 1700, 420, 0.62, 0.1),
    event: (k, t) => {
      k.fm(t, 300, 0.5, 0.12, 0.5, 6, 0.5, 900);
      [79, 83, 86, 91].forEach((n, i) => k.fm(t + 0.3 + i * 0.08, midi(n), 0.9, 0.08, 3.5, 1, 0.25));
    },
    meteor: (k, t) => {
      k.noise(t, 1.0, 'bandpass', 2400, 0.3, 1.5, 180);
      k.tone(t, 320, 1.0, 0.18, 'sine', 50, 0.2);
    },
    jackpot: (k, t) => {
      for (let i = 0; i < 10; i++) k.fm(t + i * 0.05, midi(STARS[i % STARS.length] + (i > 6 ? 12 : 0)), 0.4, 0.06, 3.5, 1.2, 0.2);
      k.tone(t + 0.5, midi(48), 0.6, 0.15, 'sine');
    },
    recolor: (k, t) => {
      k.noise(t, 0.45, 'bandpass', 500, 0.16, 4, 5000);
      run(t + 0.08, [72, 76, 79, 83], 0.08, (at, f) => k.fm(at, f, 0.4, 0.09, 2, 1, 0.2));
    },
    carousel: (k, t) => {
      // something orbiting: a blip that circles up and down
      k.fm(t, 400, 0.9, 0.1, 0.5, 3, 0.9);
      run(t, [72, 79, 84, 88, 84, 79, 72], 0.08, (at, f) => k.fm(at, f, 0.25, 0.08, 2, 1, 0.1));
    },
  },
  trim: {
    card: 0.9, draw: 0.89, shuffle: 0.69, skip: 0.66, reverse: 1.61, stack: 0.55,
    wild: 0.86, turn: 1.04, tick: 1.07, hurry: 1.34, bombTick: 0.56, click: 1.31,
    uno: 0.96, caught: 0.93, penalty: 1.11, challenge: 0.59, win: 1.32, lose: 0.85,
    boom: 0.79, thunder: 0.91, whoosh: 0.32, whistle: 0.63, event: 1.48, meteor: 0.52,
    jackpot: 0.76, recolor: 1.47, carousel: 0.82,
  },
  song: {
    bpm: 76,
    stepsPerBar: 16,
    bars: 8,
    level: 1.07,
    step(k, step, t, sd) {
      const s = step % 16;
      const bar = Math.floor(step / 16) % 8;
      const chord = CHORDS[bar];
      // soft pads that overlap from bar to bar, so there is never a gap
      if (s === 0) {
        chord.slice(1).forEach(n => k.synth(t, midi(n), sd * 19, 0.035, { wave: 'triangle', detune: 6, cutoff: 1400, attack: sd * 5, release: sd * 8 }));
        k.tone(t, midi(chord[0] - 12), sd * 15, 0.22, 'sine', undefined, sd * 2);
      }
      // a heartbeat kick and a whisper of shaker
      if (s === 0 || s === 10) k.tone(t, 70, 0.35, 0.3, 'sine', 40);
      if (s % 4 === 2) k.noise(t, 0.05, 'highpass', 8000, 0.035);
      // starlight: a few FM bell notes with a long echo
      if (s === 3 || s === 9 || (s === 13 && bar % 2)) {
        const n = chord[1 + ((step >> 2) % 3)] + 24;
        [0, 3, 6].forEach((d, i) => k.fm(t + d * sd, midi(n), sd * 6, [0.06, 0.025, 0.01][i], 3.5, 0.8, sd * 2));
      }
    },
  },
};
