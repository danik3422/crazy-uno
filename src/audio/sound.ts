import type { ThemeId } from '../game/types';
import { Observable } from '../lib/observable';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import { Kit, makeNoise } from './kit';
import { paletteFor, type Song, type SfxId } from './palettes';

/**
 * All game audio, synthesised with Web Audio: no files to load, works offline and inside the artifact.
 * Every table has its own palette (`palettes/<theme>.ts`): its own version of every sound and its own music loop.
 * Browsers only allow sound after the first tap or key press, so everything waits for that gesture.
 */

export type Sfx = SfxId;

interface Prefs { sfx: boolean; music: boolean }

function loadPrefs(): Prefs {
  const p = readJson<Partial<Prefs>>(STORAGE_KEYS.sound);
  if (p && typeof p.sfx === 'boolean') return { sfx: p.sfx, music: !!p.music };
  return { sfx: true, music: true };
}

/** Bus levels: the music sits well under the effects. */
const SFX_LEVEL = 0.9;
const MUSIC_LEVEL = 0.13;
/** How much of the effects goes through the room echo. */
const REVERB_SEND = 0.2;
/** Seconds for one table's music to fade into the next one's. */
const CROSSFADE = 1.6;
/** Sounds playing at once: past this, small repeated ones (cards, ticks) are dropped; past the hard cap, everything. */
const SOFT_VOICES = 10;
const HARD_VOICES = 18;
/** the same sound twice within this many seconds plays once */
const SAME_SOUND_GAP = 0.03;
const MINOR: ReadonlySet<SfxId> = new Set<SfxId>(['card', 'draw', 'shuffle', 'tick', 'hurry', 'bombTick', 'click']);
/** music: how often the scheduler wakes, and how far ahead it schedules notes (seconds) */
const SEQ_WAKE_MS = 50;
const SEQ_AHEAD = 0.2;

/**
 * Plays one sound of a table into `dest` at context time `t`, normalised by the palette's trim.
 * The whole graph frees itself when the sound has finished. Returns when it ends.
 * Works on any context, including an `OfflineAudioContext` (tests and measurements use it).
 */
export function renderSfx(ctx: BaseAudioContext, dest: AudioNode, noise: AudioBuffer, theme: ThemeId | null, id: SfxId, t: number, count = 1): number {
  const pal = paletteFor(theme);
  const out = ctx.createGain();
  out.gain.value = pal.trim?.[id] ?? 1;
  out.connect(dest);
  const k = new Kit(ctx, out, noise);
  pal.sfx[id](k, t, count);
  k.whenDone(() => out.disconnect());
  return k.end;
}

/** One table's music loop, playing into its own fader. */
interface Player {
  song: Song;
  fader: GainNode;
  kit: Kit;
  step: number;
  nextAt: number;
  /** fading out: stops scheduling at this time */
  stopAt: number | null;
}

class SoundEngine extends Observable {
  prefs: Prefs = loadPrefs();
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  /** the table whose sounds play */
  private theme: ThemeId | null = null;
  /** the table whose music plays (null: none) */
  private song: ThemeId | null = null;
  private players: Player[] = [];
  private seqTimer: ReturnType<typeof setInterval> | null = null;
  /** end times of the sounds playing now, for the voice limit */
  private voices: number[] = [];
  private lastPlayed = new Map<SfxId, number>();
  private prop: { osc: OscillatorNode; gain: GainNode; level: number } | null = null;
  private motor: { oscs: OscillatorNode[]; chop: OscillatorNode; lp: BiquadFilterNode; gain: GainNode; level: number; rev: number } | null = null;

  constructor() {
    super();
    if (typeof window === 'undefined') return;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('touchend', unlock, { capture: true });
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
    if (this.ctx) this.sfxBus.gain.setTargetAtTime(on ? SFX_LEVEL : 0, this.ctx.currentTime, 0.03);
  }

  setMusic(on: boolean) {
    this.prefs = { ...this.prefs, music: on };
    this.save();
    if (this.ctx) this.musicBus.gain.setTargetAtTime(on ? MUSIC_LEVEL : 0, this.ctx.currentTime, 0.2);
  }

  /** Which table's sounds to use (null: the default palette, away from the tables). */
  setTheme(theme: ThemeId | null) {
    this.theme = theme;
  }

  private save() {
    writeJson(STORAGE_KEYS.sound, this.prefs);
    this.emitChange();
  }

