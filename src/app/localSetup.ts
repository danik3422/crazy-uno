import { BOTNAMES, DEFAULT_RULES } from '../game/content';
import type { LocalSetup } from '../game/engine';
import { readJson, STORAGE_KEYS, writeJson } from '../lib/storage';

/** First visit: you and two bots, with the default rules. */
const DEFAULT_SETUP: LocalSetup = {
  players: [{ name: 'Я', bot: false }, { name: BOTNAMES[0], bot: true }, { name: BOTNAMES[1], bot: true }],
  rules: DEFAULT_RULES,
};

/** The players and rules of the last local game (rules added since then get their defaults). */
export function loadLocalSetup(): LocalSetup {
  const saved = readJson<Partial<LocalSetup>>(STORAGE_KEYS.localSetup);
  if (saved && Array.isArray(saved.players)) return { players: saved.players, rules: { ...DEFAULT_RULES, ...saved.rules } };
  return { ...DEFAULT_SETUP, rules: { ...DEFAULT_SETUP.rules } };
}

export function saveLocalSetup(setup: LocalSetup) {
  writeJson(STORAGE_KEYS.localSetup, setup);
}
