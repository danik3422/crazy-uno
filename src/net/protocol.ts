import type { Rules, State, ThemeId } from '../game/types';

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
  dealAt: number | null;
  dealEnd: number | null;
}

/** How long the opening deal takes: one card at a time around the table, then the first card of the pile. */
export const DEAL_STEP_MS = 55;
export const dealMs = (players: number) => (players * 7 + 1) * DEAL_STEP_MS + 900;
/** Nobody waits longer than this for a slow phone. */
export const WARMUP_MAX_MS = 12_000;

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
  | { t: 'start' }
  /** vote for another round; off: take the vote back; force (host): start without waiting for the rest */
  | { t: 'again'; off?: boolean; force?: boolean }
  | { t: 'toLobby' }
  | { t: 'act'; act: Action }
  /** this screen has drawn the table for `round` and is ready for the deal */
  | { t: 'ready'; round: number }
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
