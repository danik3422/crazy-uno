import { describe, expect, it } from 'vitest';
import { Limits, Window } from './limits';

describe('per-address limits', () => {
  it('counts hits in a sliding window and lets old ones expire', () => {
    const w = new Window(2, 1000);
    expect(w.take('a', 0)).toBe(true);
    expect(w.take('a', 100)).toBe(true);
    expect(w.blocked('a', 200)).toBe(true);
    expect(w.take('a', 200)).toBe(false);
    // a refused hit is not recorded: the window frees up when the first two expire
    expect(w.take('a', 1000)).toBe(true);
    expect(w.take('b', 200)).toBe(true);
  });

  it('peeks without recording, forgets keys and sweeps expired ones', () => {
    const w = new Window(1, 1000);
    expect(w.blocked('a', 0)).toBe(false);
    expect(w.blocked('a', 0)).toBe(false);
    w.take('a', 0);
    w.forget('a');
    expect(w.blocked('a', 1)).toBe(false);
    w.take('a', 0);
    w.take('b', 900);
    w.sweep(1500);
    expect(w.blocked('a', 1500)).toBe(false);
    expect(w.blocked('b', 1500)).toBe(true);
  });

  it('caps open connections per address and never goes below zero', () => {
    const l = new Limits({ connections: 2, rooms: 1, badJoins: 1, windowMs: 1000 });
    expect(l.open('x')).toBe(true);
    expect(l.open('x')).toBe(true);
    expect(l.open('x')).toBe(false);
    expect(l.open('y')).toBe(true);
    l.close('x');
    expect(l.open('x')).toBe(true);
    l.close('z');
    l.close('z');
    expect(l.open('z')).toBe(true);
    expect(l.open('z')).toBe(true);
    expect(l.open('z')).toBe(false);
  });
});
