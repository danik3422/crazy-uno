import { randomUUID } from 'node:crypto';
import { isAvatarId, randomBot } from '../../src/game/avatars';
import { ReactionLimiter, isReactionId } from '../../src/game/reactions';
import { PACKS } from '../../src/i18n/core';
import { msg as text } from '../../src/i18n/msg';
import { isLang } from '../../src/i18n/types';
import { EVENT_PAUSE_MS, botThinkMs } from '../../src/game/bot';
import { DEFAULT_RULES, DEFAULT_TABLE, RULES, cleanTable, isTheme } from '../../src/game/content';
import { Game } from '../../src/game/engine/Game';
import { Window } from '../limits';
import { cryptoRng } from '../rng';
import { buildPlayerView, type AliasBook } from './playerView';
import { isTeamId, seatByTeams, teamsOf, teamsProblem, type TeamId } from '../../src/game/teams';
import type { Rules, Table, ThemeId } from '../../src/game/types';
import {
  MAX_MEMBERS, MAX_PLAYERS, PROTOCOL_VERSION, REMATCH_COUNTDOWN_MS, SHUFFLE_MS, WARMUP_MAX_MS, cleanName, dealMs,
  type Action, type ClientMsg, type ErrorCode, type PlayerView, type RoomInfo, type ServerMsg,
} from '../../src/net/protocol';

/** The bit of a WebSocket the room needs; lets tests use fakes. */
export interface Sock {
  send(data: string): void;
  close(code?: number, reason?: string): void;
}

export interface Member {
  id: string;
  token: string;
  name: string;
  avatar?: string;
  bot: boolean;
  spectator: boolean;
  sock: Sock | null;
  /** a bot that took over the seat of someone who left; dropped when the round ends */
  ghost?: boolean;
  /** the team they picked for the teams format (unset: whichever side is short) */
  team?: TeamId;
}

export interface RoomOptions {
  /** multiplies bot "thinking" delays; 0 in tests */
  botSpeed?: number;
  /** a disconnected player's turn is played by autopilot after this long */
  offlineAutoMs?: number;
  /** a connected but idle player's turn is played by autopilot after this long */
  idleAutoMs?: number;
  /** speeds up the opening deal (tests) */
  dealScale?: number;
  /** a group dare nobody confirms ends by itself after this long */
  groupMs?: number;
  /** countdown between "everyone is ready" and the next round */
  rematchMs?: number;
  /** the dev server: debug commands are accepted */
  debug?: boolean;
}

type Timer = ReturnType<typeof setTimeout>;

/**
 * Messages that go out to the whole room (a new name, a team, a phone turning) are cheap to send and costly to fan
 * out, so each member gets this many of them per window; normal use never comes close.
 */
const FANOUT_MAX = 12;
const FANOUT_WINDOW_MS = 3_000;

/**
 * Round start: everybody's screen first draws the table and reports 'ready',
 * then all of them see the deal at the same moment, and only then can anybody move.
 */
interface Warmup {
  ready: Set<string>;
  /** loaded, but the phone is still held upright: the deal waits until it lies on its side */
  upright: Set<string>;
  dealAt: number | null;
  dealEnd: number | null;
  timer: Timer | null;
  /** waited long enough for slow screens: from now on only upright phones hold the table */
  slowOk?: boolean;
}

/**
 * "Play again": every seated person who is online has to press it. Once they all have,
 * a short countdown runs and the next round starts with the same loading screen and deal as the first.
 */
interface RematchVote {
  ready: Set<string>;
  startAt: number | null;
  timer: Timer | null;
}

/**
 * Per viewer: the opaque number each hidden card goes by, and which real cards that viewer saw last time.
 * A card gets a fresh random number whenever it leaves the viewer's sight, so a card you gave away
 * (swap, gift, zero, carousel) cannot be told apart from the others in its new owner's hand.
 */
