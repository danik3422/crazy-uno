import type { ThemeId } from '../game/types';

/**
 * All game audio, synthesised with Web Audio: no files to load, works offline and inside the artifact.
 * Browsers only allow sound after the first tap or key press, so everything waits for that gesture.
 */

export type Sfx =
  | 'card' | 'draw' | 'shuffle' | 'boom' | 'thunder' | 'uno' | 'event' | 'win' | 'whoosh'
  | 'turn' | 'tick' | 'caught' | 'penalty' | 'challenge' | 'click';

const PREFS_KEY = 'crazy-uno-sound';

interface Prefs { sfx: boolean; music: boolean }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (p && typeof p.sfx === 'boolean') return { sfx: p.sfx, music: !!p.music };
  } catch { /* storage unavailable */ }
  return { sfx: true, music: true };
}

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

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

class SoundEngine {
  prefs: Prefs = loadPrefs();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private listeners = new Set<() => void>();
  private version = 0;
  private song: ThemeId | null = null;
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  private nextStepAt = 0;
  private prop: { osc: OscillatorNode; gain: GainNode; level: number } | null = null;

  constructor() {
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
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => { this.listeners.delete(f); };
  };
  getVersion = () => this.version;

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
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(this.prefs)); } catch { /* ignore */ }
    this.version++;
    this.listeners.forEach(f => f());
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
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.prefs.music ? 0.16 : 0;
    this.musicBus.connect(this.master);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (this.song) this.startSeq();
  }

  /* ---------- building blocks ---------- */
  private env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

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

  /* ---------- effects ---------- */
  play(name: Sfx, count = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.sfx || ctx.state !== 'running') return;
    const t = ctx.currentTime + 0.01;
    const o = this.sfxBus;
    switch (name) {
      case 'card':
        // a slap on the felt: bright crack plus a low thump
        this.burst(o, t, 0.09, 'bandpass', 1900, 0.7, 0.9);
        this.tone(o, t, 150, 0.08, 0.5, 'sine', 55);
        break;
      case 'draw':
        for (let i = 0; i < Math.min(count, 6); i++) this.burst(o, t + i * 0.09, 0.14, 'highpass', 2600, 0.18, 0.7, 5200);
        break;
      case 'shuffle':
        for (let i = 0; i < 14; i++) this.burst(o, t + i * 0.045 + Math.random() * 0.015, 0.035, 'bandpass', 2800 + Math.random() * 1200, 0.3, 1.2);
        this.burst(o, t + 0.7, 0.12, 'bandpass', 1600, 0.5, 0.9);
        break;
      case 'boom':
        this.burst(o, t, 1.3, 'lowpass', 900, 1.0, 0.7, 80);
        this.tone(o, t, 90, 0.9, 0.9, 'sine', 28);
        break;
      case 'thunder':
        this.burst(o, t, 0.25, 'highpass', 3000, 0.6, 0.7);
        this.burst(o, t + 0.05, 1.8, 'lowpass', 600, 0.9, 0.5, 60);
        this.tone(o, t + 0.05, 70, 1.2, 0.6, 'sine', 30);
        break;
      case 'uno': {
        [72, 76, 79, 84].forEach((n, i) => this.tone(o, t + i * 0.07, midi(n), 0.18, 0.28, 'square'));
        this.tone(o, t + 0.3, midi(88), 0.45, 0.25, 'triangle');
        this.say('Уно!');
        break;
      }
      case 'event':
        this.burst(o, t, 0.55, 'bandpass', 300, 0.35, 1.5, 3500);
        [84, 88, 91].forEach((n, i) => this.tone(o, t + 0.35 + i * 0.08, midi(n), 0.5, 0.18, 'sine'));
        break;
      case 'win':
        [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.6], [84, 0.72]].forEach(([n, d]) =>
          this.tone(o, t + d, midi(n), d >= 0.72 ? 0.9 : 0.14, 0.3, 'triangle'));
        [60, 64, 67].forEach(n => this.tone(o, t + 0.72, midi(n), 1.1, 0.12, 'sawtooth'));
        break;
      case 'whoosh':
        this.burst(o, t, 0.6, 'bandpass', 400, 0.45, 2, 4000);
        break;
      case 'turn':
        this.tone(o, t, midi(81), 0.18, 0.18, 'sine');
        this.tone(o, t + 0.1, midi(88), 0.3, 0.18, 'sine');
        break;
      case 'tick':
        this.tone(o, t, 1500, 0.03, 0.18, 'square');
        break;
      case 'caught':
        // slide whistle down + a "boing"
        this.tone(o, t, 1400, 0.4, 0.25, 'sine', 300);
        this.tone(o, t + 0.42, 180, 0.35, 0.4, 'triangle', 420);
        break;
      case 'penalty':
        this.tone(o, t, 220, 0.16, 0.25, 'square');
        this.tone(o, t + 0.17, 165, 0.3, 0.25, 'square');
        break;
      case 'challenge':
        [48, 55, 60, 63].forEach(n => this.tone(o, t, midi(n), 0.9, 0.12, 'sawtooth'));
        this.burst(o, t, 0.6, 'lowpass', 500, 0.6, 0.7, 90);
        break;
      case 'click':
        this.tone(o, t, 900, 0.025, 0.08, 'triangle');
        break;
    }
  }

  private say(text: string) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 1.15;
      u.pitch = 1.3;
      u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch { /* speech not available */ }
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
