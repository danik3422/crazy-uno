import { botNames, t } from '../i18n/core';
import type { StrKey } from '../i18n/types';

/**
 * Preset avatars. Players cannot upload pictures, so they pick one of these drawn portraits
 * (people, animals, creatures, food and card characters); bots get robot portraits.
 * This file is only the list (shared with the server, which checks ids); the pictures are painted
 * by src/art/avatarArt.ts.
 *
 * Ids are stable: they are saved in players' browsers and sent to the server. The first avatars were
 * emoji tiles with the same ids (fox, frog, … and bot-red … bot-steel); every one of those ids is still
 * here, now drawn, so a saved choice keeps its character. Should an id ever be retired, add it to
 * LEGACY with the closest new one.
 */
export type AvatarKind = 'animal' | 'person' | 'fantasy' | 'food' | 'card' | 'robot';

export interface Avatar {
  id: string;
  /** what the picture shows, in the current language (for screen readers and tooltips) */
  readonly label: string;
  /** tile gradient (top-left → bottom-right), also the placeholder while the picture paints */
  bg: [string, string];
  kind: AvatarKind;
}

type Row = [id: string, kind: AvatarKind, from: string, to: string];

/** two pages of 24 in the picker, in this order (mixed so every page has a bit of everything) */
const HUMAN_LIST: Row[] = [
  // page 1
  ['fox', 'animal', '#8fe6ff', '#3a8ff0'],
  ['cool', 'person', '#ffd36b', '#ff8a3a'],
  ['frog', 'animal', '#ffd6f0', '#ff79c0'],
  ['puffs', 'person', '#b8f5c8', '#2fbf8a'],
  ['panda', 'animal', '#d6f58a', '#5cbf4c'],
  ['wizard', 'fantasy', '#ffe28a', '#ffa82e'],
  ['cat', 'animal', '#a8d8ff', '#6a7cff'],
  ['cardy', 'card', '#fff2a0', '#ffc62e'],
  ['beard', 'person', '#ffc2c2', '#ff6b6b'],
  ['unicorn', 'fantasy', '#c8b8ff', '#7c5cff'],
  ['pizza', 'food', '#a8f0ff', '#2fb0d8'],
  ['tiger', 'animal', '#9af0c8', '#1fae7a'],
  ['granny', 'person', '#b8e2ff', '#5aa8f0'],
  ['ghost', 'fantasy', '#8a7cf8', '#3a2a9a'],
  ['penguin', 'animal', '#ffe9a8', '#ffb43a'],
  ['cowboy', 'person', '#a8f0ff', '#3ab0e0'],
  ['axolotl', 'animal', '#b0f0e8', '#2fbfb0'],
  ['dragon', 'fantasy', '#ffd0a0', '#ff7a3a'],
  ['kid', 'person', '#c6f5a0', '#5cc94a'],
  ['taco', 'food', '#ffb0c8', '#ff5a8a'],
  ['owl', 'animal', '#a0f0d8', '#20b890'],
  ['hijabi', 'person', '#ffd9a8', '#ff9a5a'],
  ['alien', 'fantasy', '#d6b8ff', '#8a4dff'],
  ['capybara', 'animal', '#9fe8ff', '#4ab0f0'],
  // page 2
  ['bear', 'animal', '#c8f5d8', '#4cc98a'],
  ['punk', 'person', '#fff2a0', '#ffcf2e'],
  ['octopus', 'fantasy', '#9fe0ff', '#2f8fe0'],
  ['monkey', 'animal', '#ffe36b', '#ff9a1f'],
  ['chef', 'person', '#ffb8b0', '#ff5a5a'],
  ['plus4', 'card', '#ffe14a', '#ff8a1f'],
  ['bunny', 'animal', '#ffd0e0', '#ff7aa8'],
  ['mermaid', 'fantasy', '#ffd6b8', '#ff8a6a'],
  ['cactus', 'food', '#ffe0a8', '#ffaa4a'],
  ['lion', 'animal', '#9ad8ff', '#4a7cf0'],
  ['rocker', 'person', '#c0ffb0', '#4cd06a'],
  ['dino', 'fantasy', '#ffb8e0', '#c85af0'],
  ['raccoon', 'animal', '#ffe9a8', '#ffb43a'],
  ['knight', 'fantasy', '#b8c8ff', '#5a6cf0'],
  ['donut', 'food', '#a8f0ff', '#2fb0d8'],
  ['curly', 'person', '#ffd36b', '#ff8a3a'],
  ['pig', 'animal', '#c8f58a', '#4cbf4c'],
  ['vampire', 'fantasy', '#ff8a9a', '#c8203a'],
  ['pumpkin', 'food', '#6a4ab8', '#2a1a5a'],
  ['astronaut', 'person', '#4a5ac8', '#1a1a5a'],
  ['clown', 'person', '#a8f0ff', '#3ab0e0'],
  ['mushroom', 'food', '#b8f5c8', '#2fbf8a'],
  ['pirate', 'person', '#9fe8ff', '#2f8fe0'],
  ['wildstar', 'card', '#4a3a6a', '#140a24'],
];