/** Authoritative state of one game room: lobby, seats, the engine and all timers. */
export class Room {
  members: Member[] = [];
  hostId = '';
  rules: Rules = { ...DEFAULT_RULES };
  theme: ThemeId = 'classic';
  table: Table = { ...DEFAULT_TABLE };
  /** wins this evening, by member id (two people may use the same name one after another) */
  score: Record<string, number> = {};
  game: Game | null = null;
  /** member id for every engine player index */
  seats: string[] = [];
  lastActivity = Date.now();

  private opts: Required<RoomOptions>;
  private round = 0;
  private warm: Warmup | null = null;
  private rematch: RematchVote | null = null;
  private aliases = new Map<string, AliasBook>();
  /** effects already looked at, and when the last random event fired (bots wait for its banner) */
  private fxSeen = 0;
  private eventAt = 0;
  /** the turn number autopilot is playing for an absent person (-1: none) */
  private autoTurn = -1;
  private flushQueued = false;
  /** each member's anti-spam counter for quick reactions */
  private reactLimits = new Map<string, ReactionLimiter>();
  private fanout = new Window(FANOUT_MAX, FANOUT_WINDOW_MS);
  /** seat tokens of people the host kicked out: that browser cannot simply walk back in */
  private kicked = new Set<string>();
  private scored = new WeakSet<Game>();
  private unsubscribe: (() => void) | null = null;

  // timers: the next bot / autopilot step, the bomb, the round limit, a bot catching a missing UNO
  private timer: Timer | null = null;
  private bombTimer: Timer | null = null;
  private limitTimer: Timer | null = null;
  private catchTimer: Timer | null = null;
  /** a bot jumping in out of turn (Jump-In) */
  private jumpTimer: Timer | null = null;
  private catchFor: unknown = null;

  constructor(public code: string, opts: RoomOptions = {}) {
    this.opts = { botSpeed: 1, offlineAutoMs: 12_000, idleAutoMs: 75_000, dealScale: 1, groupMs: 25_000, rematchMs: REMATCH_COUNTDOWN_MS, debug: false, ...opts };
  }

  /* ---------- membership ---------- */

  connectedHumans() {
    return this.members.filter(m => !m.bot && m.sock);
  }

  private players() {
    return this.members.filter(m => !m.spectator);
  }

  private member(id: string) {
    return this.members.find(m => m.id === id);
  }

  private hostOnline() {
    return this.members.some(m => m.id === this.hostId && m.sock);
  }

  /** `token` belongs to a person in this room (they are coming back to their seat). */
  hasSeat(token: string) {
    return this.members.some(m => m.token === token && !m.bot);
  }

  join(name: string, sock: Sock, token?: string, avatar?: string): Member | ErrorCode {
    this.touch();
    if (token && this.kicked.has(token)) return 'kicked';
    const back = token ? this.members.find(m => m.token === token && !m.bot) : undefined;
    if (back) {
      if (back.sock && back.sock !== sock) {
        this.sendTo(back.sock, { t: 'error', code: 'replaced', msg: text('err.replaced') });
        back.sock.close(4000, 'replaced');
      }
      back.sock = sock;
      this.setStandIn(back, false);
      if (name) back.name = this.uniqueName(name, back);
      if (isAvatarId(avatar)) back.avatar = avatar;
      if (!this.hostOnline()) this.hostId = back.id;
      this.sendTo(sock, { t: 'joined', code: this.code, token: back.token, id: back.id, v: PROTOCOL_VERSION });
      this.syncNames();
      this.broadcastRoom();
      // everyone sees the seat change hands at once (and the returner gets their cards)
      this.flush();
      return back;
    }
    if (this.members.length >= MAX_MEMBERS) return 'full';
    const playing = this.game !== null && this.game.s.phase !== 'over';
    const m: Member = {
      id: randomUUID().slice(0, 8),
      token: randomUUID(),
      name: this.uniqueName(name || 'Player'),
      avatar: isAvatarId(avatar) ? avatar : undefined,
      bot: false,
      spectator: playing || this.players().length >= MAX_PLAYERS,
      sock,
    };
    this.members.push(m);
    if (!this.hostId || !this.hostOnline()) this.hostId = m.id;
    this.sendTo(sock, { t: 'joined', code: this.code, token: m.token, id: m.id, v: PROTOCOL_VERSION });
    this.broadcastRoom();
    this.sendState(m);
    return m;
  }

