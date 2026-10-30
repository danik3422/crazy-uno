import { t } from '../i18n/core';
import type { CardType, Color, EventId, Rules, Table, ThemeId } from './types';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];

/** Colour names in the current language (a getter: reads the language at the moment it is used). */
export const CNAME: Record<Color, string> = Object.defineProperties({} as Record<Color, string>,
  Object.fromEntries(COLORS.map(c => [c, { get: () => t(`color.${c}`), enumerable: true }])));

export const HEX: Record<Color | 'black', string> = {
  red: '#e5413a', yellow: '#f2bf16', green: '#26a556', blue: '#2c79dc', black: '#19191d',
};

type SpecialType = Exclude<CardType, 'num'>;
const SYMS: Record<SpecialType, string> = {
  skip: '⊘', rev: '⇄', draw2: '+2', wild: '★', wild4: '+4', swap: '⇆', gift: '🎁', bomb: '💣', dare: '🎭', rain: '☔',
  mirror: '🪞', chaos: '🌪', dump: '🧹',
  // UNO Show 'Em No Mercy
  draw4: '+4', skipAll: '⊘', discardAll: '🗑️', wildRev4: '⇄', wild6: '+6', wild10: '+10', roulette: '🎡',
};

/**
 * Every special card: its symbol, and its name and description in the current language.
 * The name is what the card faces print on their label strip (the textures are repainted when the language changes).
 */
export const SPECIAL = Object.fromEntries(
  (Object.keys(SYMS) as SpecialType[]).map(k => [k, {
    sym: SYMS[k],
    get name() { return t(`card.${k}`); },
    get desc() { return t(`cardDesc.${k}`); },
  }]),
) as Record<SpecialType, { readonly sym: string; readonly name: string; readonly desc: string }>;

/** Wild cards (black, any colour may be named). */
export const WILD_TYPES: CardType[] = ['wild', 'wild4', 'chaos', 'dump', 'wildRev4', 'wild6', 'wild10', 'roulette'];

/** Cards that only come in the No Mercy deck. */
export const NO_MERCY_TYPES: CardType[] = ['draw4', 'skipAll', 'discardAll', 'wildRev4', 'wild6', 'wild10', 'roulette'];

/** No Mercy: holding this many cards knocks you out. */
export const MERCY_LIMIT = 25;

const RULE_DEFAULTS: [keyof Rules, boolean][] = [
  ['stack', true],
  ['sevenZero', true],
  ['crazy', true],
  ['dares', true],
  ['uno', true],
  ['timer', true],
  ['challenge', true],
  ['drawPlay', false],
  ['events', true],
  ['punish', true],
  ['startAction', false],
  ['noMercy', false],
  ['jumpIn', true],
];

/** Every rule: its default, and its name and description in the current language. */
export const RULES: { readonly id: keyof Rules; readonly name: string; readonly desc: string; readonly def: boolean }[] = RULE_DEFAULTS.map(([id, def]) => ({
  id,
  def,
  get name() { return t(`rule.${id}`); },
  get desc() { return t(`ruleDesc.${id}`); },
}));

export const DEFAULT_RULES = Object.fromEntries(RULES.map(r => [r.id, r.def])) as unknown as Rules;

/** How many dares, punishments and group dares each language has (the texts live in the dictionaries). */
export const DARE_COUNT = 30;
export const PUNISH_COUNT = 10;
export const GROUP_DARE_COUNT = 10;

const EVENT_IDS: EventId[] = ['meteor', 'recolor', 'mono', 'carousel', 'robin', 'upside', 'blind', 'blitz', 'lightning', 'jackpot', 'group', 'coin', 'bomber'];

/** Every random event: its name and description in the current language (the icons are drawn: three/themes/eventIcons.ts). */
export const EVENTS = Object.fromEntries(
  EVENT_IDS.map(id => [id, {
    get title() { return t(`ev.${id}`); },
    get desc() { return t(`evDesc.${id}`); },
  }]),
) as Record<EventId, { readonly title: string; readonly desc: string }>;

const THEME_IDS: ThemeId[] = ['classic', 'neon', 'space', 'halloween', 'winter'];
export const THEMES_LIST: { readonly id: ThemeId; readonly name: string; readonly desc: string }[] = THEME_IDS.map(id => ({
  id,
  get name() { return t(`theme.${id}`); },
  get desc() { return t(`themeDesc.${id}`); },
}));

export const isTheme = (t: unknown): t is ThemeId => THEMES_LIST.some(x => x.id === t);

