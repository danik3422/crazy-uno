import type { ThemeId } from '../game/types';
import { Observable } from '../lib/observable';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { shoutUno } from './voice';

/**
 * All game audio, synthesised with Web Audio: no files to load, works offline and inside the artifact.
 * Browsers only allow sound after the first tap or key press, so everything waits for that gesture.
 */

export type Sfx =
  | 'card' | 'draw' | 'shuffle' | 'boom' | 'thunder' | 'uno' | 'event' | 'win' | 'whoosh'
  | 'turn' | 'tick' | 'caught' | 'penalty' | 'challenge' | 'click' | 'whistle';

interface Prefs { sfx: boolean; music: boolean }

function loadPrefs(): Prefs {
  const p = readJson<Partial<Prefs>>(STORAGE_KEYS.sound);
  if (p && typeof p.sfx === 'boolean') return { sfx: p.sfx, music: !!p.music };
  return { sfx: true, music: true };
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);
/** a little random detune (in semitones), so repeated sounds never come out identical */
const vary = (semis: number) => 2 ** (((Math.random() * 2 - 1) * semis) / 12);

/** How much of the effects goes through the room echo. */
const REVERB_SEND = 0.2;

interface Song {
  bpm: number;
  /** four chords, midi notes */
  chords: number[][];
  wave: OscillatorType;
  /** how the chord is played over a 16-step bar */
  style: 'stabs' | 'arp' | 'pad' | 'organ';
  drums: 'pop' | 'club' | 'soft' | 'spooky';
}

// Each theme gets its own little loop.
const SONGS: Record<ThemeId, Song> = {
  classic: { bpm: 118, chords: [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]], wave: 'triangle', style: 'stabs', drums: 'pop' },
  neon: { bpm: 124, chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]], wave: 'sawtooth', style: 'arp', drums: 'club' },
  space: { bpm: 84, chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]], wave: 'sine', style: 'pad', drums: 'soft' },
  halloween: { bpm: 100, chords: [[62, 65, 69], [58, 62, 65], [55, 58, 62], [57, 61, 64]], wave: 'square', style: 'organ', drums: 'spooky' },
};

class SoundEngine extends Observable {
  prefs: Prefs = loadPrefs();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private song: ThemeId | null = null;
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextStepAt = 0;
  private prop: { osc: OscillatorNode; gain: GainNode; level: number } | null = null;

  constructor() {
    super();
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  /* ---------- settings (React reads them via subscribe/getVersion) ---------- */
  setSfx(on: boolean) {
    this.prefs = { ...this.prefs, sfx: on };
    this.save();
    if (this.sfxBus) this.sfxBus.gain.value = on ? 0.9 : 0;
  }

  setMusic(on: boolean) {
    this.prefs = { ...this.prefs, music: on };
    this.save();
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.16 : 0, this.ctx!.currentTime, 0.2);
  }

  private save() {
    writeJson(STORAGE_KEYS.sound, this.prefs);
    this.emitChange();
  }

