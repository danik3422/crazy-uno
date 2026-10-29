import { cleanTable, DEFAULT_RULES, isTheme } from '../game/content';
import { randomBot } from '../game/avatars';
import { botNames, t } from '../i18n/core';
import type { GameConfig, LocalSetup } from '../game/engine';
import { seatByTeams, teamsOf } from '../game/teams';
import { readJson, STORAGE_KEYS, writeJson } from '../lib/storage';

/** First visit: you and two bots (named in the current language), with the default rules. */
const defaultSetup = (): LocalSetup => ({
  players: [{ name: t('setup.me'), bot: false }, { name: botNames()[0], bot: true }, { name: botNames()[1], bot: true }],
  rules: { ...DEFAULT_RULES },
});

/** The players, rules, table and theme of the last local game (anything added since then gets its default). */
export function loadLocalSetup(): LocalSetup {
  const saved = readJson<Partial<LocalSetup>>(STORAGE_KEYS.localSetup);
  if (saved && Array.isArray(saved.players)) {
    // the people stay as they were; every bot sits down fresh, with a new name (in the current language) and face
    const players: LocalSetup['players'] = [];
    for (const p of saved.players) players.push(p.bot ? { ...p, ...randomBot([...saved.players.filter(q => !q.bot), ...players]) } : p);
    return {
      players,
      rules: { ...DEFAULT_RULES, ...saved.rules },
      table: saved.table ? cleanTable(saved.table) : undefined,
      theme: isTheme(saved.theme) ? saved.theme : undefined,
    };
  }
  return defaultSetup();
}

export function saveLocalSetup(setup: LocalSetup) {
  writeJson(STORAGE_KEYS.localSetup, setup);
}

/** The game to start from the setup: in the teams format the sides alternate around the table. */
export function localGameConfig(raw: LocalSetup, round: number): GameConfig {
  // a name left empty becomes "Player 3" in the current language
  const setup = { ...raw, players: raw.players.map((p, i) => (p.name.trim() ? p : { ...p, name: t('setup.playerN', { n: i + 1 }) })) };
  if (!setup.table?.teams) return { ...setup, round };
  const { list, teams } = seatByTeams(setup.players, teamsOf(setup.players));
  return { ...setup, round, players: list.map((p, i) => ({ ...p, team: teams[i] })) };
}
