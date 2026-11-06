import { describe, expect, it } from 'vitest';
import { REACTION_BURST, REACTION_COOLDOWN_MS, REACTION_WINDOW_MS, ReactionLimiter, isReactionId } from './reactions';

describe('quick reactions', () => {
  it('knows only its own faces and phrases', () => {
    expect(isReactionId('laugh')).toBe(true);
    expect(isReactionId('gg')).toBe(true);
    for (const id of ['villain', 'sneaky', 'lucky', 'close', 'revenge', 'again']) expect(isReactionId(id)).toBe(true);
    expect(isReactionId('anything else')).toBe(false);
    expect(isReactionId(3)).toBe(false);
  });

  it('rests after each reaction and after a burst', () => {
    const l = new ReactionLimiter();
    let now = 1_000_000;
    expect(l.take(now)).toBe(true);
    expect(l.take(now + 100)).toBe(false);
    expect(l.wait(now + 100)).toBe(REACTION_COOLDOWN_MS - 100);
    for (let i = 1; i < REACTION_BURST; i++) {
      now += REACTION_COOLDOWN_MS;
      expect(l.take(now)).toBe(true);
    }
    // the burst is used up: the next one waits until the first leaves the window
    now += REACTION_COOLDOWN_MS;
    expect(l.take(now)).toBe(false);
    expect(l.take(1_000_000 + REACTION_WINDOW_MS)).toBe(true);
  });
});