  /** Socket closed: keep the seat, autopilot covers the turns until they come back. */
  disconnect(sock: Sock) {
    const gone = this.members.filter(x => x.sock === sock);
    if (!gone.length) return;
    for (const m of gone) {
      m.sock = null;
      // a bot sits in for them right away and hands the seat back when they return
      this.setStandIn(m, true);
    }
    // and the table stops waiting for their screen to load
    this.maybeDeal();
    this.passHost();
    // a rematch no longer waits for someone who dropped out
    this.checkRematch();
    this.broadcastRoom();
    this.flush();
  }

  /** Turn a seated person's engine player into a bot (they dropped) or back (they returned). */
  private setStandIn(m: Member, on: boolean) {
    if (m.bot || !this.game || this.game.s.phase === 'over') return;
    const seat = this.seats.indexOf(m.id);
    if (seat < 0) return;
    Object.assign(this.game.s.players[seat], { bot: on, standIn: on });
    if (on) this.autoTurn = -1;
  }

  private leave(m: Member) {
    const seat = this.seats.indexOf(m.id);
    if (this.game && seat >= 0 && this.game.s.phase !== 'over') {
      // keep the game going: a bot takes over the seat
      m.bot = true;
      m.ghost = true;
      m.sock = null;
      m.token = randomUUID();
      Object.assign(this.game.s.players[seat], { bot: true, standIn: false });
    } else {
      this.members = this.members.filter(x => x !== m);
      const s = this.seats.indexOf(m.id);
      if (s >= 0) this.seats[s] = '';
    }
    this.fanout.forget(m.id);
    this.reactLimits.delete(m.id);
    // whoever is gone neither votes for the next round nor holds up the deal
    this.rematch?.ready.delete(m.id);
    this.maybeDeal();
    this.passHost();
    this.checkRematch();
    this.broadcastRoom();
    this.flush();
  }

  private addBot(lang?: unknown) {
    if (this.players().length >= MAX_PLAYERS || this.members.length >= MAX_MEMBERS) return;
    // a random bot name and robot face, preferably ones nobody at the table has yet
    const bot = randomBot(this.members, Math.random, PACKS[isLang(lang) ? lang : 'en'].bots);
    this.members.push({
      id: randomUUID().slice(0, 8),
      token: randomUUID(),
      name: this.uniqueName(bot.name),
      avatar: bot.avatar,
      bot: true,
      spectator: false,
      sock: null,
    });
    this.broadcastRoom();
  }

  private passHost() {
    if (this.members.some(x => x.id === this.hostId && x.sock && !x.bot)) return;
    const next = this.connectedHumans()[0];
    if (next) this.hostId = next.id;
  }

  private uniqueName(raw: string, self?: Member) {
    const base = cleanName(raw) || 'Player';
    let name = base;
    for (let i = 2; this.members.some(m => m !== self && m.name === name); i++) name = `${base.slice(0, 13)} ${i}`;
    return name;
  }

  /** Keep engine names in sync with renamed members. */
  private syncNames() {
    if (!this.game) return;
    this.seats.forEach((id, i) => {
      const m = this.member(id);
      if (m) Object.assign(this.game!.s.players[i], { name: m.name, avatar: m.avatar });
    });
  }

  /* ---------- messages ---------- */

  /** Dev server only: knock out one bot (or every bot) still in the game, the way 25 cards would. */
  private debug(knockout: 'one' | 'all') {
    const g = this.game;
    if (!this.opts.debug || !g) return;
    g.debugKnockOut(knockout);
  }

