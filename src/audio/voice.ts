/**
 * A synthesised human shout of "УНО!", made the way a voice is made:
 * a buzzing source (the vocal cords, rich in overtones) shaped by resonances of the mouth (formants)
 * that glide from "у" through "н" to "о", with a shouted pitch contour, vibrato, breath and a tiny bit of roughness.
 * No recordings and no speech engine: it sounds the same on every device and starts instantly.
 */

/** Formant frequencies (Hz) and relative levels of one sound. */
interface Phoneme {
  f: [number, number, number, number];
  g: [number, number, number, number];
  /** overall loudness of the sound */
  amp: number;
}

// Shouted vowels: the mouth opens wider than in speech, which raises the first formant.
const U: Phoneme = { f: [340, 820, 2300, 3300], g: [1, 0.42, 0.1, 0.05], amp: 0.6 };
// A nasal: one strong low resonance, the rest damped
const N: Phoneme = { f: [270, 1150, 2400, 3300], g: [1, 0.1, 0.05, 0.02], amp: 0.32 };
const O: Phoneme = { f: [590, 980, 2500, 3450], g: [1, 1.1, 0.28, 0.1], amp: 1 };

/** Bandwidths of the four formants (Hz): narrower bands sound more like a voice, wider ones softer. */
const BW = [90, 110, 160, 220];

/** while set, the table's "UNO!" sound keeps its sparkle but leaves out this shout (a real voice is speaking it) */
export const shoutState = { muted: false };

let cords: PeriodicWave | null = null;
let cordsCtx: BaseAudioContext | null = null;

/** The vocal-cord buzz: every harmonic, falling off about 10 dB per octave, like a strong (shouting) voice. */
function vocalCords(ctx: BaseAudioContext): PeriodicWave {
  if (cords && cordsCtx === ctx) return cords;
  const n = 64;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) imag[k] = 1 / Math.pow(k, 1.65);
  cords = ctx.createPeriodicWave(real, imag);
  cordsCtx = ctx;
  return cords;
}

export interface ShoutOptions {
  /** base pitch in Hz; a different one each time sounds like a different person */
  pitch?: number;
  volume?: number;
}

/**
 * Shouts "УНО!" into `out` at time `t`. `noise` is a looping white-noise buffer (used for breath).
 * Returns when the shout ends (seconds, context time).
 */
