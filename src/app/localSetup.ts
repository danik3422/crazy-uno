import { BOTNAMES, cleanTable, DEFAULT_RULES, isTheme } from '../game/content';
import type { GameConfig, LocalSetup } from '../game/engine';
import { seatByTeams, teamsOf } from '../game/teams';
import { readJson, STORAGE_KEYS, writeJson } from '../lib/storage';

/** First visit: you and two bots, with the default rules. */
const DEFAULT_SETUP: LocalSetup = {
  players: [{ name: 'Я', bot: false }, { name: BOTNAMES[0], bot: true }, { name: BOTNAMES[1], bot: true }],
  rules: DEFAULT_RULES,
};

/** The players, rules, table and theme of the last local game (anything added since then gets its default). */
export function loadLocalSetup(): LocalSetup {
  const saved = readJson<Partial<LocalSetup>>(STORAGE_KEYS.localSetup);
  if (saved && Array.isArray(saved.players)) {
    return {
      players: saved.players,
      rules: { ...DEFAULT_RULES, ...saved.rules },
      table: saved.table ? cleanTable(saved.table) : undefined,
      theme: isTheme(saved.theme) ? saved.theme : undefined,
    };
  }
  return { ...DEFAULT_SETUP, rules: { ...DEFAULT_SETUP.rules } };
}

export function saveLocalSetup(setup: LocalSetup) {
  writeJson(STORAGE_KEYS.localSetup, setup);
}

/** The game to start from the setup: in the teams format the sides alternate around the table. */
export function localGameConfig(setup: LocalSetup, round: number): GameConfig {
  if (!setup.table?.teams) return { ...setup, round };
  const { list, teams } = seatByTeams(setup.players, teamsOf(setup.players));
  return { ...setup, round, players: list.map((p, i) => ({ ...p, team: teams[i] })) };
}