/** How the rules are shown when setting up a game: grouped, with an icon and a one-line explanation. */
const GROUPS: { id: 'cards' | 'party' | 'pace'; rules: { id: keyof Rules; icon: string }[] }[] = [
  {
    id: 'cards',
    rules: [
      { id: 'stack', icon: '📚' }, { id: 'sevenZero', icon: '🔄' }, { id: 'crazy', icon: '🃏' },
      { id: 'drawPlay', icon: '♾️' }, { id: 'startAction', icon: '🎬' }, { id: 'jumpIn', icon: '⚡' }, { id: 'noMercy', icon: '💀' },
    ],
  },
  { id: 'party', rules: [{ id: 'uno', icon: '📣' }, { id: 'challenge', icon: '⚖️' }, { id: 'dares', icon: '🎭' }, { id: 'punish', icon: '😈' }] },
  { id: 'pace', rules: [{ id: 'timer', icon: '⏱' }, { id: 'events', icon: '🌪' }] },
];

export const RULE_GROUPS: { readonly id: string; readonly title: string; readonly hint: string; rules: { readonly id: keyof Rules; readonly icon: string; readonly short: string }[] }[] = GROUPS.map(g => ({
  id: g.id,
  get title() { return t(`ruleGroup.${g.id}`); },
  get hint() { return t(`ruleGroupHint.${g.id}`); },
  rules: g.rules.map(r => ({ ...r, get short() { return t(`ruleShort.${r.id}`); } })),
}));

/** One-click rule sets. */
export const PRESETS: { id: 'classic' | 'nomercy' | 'party' | 'chaos'; icon: string; readonly name: string; readonly desc: string; rules: Rules }[] = [
  {
    // the official rules of UNO (Mattel, 2023): no stacking, +4 only without a card to match (can be challenged),
    // draw one card and play it if it fits, and the pile starts with a number
    id: 'classic', icon: '🎴', get name() { return t('preset.classic'); }, get desc() { return t('presetDesc.classic'); },
    rules: { stack: false, sevenZero: false, crazy: false, dares: false, uno: true, drawPlay: false, punish: false, events: false, timer: true, challenge: true, noMercy: false, startAction: false, jumpIn: false },
  },
  {
    // the official rules of UNO Show 'Em No Mercy, nothing added
    id: 'nomercy', icon: '💀', get name() { return t('preset.nomercy'); }, get desc() { return t('presetDesc.nomercy'); },
    rules: { stack: true, sevenZero: true, crazy: false, dares: false, uno: true, drawPlay: true, punish: false, events: false, timer: true, challenge: false, noMercy: true, startAction: false, jumpIn: false },
  },
  {
    id: 'party', icon: '🎉', get name() { return t('preset.party'); }, get desc() { return t('presetDesc.party'); },
    rules: { stack: true, sevenZero: true, crazy: true, dares: true, uno: true, drawPlay: false, punish: true, events: true, timer: true, challenge: true, noMercy: false, startAction: false, jumpIn: true },
  },
  {
    id: 'chaos', icon: '🌪', get name() { return t('preset.chaos'); }, get desc() { return t('presetDesc.chaos'); },
    rules: { stack: true, sevenZero: true, crazy: true, dares: true, uno: true, drawPlay: true, punish: true, events: true, timer: true, challenge: true, noMercy: false, startAction: true, jumpIn: true },
  },
];

export function presetOf(r: Rules) {
  return PRESETS.find(p => (Object.keys(p.rules) as (keyof Rules)[]).every(k => p.rules[k] === r[k])) ?? null;
}

export const DEFAULT_TABLE: Table = { teams: false, quick: false, handSize: 7, turnSec: 30, bombSec: 10, unoPenalty: 2, roundMin: 0, events: 'normal', autopilot: false, botLevel: 'normal' };

/** The quick round overrides these numbers. */
export const QUICK = { handSize: 5, turnSec: 15, roundMin: 5 };

/** The allowed values for each number, shown as small segmented choices. */
export const TABLE_CHOICES = {
  handSize: [5, 7, 10],
  turnSec: [15, 30, 60],
  bombSec: [5, 10, 15],
  unoPenalty: [2, 4],
  roundMin: [0, 5, 10],
  events: ['rare', 'normal', 'often'] as const,
  botLevel: ['easy', 'normal', 'hard'] as const,
};

/** What a table actually plays with (quick round wins over the individual numbers). */
export function effectiveTable(t: Table): Table {
  return t.quick ? { ...t, ...QUICK } : t;
}

/** Keep only known keys and allowed values (anything else falls back to the default). */
export function cleanTable(raw: unknown): Table {
  const r = (raw ?? {}) as Partial<Record<keyof Table, unknown>>;
  const pick = <K extends keyof typeof TABLE_CHOICES>(k: K) =>
    ((TABLE_CHOICES[k] as readonly unknown[]).includes(r[k]) ? r[k] : DEFAULT_TABLE[k]) as Table[K];
  return {
    teams: r.teams === true,
    quick: r.quick === true,
    handSize: pick('handSize'),
    turnSec: pick('turnSec'),
    bombSec: pick('bombSec'),
    unoPenalty: pick('unoPenalty'),
    roundMin: pick('roundMin'),
    events: pick('events'),
    autopilot: r.autopilot === true,
    botLevel: pick('botLevel'),
  };
}

/** Team names in the current language: 0 red, 1 blue. */
export const teamName = (team: number) => t(team ? 'team.1' : 'team.0');
