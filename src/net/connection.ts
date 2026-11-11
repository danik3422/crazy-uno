import { Observable } from '../lib/observable';
import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';
import type { Msg } from '../i18n/msg';
import { isReactionId, reactionBus, type ReactionId } from '../game/reactions';
import { PROTOCOL_VERSION, type Action, type ClientMsg, type ErrorCode, type PlayerView, type RoomInfo, type ServerMsg } from './protocol';

/** The server speaks another protocol version (a new deploy): load the new page, once per tab session. */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem('crazy-uno-proto-reload') === String(PROTOCOL_VERSION)) return false;
    sessionStorage.setItem('crazy-uno-proto-reload', String(PROTOCOL_VERSION));
  } catch {
    return false;
  }
  location.reload();
  return true;
}

export type ConnStatus = 'idle' | 'connecting' | 'open' | 'reconnecting';

interface Session {
  code: string;
  token: string;
}

const RETRY_MAX_MS = 5_000;
const HEARTBEAT_MS = 10_000;
/** no message from the server for this long: the link is considered dead */
const DEAD_LINK_MS = 30_000;

/** Errors after which this client no longer has a seat in the room. */
export function errorLeavesRoom(code: ErrorCode, inRoom: boolean): boolean {
  if (code === 'no-room' || code === 'kicked' || code === 'replaced') return true;
  // could not create or enter a room in the first place
  return (code === 'slow-down' || code === 'full') && !inRoom;
}

export function savedName(): string {
  return readJson<string>(STORAGE_KEYS.name) ?? '';
}

export function savedAvatar(): string | null {
  return readJson<string>(STORAGE_KEYS.avatar);
}

/**
 * One WebSocket to the game server that survives drops:
 * reconnects with backoff, rejoins the room with the saved token, and pings to notice dead links.
 */
export class Connection extends Observable {
  status: ConnStatus = 'idle';
  room: RoomInfo | null = null;
  /** local time the last room update arrived (countdowns are sent as "ms from now") */
  roomAt = 0;
  view: PlayerView | null = null;
  /** server clock at the moment `view` was produced */
  viewNow = 0;
  error: { code: ErrorCode; msg: Msg; at: number } | null = null;
  session: Session | null = readJson<Session>(STORAGE_KEYS.session);
  name = savedName();
  avatar = savedAvatar() ?? undefined;

  private ws: WebSocket | null = null;
  private wanted = false;
  private retry = 0;
  private queue: ClientMsg[] = [];
  private lastMsgAt = 0;
  private hb: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  open() {
    if (this.wanted) return;
    this.wanted = true;
    this.connect();
    this.hb = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', this.onVisible);
    window.addEventListener('online', this.onVisible);
  }

  close() {
    this.wanted = false;
    if (this.hb) clearInterval(this.hb);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    window.removeEventListener('online', this.onVisible);
    this.ws?.close();
    this.ws = null;
    this.status = 'idle';
    this.emitChange();
  }

  setName(name: string) {
    this.name = name;
    writeJson(STORAGE_KEYS.name, name);
  }

  setAvatar(id: string) {
    this.avatar = id;
    writeJson(STORAGE_KEYS.avatar, id);
    if (this.room) this.send({ t: 'profile', avatar: id });
  }

  create() {
    this.forget();
    this.send({ t: 'create', name: this.name, avatar: this.avatar });
  }

  join(code: string) {
    // the seat token of this room; after a kick, the old one (the server knows it and says no)
    const kicked = readJson<Session>(STORAGE_KEYS.kicked);
    const token = this.session?.code === code ? this.session.token : kicked?.code === code ? kicked.token : undefined;
    this.send({ t: 'join', code, name: this.name, avatar: this.avatar, token });
  }

  leave() {
    this.send({ t: 'leave' });
    this.forget();
    this.emitChange();
  }

  act(act: Action) {
    // a move made while offline would be stale by the time we reconnect: drop it
    if (this.status === 'open') this.raw({ t: 'act', act });
  }