  private unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    // a gentle limiter so stacked effects never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.prefs.sfx ? 0.9 : 0;
    this.sfxBus.connect(this.master);
    // a small room: effects get a soft tail instead of sounding dry and clicky
    const room = ctx.createConvolver();
    room.buffer = this.roomImpulse(1.4);
    const wet = ctx.createGain();
    wet.gain.value = REVERB_SEND;
    this.sfxBus.connect(room).connect(wet).connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.prefs.music ? 0.16 : 0;
    this.musicBus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.song) this.startSeq();
  }

  /** A synthetic room echo: two channels of decaying, slightly darkened noise. */
  private roomImpulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const x = i / len;
        // a one-pole lowpass that closes over time: the tail gets darker as it fades
        const k = 0.55 + x * 0.4;
        last = last * k + (Math.random() * 2 - 1) * (1 - k);
        d[i] = last * Math.pow(1 - x, 2.6) * 2.2;
      }
    }
    return buf;
  }

  /* ---------- building blocks ---------- */
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  /** Filtered noise: paper, air, rumble. */
  private burst(out: AudioNode, t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 1, sweepTo?: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, peak, Math.min(0.01, dur / 4), dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(out: AudioNode, t: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', glideTo?: number, attack = 0.005) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
    const g = ctx.createGain();
    this.env(g, t, peak, attack, dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + dur + 0.05);
  }

  /** A soft mallet (marimba-like): a round tone with a quick bright overtone at the strike. */
  private mallet(out: AudioNode, t: number, freq: number, dur: number, peak: number) {
    this.tone(out, t, freq, dur, peak, 'sine', undefined, 0.004);
    this.tone(out, t, freq * 4, dur * 0.18, peak * 0.25, 'sine', undefined, 0.002);
  }

  /** A small bell: a pure tone plus the slightly out-of-tune partials that make metal ring. */
  private bell(out: AudioNode, t: number, freq: number, dur: number, peak: number) {
    this.tone(out, t, freq, dur, peak, 'sine', undefined, 0.003);
    this.tone(out, t, freq * 2.76, dur * 0.45, peak * 0.32, 'sine', undefined, 0.002);
    this.tone(out, t, freq * 5.4, dur * 0.2, peak * 0.12, 'sine', undefined, 0.002);
  }

  /** A warm brass-like note: a sawtooth whose filter opens on the attack and settles, like a horn's "bwah". */
  private brass(out: AudioNode, t: number, freq: number, dur: number, peak: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    // two slightly detuned voices make it a section rather than one buzzer
    const o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = freq * 1.004;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(freq * 1.2, t);
    f.frequency.exponentialRampToValueAtTime(freq * 6, t + 0.06);
    f.frequency.exponentialRampToValueAtTime(freq * 3, t + 0.3);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.035);
    g.gain.setValueAtTime(peak, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    o2.connect(f);
    f.connect(g).connect(out);
    for (const x of [o, o2]) {
      x.start(t);
      x.stop(t + dur + 0.05);
    }
  }

  /** A wooden knock (the timer, the judge's gavel). */
  private wood(out: AudioNode, t: number, freq: number, peak: number) {
    this.tone(out, t, freq, 0.05, peak, 'sine', freq * 0.7, 0.001);
    this.burst(out, t, 0.025, 'bandpass', freq * 2.5, peak * 0.5, 3);
  }

  /* ---------- effects ---------- */
  play(name: Sfx, count = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.sfx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    const o = this.sfxBus;
    switch (name) {
      case 'card': {
        // a card slapped on the felt: a papery snap and a soft thud, a little different every time
        const v = vary(1.5);
        this.burst(o, t, 0.07, 'bandpass', 2300 * v, 0.45, 0.8, 1200 * v);
        this.burst(o, t, 0.05, 'lowpass', 500, 0.35, 0.7);
        this.tone(o, t, 120 * v, 0.07, 0.32, 'sine', 60);
        break;
      }
      case 'draw':
        // one soft slide per card, in step with the cards leaving the deck one by one
        for (let i = 0; i < Math.min(count, 12); i++) {
          const v = vary(2);
          this.burst(o, t + i * 0.16, 0.12, 'bandpass', 1500 * v, 0.26, 0.9, 3800 * v);
        }
        break;
      case 'shuffle':
        // a riffle: quick paper clicks that speed up, then the cards squared on the table
        for (let i = 0; i < 16; i++) {
          const at = t + Math.pow(i / 16, 0.85) * 0.65 + Math.random() * 0.01;
          this.burst(o, at, 0.03, 'bandpass', (2400 + Math.random() * 900) * vary(1), 0.22, 1);
        }
        this.burst(o, t + 0.72, 0.09, 'lowpass', 900, 0.4, 0.8);
        this.tone(o, t + 0.72, 110, 0.07, 0.25, 'sine', 70);
        break;
      case 'boom':
        this.burst(o, t, 1.3, 'lowpass', 800, 0.9, 0.7, 70);
        this.tone(o, t, 85, 0.9, 0.85, 'sine', 30);
        break;
      case 'thunder':
        this.burst(o, t, 0.2, 'highpass', 2500, 0.4, 0.7);
        this.burst(o, t + 0.05, 1.8, 'lowpass', 500, 0.85, 0.5, 60);
        this.tone(o, t + 0.05, 65, 1.2, 0.55, 'sine', 30);
        break;
      case 'uno': {
        // a person shouting "УНО!", and a bright little sparkle of bells on the "О"
        shoutUno(ctx, o, t, this.noise);
        [84, 88, 91, 96].forEach((n, i) => this.bell(o, t + 0.3 + i * 0.06, midi(n), 0.7, 0.07));
        break;
      }
      case 'event':
        // a magic swell and a rising chime
        this.burst(o, t, 0.5, 'bandpass', 400, 0.22, 1.2, 3000);
        [79, 83, 86, 91].forEach((n, i) => this.bell(o, t + 0.3 + i * 0.08, midi(n), 0.9, 0.12));
        break;
      case 'win':
        // a little fanfare: brass pick-up notes into a held chord, bells on top
        [[67, 0, 0.14], [72, 0.14, 0.14], [76, 0.28, 0.14], [79, 0.42, 0.3], [76, 0.62, 0.12], [79, 0.74, 0.9]].forEach(([n, d, len]) =>
          this.brass(o, t + d, midi(n), len, 0.13));
        [60, 64, 67].forEach(n => this.brass(o, t + 0.74, midi(n), 1.0, 0.06));
        [84, 88, 91, 96].forEach((n, i) => this.bell(o, t + 0.78 + i * 0.07, midi(n), 1.1, 0.06));
        break;
      case 'whoosh':
        this.burst(o, t, 0.6, 'bandpass', 350, 0.4, 1.6, 3500);
        break;
      case 'turn':
        // "your turn": two soft marimba notes going up
        this.mallet(o, t, midi(76), 0.35, 0.22);
        this.mallet(o, t + 0.11, midi(83), 0.5, 0.22);
        break;
      case 'tick':
        // the last seconds of your clock: a woodblock, not a beep
        this.wood(o, t, 1200, 0.22);
        break;
      case 'caught':
        // a playful slide whistle down and a springy "boing"
        this.tone(o, t, 1300, 0.38, 0.16, 'sine', 380);
        this.tone(o, t + 0.4, 160, 0.4, 0.3, 'triangle', 380);
        this.tone(o, t + 0.4, 320, 0.25, 0.08, 'sine', 760);
        break;
      case 'penalty':
        // a gentle "wah-wah": two falling soft-brass notes
        this.brass(o, t, midi(62), 0.22, 0.12);
        this.brass(o, t + 0.24, midi(57), 0.5, 0.12);
        break;
      case 'challenge':
        // the judge's gavel twice, then a low dramatic chord
        this.wood(o, t, 220, 0.5);
        this.wood(o, t + 0.16, 220, 0.5);
        [48, 55, 60, 63].forEach(n => this.brass(o, t + 0.32, midi(n), 0.9, 0.06));
        break;
      case 'whistle':
        // a falling bomb: a long descending whistle
        this.tone(o, t, 1700, 0.62, 0.12, 'sine', 420, 0.03);
        break;
      case 'click':
        this.wood(o, t, 1600, 0.08);
        break;
    }
  }

  /** The mascot's propeller: 0 = silent, 1 = right overhead. Called every frame, cheap when unchanged. */
  propeller(level: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const target = this.prefs.sfx ? Math.max(0, Math.min(1, level)) * 0.12 : 0;
    if (!this.prop) {
      if (target <= 0) return;
      // a buzzy saw, chopped by a fast LFO, through a lowpass: sounds like a little engine
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 78;
      const chop = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 26;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.5;
      chop.gain.value = 0.5;
      lfo.connect(lfoDepth).connect(chop.gain);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(chop).connect(lp).connect(gain).connect(this.sfxBus);
      osc.start();
      lfo.start();
      this.prop = { osc, gain, level: 0 };
    }
    if (Math.abs(target - this.prop.level) < 0.004) return;
    this.prop.level = target;
    this.prop.gain.gain.setTargetAtTime(target, ctx.currentTime, 0.12);
    this.prop.osc.frequency.setTargetAtTime(70 + target * 200, ctx.currentTime, 0.2);
  }

  /* ---------- music ---------- */
  music(theme: ThemeId | null) {
    if (theme === this.song) return;
    this.song = theme;
    if (this.seqTimer) clearInterval(this.seqTimer);
    this.seqTimer = null;
    if (theme && this.ctx) this.startSeq();
  }

  private startSeq() {
    const ctx = this.ctx!;
    this.step = 0;
    this.nextStepAt = ctx.currentTime + 0.1;
    // look-ahead scheduler: wake often, schedule the notes of the next 150 ms precisely
    this.seqTimer = setInterval(() => {
      if (!this.song || ctx.state !== 'running') return;
      const song = SONGS[this.song];
      const stepDur = 60 / song.bpm / 4;
      while (this.nextStepAt < ctx.currentTime + 0.15) {
        this.playStep(song, this.step, this.nextStepAt, stepDur);
        this.step = (this.step + 1) % 64;
        this.nextStepAt += stepDur;
      }
    }, 30);
  }

  private playStep(song: Song, step: number, t: number, sd: number) {
    const o = this.musicBus;
    const s16 = step % 16;
    const chord = song.chords[Math.floor(step / 16) % 4];
    const root = chord[0];

    // drums
    if (song.drums === 'club') {
      if (s16 % 4 === 0) this.tone(o, t, 120, 0.18, 0.9, 'sine', 40);
      if (s16 % 4 === 2) this.burst(o, t, 0.05, 'highpass', 8000, 0.25);
      if (s16 === 4 || s16 === 12) this.burst(o, t, 0.15, 'bandpass', 1800, 0.45, 0.8);
    } else if (song.drums === 'pop') {
      if (s16 === 0 || s16 === 8 || s16 === 10) this.tone(o, t, 110, 0.16, 0.85, 'sine', 42);
      if (s16 === 4 || s16 === 12) this.burst(o, t, 0.16, 'bandpass', 1700, 0.5, 0.8);
      if (s16 % 2 === 0) this.burst(o, t, 0.035, 'highpass', 9000, 0.12);
    } else if (song.drums === 'soft') {
      if (s16 === 0) this.tone(o, t, 80, 0.4, 0.4, 'sine', 40);
      if (s16 % 4 === 2) this.burst(o, t, 0.04, 'highpass', 9000, 0.05);
    } else {
      if (s16 === 0 || s16 === 6) this.tone(o, t, 90, 0.3, 0.6, 'sine', 35);
      if (s16 === 12) this.burst(o, t, 0.3, 'bandpass', 900, 0.25, 3);
    }

    // bass
    const bassSteps = song.style === 'arp' ? [0, 2, 4, 6, 8, 10, 12, 14] : song.style === 'pad' ? [0] : [0, 6, 8, 14];
    if (bassSteps.includes(s16)) {
      this.tone(o, t, midi(root - 24), song.style === 'pad' ? sd * 14 : sd * 1.6, song.style === 'arp' ? 0.32 : 0.45, song.style === 'organ' ? 'square' : 'triangle');
    }

    // harmony
    if (song.style === 'stabs' && (s16 === 2 || s16 === 6 || s16 === 10 || s16 === 14)) {
      chord.forEach(n => this.tone(o, t, midi(n), sd * 0.9, 0.07, song.wave));
    } else if (song.style === 'arp') {
      const n = chord[step % chord.length] + (Math.floor(s16 / 4) % 2 ? 12 : 0);
      this.tone(o, t, midi(n), sd * 0.8, 0.07, song.wave);
    } else if (song.style === 'pad' && s16 === 0) {
      chord.forEach(n => this.tone(o, t, midi(n), sd * 15, 0.06, 'sine', undefined, 0.6));
      [0, 3, 6, 9, 12].forEach((d, i) => this.tone(o, t + d * sd, midi(chord[i % chord.length] + 12), sd * 2.5, 0.04, 'sine'));
    } else if (song.style === 'organ' && s16 % 4 === 0) {
      chord.forEach(n => this.tone(o, t, midi(n), sd * 3.4, 0.05, 'square'));
      if (s16 === 8) this.tone(o, t, midi(chord[2] + 12), sd * 6, 0.05, 'sine', midi(chord[2] + 11));
    }
  }
}

export const sound = new SoundEngine();
