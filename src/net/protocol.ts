import type { Rules, State, Table, ThemeId } from '../game/types';

/** Shared between the browser client and the Node server. */

export interface MemberInfo {
  id: string;
  name: string;
  bot: boolean;
  avatar?: string;
  connected: boolean;
  /** joined while a round was running: watches now, plays from the next round */
  spectator: boolean;
  host: boolean;
}

export interface RoomInfo {
  code: string;
  you: string;
  members: MemberInfo[];
  rules: Rules;
  theme: ThemeId;
  table: Table;
  score: Record<string, number>;
  started: boolean;
  /** after a round: who pressed "Ещё раунд", and when the next round starts once everyone has */
  rematch: Rematch | null;
}

export interface Rematch {
  /** member ids that are ready */
  ready: string[];
  /** member ids we are waiting for (seated people who are online) */
  waiting: string[];
  /** ms until the next round starts, measured when this message was sent; null = still waiting */
  startsIn: number | null;
}

export const REMATCH_COUNTDOWN_MS = 5_000;

/**
 * A game state as one player may see it: other hands are face-down placeholders,
 * the deck is just a count, and choices are only shown to whoever must make them.
 */
export interface PlayerView {
  you: number | null;
  state: State;
  deckCount: number;
  /** round start: who is still loading, and when the deal begins / ends (server ms) */
  warmup: Warmup;
}

export interface Warmup {
  /** player indices whose screen is not ready yet */
  waiting: number[];
  /** player indices whose table is drawn but whose phone is still held upright */
  turning?: number[];
  dealAt: number | null;
  dealEnd: number | null;
}

/** How long the opening deal takes: one card at a time around the table, then the first card of the pile. */
export const DEAL_STEP_MS = 55;
/** the deck is shuffled in the middle of the table right before the deal */
export const SHUFFLE_MS = 1900;
/** after the last hand card leaves, the deck slides from the middle to its spot; only then the pile gets its first card */
export const DECK_SLIDE_MS = 650;
export function dealTiming(players: number, handSize = 7) {
  const handsMs = players * handSize * DEAL_STEP_MS;
  const slideMs = handsMs + 150;
  const pileMs = slideMs + DECK_SLIDE_MS + 50;
  // the pile card's flight, and a breath before play
  return { handsMs, slideMs, pileMs, totalMs: pileMs + 420 + 300 };
}
export const dealMs = (players: number, handSize = 7) => dealTiming(players, handSize).totalMs;
/** Nobody waits longer than this for a slow phone. */
export const WARMUP_MAX_MS = 12_000;
/** after this long the host may deal without the phones that are still upright */
export const UPRIGHT_GRACE_MS = 15_000;

export type Action =
  | { a: 'play'; id: number }
  | { a: 'draw' }
  | { a: 'pass' }
  | { a: 'uno' }
  | { a: 'choice'; v: string | number }
  | { a: 'dare'; ok: boolean }
  | { a: 'group' }
  | { a: 'coin'; guess: 'heads' | 'tails' }
  | { a: 'coinDone' }
  | { a: 'catch' }
  | { a: 'lateUno' }
  | { a: 'challenge' }
  | { a: 'decline' };

export type ClientMsg =
  | { t: 'create'; name: string; avatar?: string }
  | { t: 'join'; code: string; name: string; avatar?: string; token?: string }
  | { t: 'leave' }
  | { t: 'profile'; name?: string; avatar?: string }
  | { t: 'addBot' }
  | { t: 'kick'; id: string }
  | { t: 'rules'; rules: Rules }
  | { t: 'theme'; theme: ThemeId }
  | { t: 'table'; table: Table }
  | { t: 'start' }
  /** vote for another round; off: take the vote back; force (host): start without waiting for the rest */
  | { t: 'again'; off?: boolean; force?: boolean }
  | { t: 'toLobby' }
  | { t: 'act'; act: Action }
  /** this screen has drawn the table for `round`; upright: a phone still held upright (the deal waits for it to turn) */
  | { t: 'ready'; round: number; upright?: boolean }
  /** a phone turned (or was turned back) while the table waits for the deal */
  | { t: 'orient'; round: number; upright: boolean }
  /** host: deal now, without waiting for phones that are still upright */
  | { t: 'dealNow' }
  | { t: 'ping' };

export type ErrorCode = 'no-room' | 'full' | 'bad-request' | 'not-host' | 'kicked' | 'replaced' | 'too-few' | 'slow-down';

export type ServerMsg =
  | { t: 'joined'; code: string; token: string; id: string }
  | { t: 'room'; room: RoomInfo }
  | { t: 'state'; view: PlayerView; now: number }
  | { t: 'error'; code: ErrorCode; msg: string }
  | { t: 'left' }
  | { t: 'pong' };

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
export const CODE_LEN = 4;
export const MAX_PLAYERS = 8;
export const MAX_MEMBERS = 12;

export function normalizeCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z]/g, '').slice(0, CODE_LEN);
}

export function cleanName(raw: unknown) {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 16);
}
