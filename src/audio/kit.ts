/**
 * The building blocks every table's sounds are made of: tones, filtered noise, bells, plucks, FM glass…
 * A `Kit` writes into one output node at absolute context times. It works the same on a live `AudioContext`
 * and on an `OfflineAudioContext` (used to render and measure the sounds in tests).
 *
 * Every block builds its own little node graph and disconnects it when its last source has ended,
 * so nothing piles up however many sounds are played.
 */

export const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

/** A looping second of white noise (paper, air, snow, rumble). */
export function makeNoise(ctx: BaseAudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

const SILENT = 0.0001;

export class Kit {
  /** when the last scheduled source of this kit stops (context time) */
  end = 0;
  private lastSrc: AudioScheduledSourceNode | null = null;
  private crushCurve: Float32Array | null = null;

  constructor(
    readonly ctx: BaseAudioContext,
    readonly out: AudioNode,
    readonly noiseBuf: AudioBuffer,
  ) {}

  /* ---------- randomness: repeated sounds should never come out identical ---------- */
  /** a pitch factor, ± `semis` semitones */
  vary(semis: number) {
    return 2 ** (((Math.random() * 2 - 1) * semis) / 12);
  }
  /** a small random number in [-x, x] */
  jit(x: number) {
    return (Math.random() * 2 - 1) * x;
  }

  /* ---------- plumbing ---------- */
  /** Starts the sources, stops them at `stop`, and frees the whole chain once the last one has ended. */
  private run(sources: AudioScheduledSourceNode[], chain: AudioNode[], t: number, stop: number, offset?: number) {
    for (const s of sources) {
      if (offset !== undefined && 'buffer' in s) (s as AudioBufferSourceNode).start(t, offset);
      else s.start(t);
      s.stop(stop);
    }
    const last = sources[sources.length - 1];
    last.onended = () => {
      for (const n of chain) n.disconnect();
    };
    if (stop >= this.end) {
      this.end = stop;
      this.lastSrc = last;
    }
  }

  /** Calls `f` once everything scheduled so far has finished (used to free a per-sound output). */
  whenDone(f: () => void) {
    if (!this.lastSrc) return f();
    this.lastSrc.addEventListener('ended', f);
  }

  /** Keeps the sound "alive" until `stop` (for parts built outside the kit, like the shouted voice). */
  hold(t: number, stop: number) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    g.gain.value = 0;
    o.connect(g).connect(this.out);
    this.run([o], [o, g], t, stop);
  }

  /** An exponential attack-decay envelope on a gain. */
  env(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
    // silent before the envelope starts: a gain is 1 by default, and a source may start a sample early
    g.value = 0;
    g.setValueAtTime(SILENT, t);
    g.exponentialRampToValueAtTime(Math.max(peak, SILENT * 2), t + attack);
    g.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  }

  /** A gain node with an envelope, already connected to `dest`. */
  private vca(dest: AudioNode, t: number, peak: number, attack: number, decay: number) {
    const g = this.ctx.createGain();
    this.env(g.gain, t, peak, attack, decay);
    g.connect(dest);
    return g;
  }

  /* ---------- blocks ---------- */
  /** A plain oscillator note, optionally gliding to another pitch. */
  tone(t: number, freq: number, dur: number, peak: number, type: OscillatorType = 'sine', glideTo?: number, attack = 0.005, dest: AudioNode = this.out) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + attack + dur);
    const g = this.vca(dest, t, peak, attack, dur);
    o.connect(g);
    this.run([o], [o, g], t, t + attack + dur + 0.03);
  }

  /** Filtered noise: paper, air, snow, rumble. */
  noise(t: number, dur: number, type: BiquadFilterType, freq: number, peak: number, q = 1, sweepTo?: number, attack = Math.min(0.01, dur / 4), dest: AudioNode = this.out) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + dur);
    f.Q.value = q;
    const g = this.vca(dest, t, peak, attack, dur);
    src.connect(f).connect(g);
    this.run([src], [src, f, g], t, t + attack + dur + 0.03, Math.random() * 0.8);
  }

  /** A held note with a shaped filter (pads, horns): `wave` through a lowpass that opens and settles. */
  synth(t: number, freq: number, dur: number, peak: number, o: { wave?: OscillatorType; detune?: number; cutoff?: number; open?: number; attack?: number; release?: number; q?: number; glideTo?: number; dest?: AudioNode } = {}) {
    const ctx = this.ctx;
    const wave = o.wave ?? 'sawtooth';
    const attack = o.attack ?? 0.02;
    const release = o.release ?? 0.12;
    const oscs = [0, o.detune ?? 0].filter((d, i) => i === 0 || d !== 0).map(d => {
      const x = ctx.createOscillator();
      x.type = wave;
      x.frequency.setValueAtTime(freq, t);
      x.detune.value = d;
      if (o.glideTo) x.frequency.exponentialRampToValueAtTime(o.glideTo, t + dur);
      return x;
    });
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = o.q ?? 0.8;
    const cut = o.cutoff ?? freq * 3;
    f.frequency.setValueAtTime(cut, t);
    if (o.open) {
      f.frequency.exponentialRampToValueAtTime(cut * o.open, t + attack + 0.04);
      f.frequency.exponentialRampToValueAtTime(cut, t + attack + 0.3);
    }
    const g = ctx.createGain();
    const peakEach = peak / oscs.length;
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peakEach, t + attack);
    g.gain.setValueAtTime(peakEach, t + Math.max(attack, dur - release));
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    for (const x of oscs) x.connect(f);
    f.connect(g).connect(o.dest ?? this.out);
    this.run(oscs, [...oscs, f, g], t, t + dur + 0.03);
  }

  /** A plucked synth string: a bright attack whose filter closes fast. */
  pluck(t: number, freq: number, dur: number, peak: number, wave: OscillatorType = 'sawtooth', bright = 8, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.Q.value = 2;
    f.frequency.setValueAtTime(Math.min(freq * bright, 16000), t);
    f.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.9, 60), t + dur * 0.7);
    const g = this.vca(dest, t, peak, 0.003, dur);
    o.connect(f).connect(g);
    this.run([o], [o, f, g], t, t + dur + 0.03);
  }

  /** FM: a sine whose pitch is wobbled by another — glass, celesta, metal, sci-fi blips. */
  fm(t: number, freq: number, dur: number, peak: number, ratio: number, index: number, indexDecay = dur, glideTo?: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    car.frequency.setValueAtTime(freq, t);
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(freq * ratio, t);
    if (glideTo) {
      car.frequency.exponentialRampToValueAtTime(glideTo, t + dur);
      mod.frequency.exponentialRampToValueAtTime(glideTo * ratio, t + dur);
    }
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(freq * index, t);
    depth.gain.exponentialRampToValueAtTime(Math.max(freq * index * 0.02, 0.01), t + indexDecay);
    mod.connect(depth).connect(car.frequency);
    const g = this.vca(dest, t, peak, 0.002, dur);
    car.connect(g);
    this.run([mod, car], [mod, depth, car, g], t, t + dur + 0.03);
  }

  /** A small bell: a pure tone plus the slightly out-of-tune partials that make metal ring. */
  bell(t: number, freq: number, dur: number, peak: number, dest: AudioNode = this.out) {
    this.tone(t, freq, dur, peak, 'sine', undefined, 0.003, dest);
    this.tone(t, freq * 2.76, dur * 0.45, peak * 0.32, 'sine', undefined, 0.002, dest);
    this.tone(t, freq * 5.4, dur * 0.2, peak * 0.12, 'sine', undefined, 0.002, dest);
  }

  /** A celesta / music box note: warm FM bell with a soft hammer. */
  celesta(t: number, freq: number, dur: number, peak: number, dest: AudioNode = this.out) {
    this.fm(t, freq, dur, peak, 4, 1.2, dur * 0.3, undefined, dest);
    this.tone(t, freq * 2, dur * 0.35, peak * 0.18, 'sine', undefined, 0.002, dest);
  }

  /** A soft mallet (marimba-like): a round tone with a quick bright overtone at the strike. */
  mallet(t: number, freq: number, dur: number, peak: number, dest: AudioNode = this.out) {
    this.tone(t, freq, dur, peak, 'sine', undefined, 0.004, dest);
    this.tone(t, freq * 4, dur * 0.18, peak * 0.25, 'sine', undefined, 0.002, dest);
  }

  /** A warm brass-like note: two detuned saws whose filter opens on the attack, like a horn's "bwah". */
  brass(t: number, freq: number, dur: number, peak: number, dest: AudioNode = this.out) {
    this.synth(t, freq, dur, peak, { wave: 'sawtooth', detune: 7, cutoff: freq * 2.4, open: 2.5, attack: 0.035, release: dur * 0.4, q: 1.2, dest });
  }

  /** A drawbar organ: a few sine partials, a soft attack and a tremolo. */
  organ(t: number, freq: number, dur: number, peak: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.03);
    g.gain.setValueAtTime(peak, t + Math.max(0.03, dur - 0.15));
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    const trem = ctx.createGain();
    trem.gain.value = 1;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.8;
    const lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.18;
    lfo.connect(lfoAmt).connect(trem.gain);
    trem.connect(g).connect(dest);
    const oscs = [1, 2, 3, 4].map((h, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = freq * h;
      const lv = ctx.createGain();
      lv.gain.value = [0.6, 0.3, 0.16, 0.1][i];
      o.connect(lv).connect(trem);
      return [o, lv] as const;
    });
    this.run([lfo, ...oscs.map(x => x[0])], [lfo, lfoAmt, trem, g, ...oscs.flat()], t, t + dur + 0.03);
  }

  /** A ghostly "ooo": a sine with a slow vibrato, gliding, through a vowel-ish resonance. */
  ghost(t: number, from: number, to: number, dur: number, peak: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5;
    const amt = ctx.createGain();
    amt.gain.value = from * 0.02;
    lfo.connect(amt).connect(o.frequency);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 600;
    f.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    o.connect(f).connect(g).connect(dest);
    this.run([lfo, o], [lfo, amt, o, f, g], t, t + dur + 0.03);
  }

  /** A theremin glide: a pure sine with a wide, slow vibrato. */
  theremin(t: number, from: number, to: number, dur: number, peak: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur * 0.8);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 6.5;
    const amt = ctx.createGain();
    amt.gain.setValueAtTime(0, t);
    amt.gain.linearRampToValueAtTime(to * 0.025, t + dur * 0.5);
    lfo.connect(amt).connect(o.frequency);
    const g = ctx.createGain();
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    o.connect(g).connect(dest);
    this.run([lfo, o], [lfo, amt, o, g], t, t + dur + 0.03);
  }

  /** A bit-crushed square zap: the retro synth's "pew". */
  zap(t: number, from: number, to: number, dur: number, peak: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const crush = ctx.createWaveShaper();
    crush.curve = this.crush();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 5000;
    const g = this.vca(dest, t, peak, 0.002, dur);
    o.connect(crush).connect(f).connect(g);
    this.run([o], [o, crush, f, g], t, t + dur + 0.03);
  }
  private crush() {
    if (this.crushCurve) return this.crushCurve;
    const n = 1024;
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) c[i] = Math.round(((i / (n - 1)) * 2 - 1) * 4) / 4;
    return (this.crushCurve = c);
  }

  /** Bat wings / a fluttering bird: noise chopped by a fast flap. */
  flutter(t: number, dur: number, freq: number, peak: number, rate = 16, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = rate;
    const amt = ctx.createGain();
    amt.gain.value = 0.5;
    lfo.connect(amt).connect(chop.gain);
    const g = ctx.createGain();
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    src.connect(f).connect(chop).connect(g).connect(dest);
    this.run([lfo, src], [lfo, amt, src, f, chop, g], t, t + dur + 0.03, Math.random() * 0.8);
  }

  /** A creak of old wood: a slow, uneven buzz through a narrow resonance. */
  creak(t: number, dur: number, freq: number, peak: number, dest: AudioNode = this.out) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(28 * this.vary(3), t);
    o.frequency.linearRampToValueAtTime(48 * this.vary(3), t + dur * 0.6);
    o.frequency.linearRampToValueAtTime(22, t + dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.linearRampToValueAtTime(freq * 1.4, t + dur);
    f.Q.value = 9;
    const g = ctx.createGain();
    g.gain.value = 0; // silent before the envelope starts (a gain is 1 by default)
    g.gain.setValueAtTime(SILENT, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.04);
    g.gain.setValueAtTime(peak, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(SILENT, t + dur);
    o.connect(f).connect(g).connect(dest);
    this.run([o], [o, f, g], t, t + dur + 0.03);
  }

  /** A wooden knock (timer, gavel). */
  wood(t: number, freq: number, peak: number, dest: AudioNode = this.out) {
    this.tone(t, freq, 0.05, peak, 'sine', freq * 0.7, 0.001, dest);
    this.noise(t, 0.025, 'bandpass', freq * 2.5, peak * 0.5, 3, undefined, undefined, dest);
  }

  /** One shake of sleigh bells: a cluster of tiny, bright, inharmonic jingles. */
  jingle(t: number, peak: number, dest: AudioNode = this.out) {
    for (let i = 0; i < 3; i++) {
      const at = t + i * 0.014 + Math.random() * 0.01;
      this.fm(at, (2600 + Math.random() * 2200), 0.12 + Math.random() * 0.08, peak * 0.42, 1.41, 2.2, 0.05, undefined, dest);
    }
    this.noise(t, 0.09, 'highpass', 7000, peak * 0.5, 0.7, undefined, 0.004, dest);
  }

  /** A soft step in fresh snow: a muffled, grainy crunch. */
  crunch(t: number, dur: number, peak: number, freq = 1400, dest: AudioNode = this.out) {
    for (let i = 0; i < 5; i++) {
      this.noise(t + i * (dur / 6) + Math.random() * 0.006, dur / 4, 'bandpass', freq * this.vary(5), peak * (0.6 + Math.random() * 0.4), 2.2, undefined, 0.002, dest);
    }
    this.noise(t, dur, 'lowpass', 700, peak * 0.35, 0.7, undefined, 0.01, dest);
  }

  /** A rattle (deck riffle, bones, marbles): `n` clicks that speed up. */
  riffle(t: number, dur: number, n: number, click: (at: number, i: number) => void) {
    for (let i = 0; i < n; i++) click(t + Math.pow(i / n, 0.85) * dur + Math.random() * 0.008, i);
  }
}
