import { STORAGE_KEYS, readJson, writeJson } from '../../lib/storage';
import { type Achievement, type Stats, cleanStats, unlockNew } from '../../game/stats';

/** The player's record on this device, shared by the game (which adds to it) and the profile screen. */
let stats: Stats = cleanStats(readJson(STORAGE_KEYS.stats));
let version = 0;
const subs = new Set<() => void>();
const unlockSubs = new Set<(a: Achievement) => void>();

export const profile = {
  get: () => stats,
  getVersion: () => version,
  subscribe(f: () => void) {
    subs.add(f);
    return () => { subs.delete(f); };
  },
  /** called for every achievement the moment it is unlocked (the in-game toast) */
  onUnlock(f: (a: Achievement) => void) {
    unlockSubs.add(f);
    return () => { unlockSubs.delete(f); };
  },
  /** Changes the record, saves it, and announces any achievement it unlocks. */
  update(f: (s: Stats) => Stats) {
    const { stats: next, fresh } = unlockNew(f(stats));
    if (next === stats) return;
    stats = next;
    version++;
    writeJson(STORAGE_KEYS.stats, stats);
    subs.forEach(g => g());
    fresh.forEach(a => unlockSubs.forEach(g => g(a)));
  },
};
