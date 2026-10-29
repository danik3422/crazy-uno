import { botNames, t } from '../i18n/core';
import type { StrKey } from '../i18n/types';

/**
 * Preset avatars. Players cannot upload pictures, so they pick one of these:
 * animal emoji tiles for people and hand-drawn SVG robots for bots.
 */
export interface Avatar {
  id: string;
  /** what the picture shows, in the current language (for screen readers and tooltips) */
  readonly label: string;
  /** tile gradient */
  bg: [string, string];
  emoji?: string;
  robot?: RobotLook;
}

interface RobotLook {
  body: string;
  face: string;
  eye: string;
  head: 'round' | 'square' | 'dome';
  antenna: 'ball' | 'bolt' | 'twin';
}

const HUMAN_LIST: Omit<Avatar, 'label'>[] = [
  { id: 'fox', emoji: '🦊', bg: ['#ffb36b', '#ff6a3d'] },
  { id: 'frog', emoji: '🐸', bg: ['#b8f28a', '#3fbf5b'] },
  { id: 'panda', emoji: '🐼', bg: ['#e9edf5', '#9aa6c0'] },
  { id: 'unicorn', emoji: '🦄', bg: ['#ffc6f1', '#b07cff'] },
  { id: 'octopus', emoji: '🐙', bg: ['#ffb0c8', '#ff5a8a'] },
  { id: 'monkey', emoji: '🐵', bg: ['#ffd9a0', '#d9893b'] },
  { id: 'tiger', emoji: '🐯', bg: ['#ffe36b', '#ff9a1f'] },
  { id: 'penguin', emoji: '🐧', bg: ['#a8e6ff', '#3b8fe0'] },
  { id: 'alien', emoji: '👽', bg: ['#c8ff9a', '#5ac83a'] },
  { id: 'ghost', emoji: '👻', bg: ['#d8d0ff', '#7c6cf0'] },
  { id: 'dino', emoji: '🦖', bg: ['#9af0c8', '#1fae7a'] },
  { id: 'dragon', emoji: '🐲', bg: ['#a0ffd0', '#1f9e6a'] },
  { id: 'cat', emoji: '😼', bg: ['#ffe0a8', '#ff9f43'] },
  { id: 'pizza', emoji: '🍕', bg: ['#ffe9a8', '#ff7b3a'] },
  { id: 'cactus', emoji: '🌵', bg: ['#d6f5a0', '#6cbf3a'] },
  { id: 'pumpkin', emoji: '🎃', bg: ['#ffcb7a', '#f06a1a'] },
  { id: 'clown', emoji: '🤡', bg: ['#fff0f0', '#ff6b6b'] },
  { id: 'cowboy', emoji: '🤠', bg: ['#ffe2a8', '#c98a3b'] },
  { id: 'cool', emoji: '😎', bg: ['#a8f0ff', '#2fa8e0'] },
  { id: 'capybara', emoji: '🦫', bg: ['#e8c9a0', '#a0703b'] },
];

const BOT_LIST: Omit<Avatar, 'label'>[] = [
  { id: 'bot-red', bg: ['#e4c6ff', '#a77bf0'], robot: { body: '#e8402f', face: '#3a1a14', eye: '#ffcf4a', head: 'round', antenna: 'ball' } },
  { id: 'bot-blue', bg: ['#ffd7a8', '#ff9d5c'], robot: { body: '#6f7fe0', face: '#24264a', eye: '#ffe066', head: 'dome', antenna: 'ball' } },
  { id: 'bot-mint', bg: ['#fff2a0', '#ffd23f'], robot: { body: '#55d6b0', face: '#163a33', eye: '#ff6b5e', head: 'square', antenna: 'twin' } },
  { id: 'bot-gold', bg: ['#b8e2ff', '#5aa8f0'], robot: { body: '#f2b822', face: '#3b2a05', eye: '#5ae0ff', head: 'square', antenna: 'bolt' } },
  { id: 'bot-pink', bg: ['#c8f5d8', '#5cc98a'], robot: { body: '#ff7fb6', face: '#40142a', eye: '#ffffff', head: 'round', antenna: 'twin' } },
  { id: 'bot-steel', bg: ['#ffc2c2', '#ff6b6b'], robot: { body: '#9aa8bd', face: '#1d2330', eye: '#7dff8a', head: 'dome', antenna: 'bolt' } },
];