export function shoutUno(ctx: BaseAudioContext, out: AudioNode, t: number, noise: AudioBuffer, opts: ShoutOptions = {}): number {
  const f0 = opts.pitch ?? 190 + Math.random() * 120;
  const vol = opts.volume ?? 0.5;

  // timeline: "у" — glide into "н" — glide into a long shouted "о" — falling release
  const uEnd = t + 0.13;
  const nAt = t + 0.17;
  const nEnd = t + 0.21;
  const oAt = t + 0.26;
  const oEnd = t + 0.56;
  const end = t + 0.74;

  /* ---- the source: vocal cords with a shouted pitch contour, vibrato and roughness ---- */
  const src = ctx.createOscillator();
  src.setPeriodicWave(vocalCords(ctx));
  const p = src.frequency;
  p.setValueAtTime(f0 * 0.9, t);
  p.linearRampToValueAtTime(f0, uEnd);
  // the voice jumps up on the stressed "О", peaks, then falls away at the end of the shout
  p.linearRampToValueAtTime(f0 * 1.05, nEnd);
  p.linearRampToValueAtTime(f0 * 1.32, oAt + 0.06);
  p.setValueAtTime(f0 * 1.32, oEnd - 0.12);
  p.exponentialRampToValueAtTime(f0 * 0.98, end);
  // vibrato that only develops on the held vowel
  const vib = ctx.createOscillator();
  vib.frequency.value = 5.2 + Math.random() * 0.8;
  const vibDepth = ctx.createGain();
  vibDepth.gain.setValueAtTime(0, t);
  vibDepth.gain.linearRampToValueAtTime(0, oAt);
  vibDepth.gain.linearRampToValueAtTime(f0 * 0.025, oEnd);
  vib.connect(vibDepth).connect(p);
  // a slow random wobble: real voices are never perfectly steady
  const wob = ctx.createOscillator();
  wob.type = 'triangle';
  wob.frequency.value = 2.3 + Math.random();
  const wobDepth = ctx.createGain();
  wobDepth.gain.value = f0 * 0.012;
  wob.connect(wobDepth).connect(p);

  /* ---- loudness of the voice through the word ---- */
  const voiced = ctx.createGain();
  const a = voiced.gain;
  // silent until the shout starts (a gain is 1 by default, which would click before the envelope begins)
  a.value = 0;
  a.setValueAtTime(0.0001, t);
  a.exponentialRampToValueAtTime(U.amp, t + 0.035);
  a.setValueAtTime(U.amp, uEnd);
  a.linearRampToValueAtTime(N.amp, nAt);
  a.setValueAtTime(N.amp, nEnd);
  a.linearRampToValueAtTime(O.amp, oAt);
  a.setValueAtTime(O.amp, oEnd - 0.05);
  a.exponentialRampToValueAtTime(0.0001, end);
  src.connect(voiced);

  /* ---- the mouth: four resonances gliding between the sounds ---- */
  const mouth = ctx.createGain();
  mouth.gain.value = vol * 2.4;
  const formants: AudioNode[] = [];
  for (let i = 0; i < 4; i++) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    const g = ctx.createGain();
    const at = (ph: Phoneme, time: number, ramp: boolean) => {
      if (ramp) {
        bp.frequency.linearRampToValueAtTime(ph.f[i], time);
        bp.Q.linearRampToValueAtTime(ph.f[i] / BW[i], time);
        g.gain.linearRampToValueAtTime(ph.g[i], time);
      } else {
        bp.frequency.setValueAtTime(ph.f[i], time);
        bp.Q.setValueAtTime(ph.f[i] / BW[i], time);
        g.gain.setValueAtTime(ph.g[i], time);
      }
    };
    at(U, t, false);
    at(U, uEnd, false);
    at(N, nAt, true);
    at(N, nEnd, false);
    at(O, oAt, true);
    voiced.connect(bp).connect(g).connect(mouth);
    formants.push(bp, g);
  }
  // a little of the plain buzz underneath keeps the voice full rather than whistly
  const body = ctx.createBiquadFilter();
  body.type = 'lowpass';
  body.frequency.value = 900;
  const bodyGain = ctx.createGain();
  bodyGain.gain.value = 0.12;
  voiced.connect(body).connect(bodyGain).connect(mouth);

  /* ---- breath: a puff before the shout, air through the "о", and a breathy tail ---- */
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const airBand = ctx.createBiquadFilter();
  airBand.type = 'bandpass';
  airBand.Q.value = 0.8;
  airBand.frequency.setValueAtTime(1100, t);
  airBand.frequency.linearRampToValueAtTime(1500, oAt);
  const airGain = ctx.createGain();
  const b = airGain.gain;
  b.value = 0;
  b.setValueAtTime(0.0001, t);
  b.exponentialRampToValueAtTime(0.05, t + 0.03);
  b.exponentialRampToValueAtTime(0.012, uEnd);
  b.linearRampToValueAtTime(0.02, oAt);
  b.setValueAtTime(0.02, oEnd);
  b.linearRampToValueAtTime(0.035, end - 0.06);
  b.exponentialRampToValueAtTime(0.0001, end + 0.05);
  air.connect(airBand).connect(airGain).connect(mouth);

  // a gentle presence lift: a shout carries in the 2–3 kHz range
  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 2600;
  presence.Q.value = 0.9;
  presence.gain.value = 4;
  mouth.connect(presence).connect(out);

  const stopAt = end + 0.1;
  for (const o of [src, vib, wob]) {
    o.start(t);
    o.stop(stopAt);
  }
  air.start(t, Math.random() * 0.5);
  air.stop(stopAt);
  // free the whole voice once it has finished
  air.onended = () => {
    for (const n of [src, vib, vibDepth, wob, wobDepth, voiced, mouth, body, bodyGain, air, airBand, airGain, presence, ...formants]) n.disconnect();
  };
  return end;
}