  private unlock() {
    if (this.ctx) {
      // iOS may also leave the context 'interrupted' after a call or the lock screen
      if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    // older iOS only unlocks output once something has been played inside the gesture
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    // a gentle limiter so stacked effects never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.prefs.sfx ? SFX_LEVEL : 0;
    this.sfxBus.connect(this.master);
    // a small room: effects get a soft tail instead of sounding dry and clicky
    const room = ctx.createConvolver();
    room.buffer = this.roomImpulse(1.4);
    const wet = ctx.createGain();
    wet.gain.value = REVERB_SEND;
    this.sfxBus.connect(room).connect(wet).connect(this.master);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.prefs.music ? MUSIC_LEVEL : 0;
    this.musicBus.connect(this.master);
    // the music gets a little of the room too, which glues the loop together
    const musicWet = ctx.createGain();
    musicWet.gain.value = 0.35;
    this.musicBus.connect(musicWet).connect(room);
    this.noise = makeNoise(ctx);
    if (this.song) this.startSong(this.song, false);
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

  /* ---------- effects ---------- */
  play(name: Sfx, count = 1) {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.sfx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    // the voice limit: twenty cards dealt at once must not choke a phone
    this.voices = this.voices.filter(end => end > now);
    const busy = this.voices.length;
    if (busy >= HARD_VOICES || (busy >= SOFT_VOICES && MINOR.has(name))) return;
    const last = this.lastPlayed.get(name);
    if (last !== undefined && now - last < SAME_SOUND_GAP) return;
    this.lastPlayed.set(name, now);
    const end = renderSfx(ctx, this.sfxBus, this.noise, this.theme, name, now + 0.01, count);
    this.voices.push(end);
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

  /**
   * A sound built on the spot from the synth kit, the same for every table (the knock-out van's door and horn).
   * It obeys the effects switch and the voice limit like the table's own sounds.
   */
  oneShot(build: (k: Kit, t: number) => void) {
    const ctx = this.ctx;
    if (!ctx || !this.prefs.sfx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    this.voices = this.voices.filter(end => end > now);
    if (this.voices.length >= HARD_VOICES) return;
    const out = ctx.createGain();
    out.connect(this.sfxBus);
    const k = new Kit(ctx, out, this.noise);
    build(k, now + 0.01);
    k.whenDone(() => out.disconnect());
    this.voices.push(k.end);
  }

  /**
   * A van's engine: `level` 0 = silent .. 1 = loud and close, `rev` 0 = idling .. 1 = pulling hard.
   * Called every frame, cheap when unchanged (like the propeller).
   */
  engine(level: number, rev: number) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const target = this.prefs.sfx ? Math.max(0, Math.min(1, level)) * 0.16 : 0;
    const r = Math.max(0, Math.min(1, rev));
    if (!this.motor) {
      if (target <= 0) return;
      // two detuned saws, low, pulsed by the "cylinders", through a lowpass that opens as it revs
      const oscs = [38, 38.6].map(f => {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        return o;
      });
      const pulse = ctx.createGain();
      pulse.gain.value = 0.6;
      const chop = ctx.createOscillator();
      chop.frequency.value = 11;
      const depth = ctx.createGain();
      depth.gain.value = 0.4;
      chop.connect(depth).connect(pulse.gain);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      lp.Q.value = 1.2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      for (const o of oscs) o.connect(pulse);
      pulse.connect(lp).connect(gain).connect(this.sfxBus);
      for (const o of oscs) o.start();
      chop.start();
      this.motor = { oscs, chop, lp, gain, level: 0, rev: 0 };
    }
    const m = this.motor;
    if (Math.abs(target - m.level) < 0.003 && Math.abs(r - m.rev) < 0.02) return;
    const now = ctx.currentTime;
    m.level = target;
    m.rev = r;
    m.gain.gain.setTargetAtTime(target, now, 0.15);
    m.oscs.forEach((o, i) => o.frequency.setTargetAtTime((38 + i * 0.6) * (1 + r * 1.4), now, 0.25));
    m.chop.frequency.setTargetAtTime(11 + r * 22, now, 0.25);
    m.lp.frequency.setTargetAtTime(240 + r * 700, now, 0.25);
  }

  /* ---------- music ---------- */
  /** Plays a table's music loop, crossfading from the one before; null fades the music out. */
  music(theme: ThemeId | null) {
    if (theme === this.song) return;
    this.song = theme;
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    for (const p of this.players) {
      if (p.stopAt !== null) continue;
      p.fader.gain.cancelScheduledValues(now);
      p.fader.gain.setValueAtTime(p.fader.gain.value, now);
      p.fader.gain.linearRampToValueAtTime(0, now + CROSSFADE);
      p.stopAt = now + CROSSFADE;
    }
    if (theme) this.startSong(theme, true);
    else this.ensureSeq();
  }

  private startSong(theme: ThemeId, fadeIn: boolean) {
    const ctx = this.ctx!;
    const song = paletteFor(theme).song;
    const fader = ctx.createGain();
    const now = ctx.currentTime;
    fader.gain.setValueAtTime(fadeIn ? 0 : song.level, now);
    if (fadeIn) fader.gain.linearRampToValueAtTime(song.level, now + CROSSFADE);
    fader.connect(this.musicBus);
    this.players.push({ song, fader, kit: new Kit(ctx, fader, this.noise), step: 0, nextAt: now + 0.1, stopAt: null });
    this.ensureSeq();
  }

  /** The look-ahead scheduler: wakes every 50 ms and schedules the next 200 ms of notes precisely. */
  private ensureSeq() {
    if (this.seqTimer || !this.players.length) return;
    this.seqTimer = setInterval(() => this.schedule(), SEQ_WAKE_MS);
  }

  private schedule() {
    const ctx = this.ctx!;
    const now = ctx.currentTime;
    for (const p of this.players) {
      if (p.stopAt !== null && now >= p.stopAt) {
        p.fader.disconnect();
        continue;
      }
      if (ctx.state !== 'running') continue;
      const sd = 60 / p.song.bpm / 4;
      const loop = p.song.stepsPerBar * p.song.bars;
      // after a long stall (a throttled tab) pick up from now instead of rushing through the missed notes
      if (p.nextAt < now - 0.1) p.nextAt = now + 0.05;
      while (p.nextAt < now + SEQ_AHEAD) {
        // with the music off nothing is built, the loop just keeps time
        if (this.prefs.music) p.song.step(p.kit, p.step, p.nextAt, sd);
        p.step = (p.step + 1) % loop;
        p.nextAt += sd;
      }
    }
    this.players = this.players.filter(p => p.stopAt === null || now < p.stopAt);
    if (!this.players.length && this.seqTimer) {
      clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
  }
}

export const sound = new SoundEngine();