  handle(m: Member, msg: ClientMsg) {
    this.touch();
    const host = m.id === this.hostId;
    const needHost = () => {
      if (!host) this.sendTo(m.sock, { t: 'error', code: 'not-host', msg: text('err.notHost') });
      return host;
    };
    const inLobby = !this.game;
    switch (msg.t) {
      case 'leave':
        this.sendTo(m.sock, { t: 'left' });
        m.sock = null;
        return this.leave(m);
      case 'profile': {
        const avatar = isAvatarId(msg.avatar) ? msg.avatar : m.avatar;
        const name = this.uniqueName(cleanName(msg.name) || m.name, m);
        if (avatar === m.avatar && name === m.name) return;
        if (!this.fanout.take(m.id)) return;
        m.avatar = avatar;
        m.name = name;
        this.syncNames();
        this.broadcastRoom();
        return this.flush();
      }
      case 'addBot':
        if (!needHost() || !inLobby) return;
        return this.addBot(msg.lang);
      case 'team': {
        // the host seats anyone; everyone else picks only their own side
        const target = this.member(msg.id);
        if (!inLobby || !target || !isTeamId(msg.team) || (!host && target !== m)) return;
        if (target.team === msg.team || !this.fanout.take(m.id)) return;
        target.team = msg.team;
        return this.broadcastRoom();
      }
      case 'kick': {
        if (!needHost()) return;
        const target = this.member(msg.id);
        if (!target || target === m) return;
        if (!target.bot) this.kicked.add(target.token);
        if (target.sock) {
          this.sendTo(target.sock, { t: 'error', code: 'kicked', msg: text('err.kicked') });
          target.sock.close(4001, 'kicked');
          target.sock = null;
        }
        return this.leave(target);
      }
      case 'rules': {
        if (!needHost() || !inLobby) return;
        const next = { ...this.rules };
        for (const r of RULES) if (typeof msg.rules?.[r.id] === 'boolean') next[r.id] = msg.rules[r.id];
        this.rules = next;
        return this.broadcastRoom();
      }
      case 'table':
        if (!needHost() || !inLobby) return;
        this.table = cleanTable(msg.table);
        return this.broadcastRoom();
      case 'theme':
        // cosmetic, so the host may switch it any time; a running round picks it up at once
        if (!needHost() || !isTheme(msg.theme)) return;
        this.theme = msg.theme;
        if (this.game) this.game.s.theme = msg.theme;
        this.broadcastRoom();
        return this.flush();
      case 'start':
        if (!needHost()) return;
        if (this.game && this.game.s.phase !== 'over') return;
        return this.startRound(m);
      case 'again':
        return this.voteRematch(m, !!msg.off, !!msg.force);
      case 'toLobby':
        if (!needHost()) return;
        this.clearRematch();
        this.endGame();
        this.members = this.members.filter(x => !x.ghost);
        return this.broadcastRoom();
      case 'act':
        return this.act(m, msg.act);
      case 'ready':
        return this.markScreen(m, Number(msg.round), msg.upright === true, true);
      case 'orient':
        return this.markScreen(m, Number(msg.round), msg.upright === true, false);
      case 'dealNow':
        if (!needHost()) return;
        this.maybeDeal(true);
        return this.flush();
      case 'react':
        return this.react(m, msg.id);
      case 'debug':
        return this.debug(msg.knockout);
      case 'join':
      case 'create':
      case 'ping':
        return;
    }
  }

  /* ---------- round start: loading screens and the deal ---------- */

  /** The table is still loading or the cards are still flying. */
  private warming() {
    const w = this.warm;
    return !!w && (w.dealEnd === null || Date.now() < w.dealEnd);
  }

  /**
   * A screen reports in for `round`: `ready` once it has drawn the table (message 'ready'),
   * or just a phone turning while the deal waits (message 'orient').
   */
  private markScreen(m: Member, round: number, upright: boolean, ready: boolean) {
    const w = this.warm;
    if (!w || round !== this.round || w.dealAt !== null) return;
    // nothing new (a repeated message): nothing to tell anyone
    const firstReady = ready && !w.ready.has(m.id);
    if (!firstReady && upright === w.upright.has(m.id)) return;
    // the first "ready" of a round always counts: dropping it would hold the whole table
    if (!firstReady && !this.fanout.take(m.id)) return;
    if (ready) w.ready.add(m.id);
    if (upright) w.upright.add(m.id);
    else w.upright.delete(m.id);
    this.maybeDeal();
    this.flush();
  }