const BOT_LIST: Row[] = [
  ['bot-red', 'robot', '#e4c6ff', '#a77bf0'],
  ['bot-blue', 'robot', '#ffd7a8', '#ff9d5c'],
  ['bot-mint', 'robot', '#fff2a0', '#ffd23f'],
  ['bot-gold', 'robot', '#b8e2ff', '#5aa8f0'],
  ['bot-pink', 'robot', '#c8f5d8', '#5cc98a'],
  ['bot-steel', 'robot', '#ffc2c2', '#ff6b6b'],
  ['bot-lime', 'robot', '#d6c8ff', '#7c5cff'],
  ['bot-violet', 'robot', '#fff0a0', '#ffc83a'],
  ['bot-orange', 'robot', '#a8f0ff', '#2fb0d8'],
  ['bot-cyan', 'robot', '#ffc8e8', '#ff6fb6'],
  ['bot-navy', 'robot', '#ffe0a8', '#ffa84a'],
  ['bot-cream', 'robot', '#9af0c8', '#1fae7a'],
  ['bot-coral', 'robot', '#b0e8ff', '#4a90f0'],
  ['bot-teal', 'robot', '#ffd0c0', '#ff7a5a'],
  ['bot-ink', 'robot', '#ff9ab8', '#e8306a'],
  ['bot-sun', 'robot', '#c8b8ff', '#6a4cff'],
];

const labelled = (list: Row[]): Avatar[] =>
  list.map(([id, kind, from, to]) => ({ id, kind, bg: [from, to], get label() { return t(`avatar.${id}` as StrKey); } }));
export const HUMAN_AVATARS = labelled(HUMAN_LIST);
export const BOT_AVATARS = labelled(BOT_LIST);

/** avatars shown per picker page */
export const AVATAR_PAGE = 24;

export const ALL_AVATARS = [...HUMAN_AVATARS, ...BOT_AVATARS];
const byId = new Map(ALL_AVATARS.map(a => [a.id, a]));

/** retired ids → the closest current avatar (empty so far: every id ever shipped is still drawn) */
export const LEGACY: Readonly<Record<string, string>> = {};

/** the current id for a saved or received one (follows LEGACY), or undefined if unknown */
export function canonicalAvatar(id: unknown): string | undefined {
  if (typeof id !== 'string') return undefined;
  const to = LEGACY[id] ?? id;
  return byId.has(to) ? to : undefined;
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The chosen avatar, or a stable pick based on the name when none was chosen. */
export function avatarOf(id: string | undefined, name: string, bot: boolean): Avatar {
  const c = canonicalAvatar(id);
  const a = c ? byId.get(c) : undefined;
  if (a) return a;
  const pool = bot ? BOT_AVATARS : HUMAN_AVATARS;
  return pool[hash(name) % pool.length];
}

/** accepts every current id and every retired one (older clients may still send those) */
export function isAvatarId(id: unknown): id is string {
  return canonicalAvatar(id) !== undefined;
}

/**
 * A new bot: a random name (from `pool`, by default the current language's) and a random robot face,
 * preferring ones nobody at the table has yet. `rng` defaults to Math.random.
 */
export function randomBot(
  taken: readonly { name: string; avatar?: string }[],
  rng: () => number = Math.random,
  pool: readonly string[] = botNames(),
): { name: string; avatar: string } {
  const pick = <T,>(all: readonly T[], free: readonly T[]) => (free.length ? free : all)[Math.floor(rng() * (free.length || all.length))];
  const names = new Set(taken.map(p => p.name));
  const faces = new Set(taken.map(p => canonicalAvatar(p.avatar)));
  let name = pick(pool, pool.filter(n => !names.has(n)));
  // every name in use: number it
  for (let i = 2; names.has(name); i++) name = `${name.replace(/ \d+$/, '')} ${i}`;
  const avatar = pick(BOT_AVATARS, BOT_AVATARS.filter(a => !faces.has(a.id))).id;
  return { name, avatar };
}

export function randomHumanAvatar() {
  return HUMAN_AVATARS[Math.floor(Math.random() * HUMAN_AVATARS.length)].id;
}

/**
 * Who is shown in the seat of someone whose connection dropped: a bot with its own name and robot face.
 * Picked from the person's name, so the same person always gets the same stand-in.
 */
export function standIn(name: string) {
  const h = hash(name);
  // one of the first few bot names of the reader's language
  const names = botNames().slice(0, 7);
  return { name: names[h % names.length], avatar: BOT_AVATARS[h % BOT_AVATARS.length].id };
}