const labelled = (list: Omit<Avatar, 'label'>[]): Avatar[] =>
  list.map(a => ({ ...a, get label() { return t(`avatar.${a.id}` as StrKey); } }));
export const HUMAN_AVATARS = labelled(HUMAN_LIST);
export const BOT_AVATARS = labelled(BOT_LIST);

export const ALL_AVATARS = [...HUMAN_AVATARS, ...BOT_AVATARS];
const byId = new Map(ALL_AVATARS.map(a => [a.id, a]));

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The chosen avatar, or a stable pick based on the name when none was chosen. */
export function avatarOf(id: string | undefined, name: string, bot: boolean): Avatar {
  const a = id ? byId.get(id) : undefined;
  if (a) return a;
  const pool = bot ? BOT_AVATARS : HUMAN_AVATARS;
  return pool[hash(name) % pool.length];
}

export function isAvatarId(id: unknown): id is string {
  return typeof id === 'string' && byId.has(id);
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
  const faces = new Set(taken.map(p => p.avatar));
  let name = pick(pool, pool.filter(n => !names.has(n)));
  // every name in use: number it
  for (let i = 2; names.has(name); i++) name = `${name.replace(/ \d+$/, '')} ${i}`;
  const avatar = pick(BOT_AVATARS, BOT_AVATARS.filter(a => !faces.has(a.id))).id;
  return { name, avatar };
}

export function randomHumanAvatar() {
  return HUMAN_AVATARS[Math.floor(Math.random() * HUMAN_AVATARS.length)].id;
}

/** Cute robot portrait as an SVG string (head + shoulders, big glowing eyes). */
export function robotSvg(r: RobotLook): string {
  const head =
    r.head === 'round'
      ? `<circle cx="50" cy="44" r="26" fill="${r.body}"/>`
      : r.head === 'dome'
        ? `<path d="M22 52 Q22 16 50 16 Q78 16 78 52 Z" fill="${r.body}"/>`
        : `<rect x="23" y="20" width="54" height="46" rx="10" fill="${r.body}"/>`;
  const antenna =
    r.antenna === 'ball'
      ? `<line x1="50" y1="18" x2="50" y2="6" stroke="${r.face}" stroke-width="3"/><circle cx="50" cy="6" r="5" fill="${r.eye}"/>`
      : r.antenna === 'twin'
        ? `<line x1="38" y1="20" x2="32" y2="7" stroke="${r.face}" stroke-width="3"/><line x1="62" y1="20" x2="68" y2="7" stroke="${r.face}" stroke-width="3"/><circle cx="32" cy="7" r="4" fill="${r.eye}"/><circle cx="68" cy="7" r="4" fill="${r.eye}"/>`
        : `<path d="M50 18 L45 9 L52 10 L48 1" fill="none" stroke="${r.eye}" stroke-width="3" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M18 100 Q18 72 50 72 Q82 72 82 100 Z" fill="${r.body}"/>
  <circle cx="40" cy="86" r="4" fill="${r.eye}"/><circle cx="56" cy="88" r="3" fill="${r.face}"/>
  <rect x="44" y="64" width="12" height="10" fill="${r.face}" opacity=".5"/>
  ${antenna}${head}
  <rect x="30" y="32" width="40" height="24" rx="12" fill="${r.face}"/>
  <circle cx="41" cy="44" r="5.5" fill="${r.eye}"/><circle cx="59" cy="44" r="5.5" fill="${r.eye}"/>
  <circle cx="42.5" cy="42.5" r="1.8" fill="#fff"/><circle cx="60.5" cy="42.5" r="1.8" fill="#fff"/>
  <path d="M44 51 Q50 55 56 51" stroke="${r.eye}" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="21" cy="44" r="5" fill="${r.face}"/><circle cx="79" cy="44" r="5" fill="${r.face}"/>
</svg>`;
}

export function robotDataUrl(r: RobotLook) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(robotSvg(r))}`;
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