  /** Seated people who are online. Bots and dropped players never hold the table. */
  private seatedOnline(): string[] {
    return this.seats.filter(id => {
      const m = this.member(id);
      return !!m && !m.bot && !!m.sock;
    });
  }

  /** Table drawn, but the phone is still held upright. */
  private turning(): string[] {
    const w = this.warm;
    return w ? this.seatedOnline().filter(id => w.ready.has(id) && w.upright.has(id)) : [];
  }

  /** Screens that have not reported yet. */
  private notReady(): string[] {
    const w = this.warm;
    return w ? this.seatedOnline().filter(id => !w.ready.has(id)) : [];
  }

  private maybeDeal(force = false) {
    const w = this.warm;
    if (!w || w.dealAt !== null || !this.game) return;
    if (!force && ((this.notReady().length && !w.slowOk) || this.turning().length)) return;
    if (w.timer) clearTimeout(w.timer);
    w.timer = null;
    // a moment to settle, the shuffle, then the deal
    w.dealAt = Date.now() + (700 + SHUFFLE_MS) * this.opts.dealScale;
    w.dealEnd = w.dealAt + dealMs(this.seats.length, this.game.s.table.handSize) * this.opts.dealScale;
    // the turn clock starts only when the cards are in everyone's hands
    this.game.holdClock(w.dealEnd - Date.now());
  }

  /* ---------- rounds: rematch vote, start and end ---------- */

  private voteRematch(m: Member, off: boolean, force: boolean) {
    const g = this.game;
    if (!g || g.s.phase !== 'over' || m.bot) return;
    if (force && m.id !== this.hostId) {
      this.sendTo(m.sock, { t: 'error', code: 'not-host', msg: text('err.notHostForce') });
      return;
    }
    this.rematch ??= { ready: new Set(), startAt: null, timer: null };
    if (off) this.rematch.ready.delete(m.id);
    else this.rematch.ready.add(m.id);
    this.checkRematch(force);
  }

  /** People whose vote we still need: online, seated last round (or watching and wanting in), not bots. */
  private rematchWaiting(): string[] {
    const r = this.rematch;
    return this.members.filter(x => !x.bot && !!x.sock && !(r?.ready.has(x.id))).map(x => x.id);
  }

  private checkRematch(force = false) {
    const r = this.rematch;
    if (!r || !this.game || this.game.s.phase !== 'over') return;
    const everyone = this.rematchWaiting().length === 0 && r.ready.size > 0;
    if ((everyone || force) && r.startAt === null) {
      r.startAt = Date.now() + this.opts.rematchMs;
      r.timer = setTimeout(() => {
        const host = this.member(this.hostId) ?? this.members[0];
        this.rematch = null;
        if (host) this.startRound(host);
      }, this.opts.rematchMs);
    } else if (!everyone && !force && r.startAt !== null) {
      // somebody took their vote back: stop the countdown
      if (r.timer) clearTimeout(r.timer);
      r.timer = null;
      r.startAt = null;
    }
    this.broadcastRoom();
  }

  private clearRematch() {
    if (this.rematch?.timer) clearTimeout(this.rematch.timer);
    this.rematch = null;
  }