  /** a quick reaction: only while connected (one sent later would be out of place) */
  react(id: ReactionId) {
    if (this.status === 'open') this.raw({ t: 'react', id });
  }

  send(m: ClientMsg) {
    if (this.status === 'open') this.raw(m);
    else this.queue.push(m);
  }

  clearError() {
    this.error = null;
    this.emitChange();
  }

  private forget() {
    this.session = null;
    writeJson(STORAGE_KEYS.session, null);
    this.room = null;
    this.view = null;
  }

  private raw(m: ClientMsg) {
    try {
      this.ws?.send(JSON.stringify(m));
    } catch { /* the close handler will reconnect */ }
  }

  private connect() {
    if (!this.wanted || this.ws) return;
    this.status = this.retry ? 'reconnecting' : 'connecting';
    this.emitChange();
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    let ws: WebSocket;
    try {
      ws = new WebSocket(`${proto}://${location.host}/ws`);
    } catch {
      return this.scheduleRetry();
    }
    this.ws = ws;
    ws.onopen = () => {
      this.status = 'open';
      this.retry = 0;
      this.lastMsgAt = Date.now();
      // rejoin first, then whatever was queued while offline (create/join requests)
      const pending = this.queue.splice(0);
      const explicitJoin = pending.some(m => m.t === 'join' || m.t === 'create');
      if (this.session && !explicitJoin) this.raw({ t: 'join', code: this.session.code, name: this.name, avatar: this.avatar, token: this.session.token });
      pending.forEach(m => this.raw(m));
      this.emitChange();
    };
    ws.onmessage = e => {
      this.lastMsgAt = Date.now();
      let m: ServerMsg;
      try {
        m = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.onMessage(m);
    };
    ws.onclose = () => {
      if (this.ws === ws) this.ws = null;
      if (this.wanted) this.scheduleRetry();
    };
    ws.onerror = () => ws.close();
  }

  private scheduleRetry() {
    this.status = 'reconnecting';
    this.emitChange();
    const delay = Math.min(RETRY_MAX_MS, 300 * 2 ** this.retry++) + Math.random() * 300;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }

  private heartbeat() {
    if (this.status !== 'open') return;
    if (Date.now() - this.lastMsgAt > DEAD_LINK_MS) {
      // the link looks dead (sleeping phone, flaky Wi-Fi): force a fresh connection
      this.ws?.close();
      this.ws = null;
      this.scheduleRetry();
      return;
    }
    this.raw({ t: 'ping' });
  }

  private onVisible = () => {
    if (document.visibilityState !== 'visible' || !this.wanted) return;
    if (this.status !== 'open') {
      this.retry = 0;
      if (this.retryTimer) clearTimeout(this.retryTimer);
      this.connect();
    } else this.raw({ t: 'ping' });
  };

  private onMessage(m: ServerMsg) {
    switch (m.t) {
      case 'joined':
        if (m.v !== PROTOCOL_VERSION && reloadOnce()) return;
        this.session = { code: m.code, token: m.token };
        writeJson(STORAGE_KEYS.session, this.session);
        this.error = null;
        break;
      case 'room':
        this.room = m.room;
        this.roomAt = Date.now();
        if (!m.room.started) this.view = null;
        break;
      case 'state':
        this.view = m.view;
        this.viewNow = m.now;
        break;
      case 'left':
        this.forget();
        break;
      case 'error':
        this.error = { code: m.code, msg: m.msg, at: Date.now() };
        if (m.code === 'kicked' && this.session) writeJson(STORAGE_KEYS.kicked, this.session);
        if (errorLeavesRoom(m.code, !!this.room)) this.forget();
        break;
      case 'react':
        // a reaction is not part of the room or the game: it goes straight to the table, no re-render
        if (Number.isInteger(m.seat) && isReactionId(m.id)) reactionBus.push(m.seat, m.id);
        return;
      case 'pong':
        return;
    }
    this.emitChange();
  }
}
