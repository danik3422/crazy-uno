import { describe, expect, it } from 'vitest';
import { Kit } from './kit';
import { PALETTES, SFX_IDS } from './palettes';
import { renderSfx } from './sound';

/**
 * A stand-in for a Web Audio context that is as strict as the real one about values
 * (an exponential ramp to 0 or a NaN throws in browsers), and counts what gets built and freed.
 */
class FakeParam {
  value = 1;
  private check(v: number, positive = false) {
    if (!Number.isFinite(v)) throw new RangeError(`non-finite value ${v}`);
    if (positive && v <= 0) throw new RangeError(`exponential ramp to ${v}`);
  }
  setValueAtTime(v: number, t: number) { this.check(v); this.check(t); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.check(v); this.check(t); return this; }
  exponentialRampToValueAtTime(v: number, t: number) { this.check(v, true); this.check(t); return this; }
  setTargetAtTime(v: number, t: number, c: number) { this.check(v); this.check(t); this.check(c); return this; }
  cancelScheduledValues() { return this; }
}

class FakeCtx {
  currentTime = 0;
  sampleRate = 48000;
  nodes: FakeNode[] = [];
  sources: FakeNode[] = [];
  private make(extra: Record<string, unknown> = {}, source = false) {
    const n = new FakeNode(this, extra);
    this.nodes.push(n);
    if (source) this.sources.push(n);
    return n;
  }
  createGain() { return this.make({ gain: new FakeParam() }); }
  createOscillator() { return this.make({ frequency: new FakeParam(), detune: new FakeParam(), type: 'sine' }, true); }
  createBufferSource() { return this.make({ buffer: null, loop: false, playbackRate: new FakeParam() }, true); }
  createBiquadFilter() { return this.make({ frequency: new FakeParam(), Q: new FakeParam(), gain: new FakeParam(), type: 'lowpass' }); }
  createWaveShaper() { return this.make({ curve: null }); }
  createBuffer(ch: number, len: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { getChannelData: (i: number) => data[i], length: len, numberOfChannels: ch };
  }
}

class FakeNode {
  connected = 0;
  started: number | null = null;
  stopped: number | null = null;
  onended: (() => void) | null = null;
  private listeners: (() => void)[] = [];
  constructor(readonly ctx: FakeCtx, extra: Record<string, unknown>) { Object.assign(this, extra); }
  connect<T>(n: T) { this.connected++; return n; }
  disconnect() { this.connected = 0; }
  start(t = 0) { if (!Number.isFinite(t)) throw new RangeError('start'); this.started = t; }
  stop(t = 0) { if (!Number.isFinite(t)) throw new RangeError('stop'); this.stopped = t; }
  setPeriodicWave() {}
  addEventListener(_: string, f: () => void) { this.listeners.push(f); }
  /** the source has finished: like the browser, fire its 'ended' handlers */
  end() { this.onended?.(); this.listeners.forEach(f => f()); }
}
// the voice builds a periodic wave
(FakeCtx.prototype as unknown as { createPeriodicWave: () => object }).createPeriodicWave = () => ({});

/** the big moments may ring a little longer */
const LONG = new Set(['win', 'lose', 'boom', 'thunder', 'challenge']);

const themes = Object.keys(PALETTES) as (keyof typeof PALETTES)[];

describe('sound palettes', () => {
  it('cover every table, the winter one included', () => {
    expect(themes).toEqual(expect.arrayContaining(['classic', 'neon', 'space', 'halloween', 'winter']));
  });

  for (const theme of themes) {
    it(`${theme}: implements every sound id`, () => {
      const pal = PALETTES[theme];
      for (const id of SFX_IDS) expect(typeof pal.sfx[id], `${theme}.${id}`).toBe('function');
      expect(Object.keys(pal.sfx).sort()).toEqual([...SFX_IDS].sort());
    });

    it(`${theme}: every sound builds, ends, stays small and frees its nodes`, () => {
      for (const id of SFX_IDS) {
        const ctx = new FakeCtx();
        const bus = ctx.createGain();
        const noise = ctx.createBuffer(1, 10) as unknown as AudioBuffer;
        const end = renderSfx(ctx as unknown as BaseAudioContext, bus as unknown as AudioNode, noise, theme, id, 1, 3);
        expect(end, `${theme}.${id} ends`).toBeGreaterThan(1);
        expect(end - 1, `${theme}.${id} is short`).toBeLessThan(LONG.has(id) ? 2.2 : 1.6);
        // phones: no sound may build a huge graph
        expect(ctx.nodes.length, `${theme}.${id} nodes`).toBeLessThan(160);
        for (const s of ctx.sources) {
          expect(s.started, `${theme}.${id} started`).not.toBeNull();
          expect(s.stopped, `${theme}.${id} stopped`).not.toBeNull();
        }
        // everything is freed once the sources have ended
        ctx.sources.forEach(s => s.end());
        const left = ctx.nodes.filter(n => n !== bus && n.connected > 0);
        expect(left.length, `${theme}.${id} leaked nodes`).toBe(0);
      }
    });

    it(`${theme}: the music loop plays through without errors`, () => {
      const ctx = new FakeCtx();
      const out = ctx.createGain();
      const k = new Kit(ctx as unknown as BaseAudioContext, out as unknown as AudioNode, ctx.createBuffer(1, 10) as unknown as AudioBuffer);
      const song = PALETTES[theme].song;
      const sd = 60 / song.bpm / 4;
      const steps = song.stepsPerBar * song.bars;
      for (let i = 0; i < steps; i++) song.step(k, i, i * sd, sd);
      expect(ctx.sources.length).toBeGreaterThan(steps / 4);
      // not too busy for a phone: on average only a few notes per 16th
      expect(ctx.sources.length / steps).toBeLessThan(12);
    });
  }
});