  private startRound(by: Member) {
    this.clearRematch();
    this.members = this.members.filter(x => !x.ghost);
    // spectators get a seat if there is room
    for (const x of this.members) {
      if (x.spectator && this.players().length < MAX_PLAYERS) x.spectator = false;
    }
    const lineup = this.players();
    if (lineup.length < 2) {
      this.sendTo(by.sock, { t: 'error', code: 'too-few', msg: text('err.tooFew') });
      return;
    }
    let seated = lineup;
    let teams: TeamId[] = [];
    if (this.table.teams) {
      const picked = teamsOf(lineup);
      const teamsWrong = teamsProblem(picked);
      if (teamsWrong) {
        this.sendTo(by.sock, { t: 'error', code: 'too-few', msg: text('err.teams', { why: teamsWrong }) });
        return;
      }
      // the sides alternate around the table
      ({ list: seated, teams } = seatByTeams(lineup, picked));
    }
    this.endGame();
    this.round++;
    this.seats = seated.map(x => x.id);
    this.fxSeen = 0;
    this.autoTurn = -1;
    this.game = new Game({
      players: seated.map((x, i) => ({ name: x.name, bot: x.bot, avatar: x.avatar, team: teams[i] })),
      rules: this.rules,
      round: this.round,
      online: true,
      theme: this.theme,
      table: this.table,
    }, { rng: cryptoRng() });
    // someone who dropped out before this round (the rematch did not wait for them) has a bot in their seat at once,
    // exactly as if they had dropped out mid-round
    for (const x of seated) if (!x.bot && !x.sock) this.setStandIn(x, true);
    this.warm = { ready: new Set(), upright: new Set(), dealAt: null, dealEnd: null, timer: null };
    this.warm.timer = setTimeout(() => {
      // a slow phone that never finished loading does not hold the table; one that is loaded but upright does
      // (its player is right there and only has to turn it; the host can still deal without them)
      if (this.warm) this.warm.slowOk = true;
      this.maybeDeal();
      this.flush();
    }, WARMUP_MAX_MS);
    this.unsubscribe = this.game.subscribe(() => this.flush());
    this.broadcastRoom();
    this.flush();
  }

  private endGame() {
    this.clearTimers();
    if (this.warm?.timer) clearTimeout(this.warm.timer);
    this.warm = null;
    if (this.catchTimer) clearTimeout(this.catchTimer);
    this.catchTimer = null;
    this.catchFor = null;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.game = null;
    this.seats = [];
  }

  /* ---------- moves ---------- */

  private act(m: Member, a: Action) {
    const g = this.game;
    if (!g || !a || typeof a !== 'object') return;
    const seat = this.seats.indexOf(m.id);
    if (seat < 0) return;
    // nobody moves while the table is loading or the cards are still flying
    if (this.warming()) return;
    const s = g.s;
    // these can come from anybody at the table, not just whoever is moving
    if (a.a === 'group') return g.doneGroup();
    if (a.a === 'catch') return g.catchUno(seat);
    if (a.a === 'lateUno') return g.lateUno(seat);
    // Jump-In comes from anyone holding the same card; if two arrive together only the first counts (the top changed)
    if (a.a === 'jump') {
      if (!Number.isInteger(a.id) || !Number.isInteger(a.top)) return;
      if (seat === s.cur) {
        // it is their turn anyway: a normal play, as long as the pile is still what they saw
        if (g.top()?.id === a.top) g.play(a.id);
        return;
      }
      return void g.jumpIn(seat, a.id, a.top);
    }
    if (seat !== s.cur) return;
    if (s.turn === this.autoTurn) this.autoTurn = -1;
    switch (a.a) {
      case 'play': if (Number.isInteger(a.id)) g.play(a.id); return;
      case 'draw': return g.draw();
      case 'pass': return g.pass();
      case 'uno': return g.callUno();
      case 'choice': if (typeof a.v === 'string' || typeof a.v === 'number') g.resolveChoice(a.v); return;
      case 'dare': return g.resolveDare(!!a.ok);
      case 'coin': if (a.guess === 'heads' || a.guess === 'tails') g.guessCoin(a.guess); return;
      case 'coinDone': return g.finishCoin();
      case 'challenge': return g.challengeWild4();
      case 'decline': return g.declineChallenge();
    }
  }

  /* ---------- state fan-out ---------- */

