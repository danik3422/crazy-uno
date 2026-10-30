import { describe, expect, it } from 'vitest';
import { ALL_AVATARS, AVATAR_PAGE, avatarOf, BOT_AVATARS, canonicalAvatar, HUMAN_AVATARS, isAvatarId, LEGACY, randomBot } from '../game/avatars';
import { en } from '../i18n/en';
import { pl } from '../i18n/pl';
import { ru } from '../i18n/ru';
import { drawAvatar, hasArt } from './avatarArt';

/** every id that was ever shipped (the first, emoji-based set): saved in browsers, sent by older clients */
const OLD_IDS = [
  'fox', 'frog', 'panda', 'unicorn', 'octopus', 'monkey', 'tiger', 'penguin', 'alien', 'ghost', 'dino', 'dragon', 'cat', 'pizza', 'cactus',
  'pumpkin', 'clown', 'cowboy', 'cool', 'capybara', 'bot-red', 'bot-blue', 'bot-mint', 'bot-gold', 'bot-pink', 'bot-steel',
];

/**
 * A stand-in for a 2D canvas context (tests run without a DOM): records the calls, returns dummy
 * gradients, and throws on anything a real context would reject (non-finite numbers).
 */
function fakeCtx() {
  const calls: string[] = [];
  const gradient = { addColorStop: (o: number, c: string) => { if (!(o >= 0 && o <= 1) || typeof c !== 'string') throw new Error(`bad stop ${o} ${c}`); } };
  const state: Record<string, unknown> = {};
  const ctx = new Proxy(state, {
    get(t, k: string) {
      if (k in t) return t[k];
      if (k === 'getTransform') return () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
      if (k === 'measureText') return () => ({ width: 10 });
      return (...args: unknown[]) => {
        for (const a of args) if (typeof a === 'number' && !Number.isFinite(a)) throw new Error(`${k}: non-finite argument`);
        calls.push(k);
        if (k.startsWith('create')) return gradient;
        return undefined;
      };
    },
    set(t, k: string, v) {
      t[k] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe('avatars', () => {
  it('has at least two full pages of people and sixteen robots, all with unique ids', () => {
    expect(HUMAN_AVATARS.length).toBeGreaterThanOrEqual(AVATAR_PAGE * 2);
    expect(BOT_AVATARS.length).toBeGreaterThanOrEqual(16);
    const ids = ALL_AVATARS.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of BOT_AVATARS) expect(a.kind).toBe('robot');
    for (const a of HUMAN_AVATARS) expect(a.kind).not.toBe('robot');
  });

  it('draws every avatar (a real picture, not an empty tile) at chip and picker sizes', () => {
    for (const a of ALL_AVATARS) {
      expect(hasArt(a.id), a.id).toBe(true);
      for (const px of [56, 192]) {
        const { ctx, calls } = fakeCtx();
        drawAvatar(ctx, a, px);
        expect(calls.filter(c => c === 'fill' || c === 'stroke').length, a.id).toBeGreaterThan(25);
      }
    }
  });

  it('pictures are not copies of each other', () => {
    const seen = new Map<string, string>();
    for (const a of ALL_AVATARS) {
      const { ctx, calls } = fakeCtx();
      drawAvatar(ctx, a, 192);
      const sig = calls.join(',');
      expect(seen.get(sig), `${a.id} draws exactly like ${seen.get(sig)}`).toBeUndefined();
      seen.set(sig, a.id);
    }
  });

  it('has a label in every language', () => {
    for (const s of [ru.s, en.s, pl.s] as Record<string, unknown>[]) {
      for (const a of ALL_AVATARS) expect(typeof s[`avatar.${a.id}`], a.id).toBe('string');
    }
  });

  it('keeps every old saved id working, mapped to a drawn avatar of the same kind', () => {
    for (const id of OLD_IDS) {
      expect(isAvatarId(id), id).toBe(true);
      const now = canonicalAvatar(id)!;
      expect(hasArt(now), id).toBe(true);
      expect(avatarOf(id, 'x', false).id).toBe(now);
      expect(now.startsWith('bot-'), id).toBe(id.startsWith('bot-'));
    }
    for (const [from, to] of Object.entries(LEGACY)) {
      expect(isAvatarId(from)).toBe(true);
      expect(ALL_AVATARS.some(a => a.id === to)).toBe(true);
    }
    expect(isAvatarId('nope')).toBe(false);
    expect(isAvatarId(42)).toBe(false);
  });

  it('gives every bot at a table its own robot face', () => {
    let seed = 7;
    const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const table: { name: string; avatar?: string }[] = [{ name: 'Me', avatar: 'fox' }];
    for (let i = 0; i < 15; i++) table.push(randomBot(table, rng, ['A', 'B', 'C']));
    const faces = table.slice(1).map(b => b.avatar);
    expect(new Set(faces).size).toBe(faces.length);
    for (const f of faces) expect(BOT_AVATARS.some(a => a.id === f)).toBe(true);
  });
});