  info(m: Member): RoomInfo {
    // the side each seated player is on (their pick, or the side that is short)
    const seated = this.players();
    const teams = new Map(teamsOf(seated).map((t, i) => [seated[i].id, t]));
    return {
      code: this.code,
      you: m.id,
      members: this.members.map(x => ({
        id: x.id, name: x.name, avatar: x.avatar, bot: x.bot, connected: x.bot || !!x.sock, spectator: x.spectator, host: x.id === this.hostId,
        team: teams.get(x.id),
      })),
      rules: this.rules,
      theme: this.theme,
      table: this.table,
      // only people still in the room: whoever left takes their wins with them
      score: Object.fromEntries(Object.entries(this.score).filter(([id]) => this.members.some(x => x.id === id))),
      started: this.game !== null,
      rematch: this.rematch
        ? {
            ready: [...this.rematch.ready],
            waiting: this.rematchWaiting(),
            startsIn: this.rematch.startAt === null ? null : Math.max(0, this.rematch.startAt - Date.now()),
          }
        : null,
    };
  }

  private aliasBook(m: Member, g: Game): AliasBook {
    let b = this.aliases.get(m.id);
    if (!b || b.game !== g) {
      b = { game: g, alias: new Map(), used: new Set(), seen: new Set() };
      this.aliases.set(m.id, b);
    }
    return b;
  }

  /** The game as `m` may see it: their own hand face up, everyone else's as opaque placeholders (see playerView). */
  view(m: Member | null): PlayerView | null {
    const g = this.game;
    if (!g) return null;
    return buildPlayerView(g, {
      you: m ? this.seats.indexOf(m.id) : -1,
      book: m ? this.aliasBook(m, g) : null,
      dealing: this.warming(),
      seats: this.seats,
      isOffline: seat => {
        const mem = this.member(this.seats[seat]);
        return !!mem && !mem.bot && !mem.sock;
      },
      warmup: {
        waiting: this.notReady().map(id => this.seats.indexOf(id)).filter(i => i >= 0),
        turning: this.turning().map(id => this.seats.indexOf(id)).filter(i => i >= 0),
        dealAt: this.warm?.dealAt ?? null,
        dealEnd: this.warm?.dealEnd ?? null,
      },
    });
  }

  /* ---------- sending ---------- */

  /** A quick reaction: only from someone seated in a running game, and never faster than the anti-spam rule allows. */
  private react(m: Member, id: unknown) {
    if (!this.game || !isReactionId(id)) return;
    const seat = this.seats.indexOf(m.id);
    if (seat < 0) return;
    let lim = this.reactLimits.get(m.id);
    if (!lim) this.reactLimits.set(m.id, (lim = new ReactionLimiter()));
    if (!lim.take()) return;
    for (const x of this.members) if (x.sock) this.sendTo(x.sock, { t: 'react', seat, id });
  }

  private broadcastRoom() {
    for (const m of this.members) if (m.sock) this.sendTo(m.sock, { t: 'room', room: this.info(m) });
  }

  private sendState(m: Member) {
    const v = this.view(m);
    if (v && m.sock) this.sendTo(m.sock, { t: 'state', view: v, now: Date.now() });
  }

  /** Engine changed: coalesce several commits of one action into one broadcast. */
  private flush() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      const g = this.game;
      if (!g) return;
      for (const f of g.s.fx) {
        if (f.id <= this.fxSeen) continue;
        this.fxSeen = f.id;
        if (f.kind === 'event') this.eventAt = Date.now();
      }
      if (g.s.phase === 'over' && g.s.winner !== null && !this.scored.has(g)) {
        this.scored.add(g);
        // in teams every member of the winning team scores
        g.s.players.forEach((p, i) => {
          const id = this.seats[i];
          if (id && (i === g.s.winner || g.sameTeam(i, g.s.winner!))) this.score[id] = (this.score[id] ?? 0) + 1;
        });
        this.broadcastRoom();
      }
      for (const m of this.members) this.sendState(m);
      this.schedule();
    });
  }

  /* ---------- timers: bots, autopilot, bomb ---------- */

  /** A bot that noticed a missing UNO speaks up after a human-like pause; one timer per catch window. */
  private scheduleCatch() {
    const g = this.game;
    const c = g?.s.unoCatch ?? null;
    if (c === this.catchFor) return;
    this.catchFor = c;
    if (this.catchTimer) clearTimeout(this.catchTimer);
    this.catchTimer = null;
    if (!g || !c || c.botCatcher === null) return;
    const by = c.botCatcher;
    this.catchTimer = setTimeout(() => g.catchUno(by), c.botDelay * this.opts.botSpeed);
  }

  private clearTimers() {
    for (const t of [this.timer, this.bombTimer, this.limitTimer, this.jumpTimer]) if (t) clearTimeout(t);
    this.timer = this.bombTimer = this.limitTimer = this.jumpTimer = null;
  }

  /** After every change: set up the one timer that moves the game on next (bot, autopilot, clocks). */
  private schedule() {
    this.clearTimers();
    this.scheduleCatch();
    const g = this.game;
    if (!g || g.s.phase === 'over') return;
    // hold everything (bots, clocks) until the deal is over, then look again
    if (this.warming()) {
      const end = this.warm!.dealEnd;
      // when the deal is over, tell everyone (their screens unlock) and get the bots and clocks going
      if (end !== null) this.timer = setTimeout(() => this.flush(), end - Date.now() + 20);
      return;
    }
    const s = g.s;
    if (s.bombDeadline !== null) {
      this.bombTimer = setTimeout(() => g.checkBomb(), Math.max(0, s.bombDeadline - Date.now()) + 30);
    }
    // quick round / round limit: when time is up, the fewest cards win
    this.limitTimer = s.endsAt !== null ? setTimeout(() => g.checkTimeLimit(), Math.max(0, s.endsAt - Date.now()) + 30) : null;
    // Jump-In: a bot holding the same card as the top one throws it in after a human-like pause (decided once per card)
    const jump = g.botJumpPlan();
    if (jump) {
      const wait = Math.max(0, jump.at - Date.now()) * this.opts.botSpeed;
      this.jumpTimer = setTimeout(() => g.jumpIn(jump.seat, jump.cardId, jump.top, jump.uno), wait);
    }
    const p = g.cp();
    const mem = this.member(this.seats[s.cur]);
    const eventWait = Math.max(0, this.eventAt + EVENT_PAUSE_MS - Date.now()) * this.opts.botSpeed;

    if (s.phase === 'group') {
      // waits for the people at the table, but never forever: after a while the game simply goes on
      const wait = this.connectedHumans().length === 0 ? 1500 * this.opts.botSpeed : this.opts.groupMs;
      this.timer = setTimeout(() => g.doneGroup(), wait);
      return;
    }
    if (p.bot) {
      this.timer = setTimeout(() => g.botAct(), eventWait + botThinkMs(s) * this.opts.botSpeed);
      return;
    }
    // a human's turn with the clock on: when it runs out, the engine plays the rest of the turn
    // (a dropped connection is always covered by autopilot; someone just idle at the table gets it only
    // when the host turned it on, otherwise they draw a card and lose the turn). The clock also covers a decision
    // their card opened (a colour, a 7 to swap, a gift): the same as in a local game
    const offline = !mem?.sock;
    if (s.turnDeadline !== null) {
      this.timer = setTimeout(() => g.timeoutTurn(offline), Math.max(0, s.turnDeadline - Date.now()) + 30);
      return;
    }
    // otherwise only if they dropped out or went idle
    const continuing = this.autoTurn === s.turn;
    const wait = continuing ? 800 * this.opts.botSpeed : offline ? this.opts.offlineAutoMs : this.opts.idleAutoMs;
    this.timer = setTimeout(() => {
      this.autoTurn = g.s.turn;
      if (offline || g.s.table.autopilot) g.botAct(true);
      else g.missTurn();
    }, wait);
  }

  destroy() {
    this.clearRematch();
    this.endGame();
    for (const m of this.members) m.sock?.close(1001, 'room closed');
  }

  private touch() {
    this.lastActivity = Date.now();
  }

  private sendTo(sock: Sock | null | undefined, msg: ServerMsg) {
    if (!sock) return;
    try {
      sock.send(JSON.stringify(msg));
    } catch {
      /* socket already gone; close handler cleans up */
    }
  }
}
