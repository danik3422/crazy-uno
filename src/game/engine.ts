import { CNAME, COLORS, CPLURAL, DARES, DEFAULT_TABLE, EVENTS, GROUP_DARES, PUNISH, SPECIAL, TEAM_NAMES, effectiveTable } from './content';
import type { Card, Choice, Color, EventId, Fx, FxKind, Player, Rules, State, Table, ThemeId } from './types';

export interface GameConfig {
  players: { name: string; bot: boolean; avatar?: string }[];
  rules: Rules;
  round?: number;
  /** online room: every human has their own screen, so no hand-over curtain */
  online?: boolean;
  theme?: ThemeId;
  table?: Table;
}

export interface GameOptions {
  rng?: () => number;
  now?: () => number;
}

export const BLITZ_MS = 7_000;

/** Matching rules, shared by the engine and the online client. */
export function canPlayCard(s: State, c: Card): boolean {
  const t = s.discard[s.discard.length - 1];
  if (s.pending > 0) {
    if (c.type === 'mirror') return true;
    if (!s.rules.stack) return false;
    if (c.type === 'wild4') return true;
    return c.type === 'draw2' && s.pendingType === 'draw2';
  }
  if (c.color === 'wild' || c.color === s.color) return true;
  if (c.type === 'num') return t.type === 'num' && c.value === t.value;
  return c.type === t.type;
}

/** "After drawing you may only play the card you just drew." */
export function playableCard(s: State, c: Card): boolean {
  return canPlayCard(s, c) && (!s.drawn || c.id === s.lastDrawn);
}

export function cardName(c: Card): string {
  const base = c.type === 'num' ? String(c.value) : SPECIAL[c.type].name;
  return c.color === 'wild' ? base : `${base} (${CNAME[c.color].toLowerCase()})`;
}

/**
 * Pure game logic. Synchronous and UI-agnostic: every public action mutates `s`
 * and notifies subscribers. Timing (bot delays, the bomb countdown) is driven from outside.
 */
export class Game {
  s: State;
  version = 0;
  readonly isLocal = true;
  /** server clock minus local clock; always 0 for a local game */
  readonly clockOffset = 0;
  /** effects with an id up to this were already shown */
  readonly fxBaseline = 0;
  private listeners = new Set<() => void>();
  private fxId = 0;
  private nextId = 0;
  private online: boolean;
  private rng: () => number;
  private now: () => number;

  constructor(cfg: GameConfig, opts: GameOptions = {}) {
    this.rng = opts.rng ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.online = !!cfg.online;
    const players: Player[] = cfg.players.map((p, i) => ({
      name: p.name.trim() || `Игрок ${i + 1}`,
      bot: p.bot,
      avatar: p.avatar,
      hand: [],
    }));
    const n = players.length;
    const deck = this.buildDeck(cfg.rules);
    const table = effectiveTable({ ...DEFAULT_TABLE, ...cfg.table });
    // teams only make sense on an even table of 4+; partners alternate, so they sit opposite
    const teams = table.teams && n >= 4 && n % 2 === 0 ? players.map((_, i) => i % 2) : null;
    for (let k = 0; k < table.handSize; k++) {
      players.forEach((p, i) => {
        const c = deck.pop()!;
        c.dealIdx = k * n + i;
        p.hand.push(c);
      });
    }
    const fi = deck.map(c => c.type).lastIndexOf('num');
    const first = deck.splice(fi, 1)[0];

    this.s = {
      round: cfg.round ?? 1,
      theme: cfg.theme ?? 'classic',
      players,
      rules: { ...cfg.rules },
      table,
      teams,
      winTeam: null,
      endsAt: table.roundMin ? this.now() + table.roundMin * 60_000 : null,
      timeUp: false,
      deck,
      discard: [first],
      cur: Math.floor(this.rng() * n),
      dir: 1,
      color: first.color as Color,
      pending: 0,
      pendingType: null,
      drawn: false,
      lastDrawn: null,
      unoCalled: false,
      bombNext: false,
      bombDeadline: null,
      timerKind: null,
      lastEventTurn: 0,
      blindTurns: 0,
      blitzTurns: 0,
      skipNext: [],
      coin: null,
      dareNext: false,
      dare: null,
      turnDeadline: null,
      turnTotal: table.turnSec * 1000,
      unoCatch: null,
      challenge: null,
      phase: 'play',
      choice: null,
      effect: null,
      log: [],
      fx: [],
      turn: 0,
      lastHuman: null,
      winner: null,
      loser: null,
      punishment: null,
    };
    this.say(`Раздали по 7. Первым ходит ${players[this.s.cur].name}. Удачи, она понадобится.`);
    this.beginTurn();
  }

  /* ---------- subscription (for React's useSyncExternalStore) ---------- */
  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => { this.listeners.delete(f); };
  };
  getVersion = () => this.version;
  private commit() {
    this.version++;
    this.listeners.forEach(f => f());
  }

  /* ---------- queries ---------- */
  cp() { return this.s.players[this.s.cur]; }
  top() { return this.s.discard[this.s.discard.length - 1]; }
  nextIdx(from = this.s.cur, steps = 1) {
    const n = this.s.players.length;
    return (((from + this.s.dir * steps) % n) + n) % n;
  }
  humans() { return this.s.players.map((p, i) => (p.bot ? -1 : i)).filter(i => i >= 0); }
  totalCards() {
    return this.s.deck.length + this.s.discard.length + this.s.players.reduce((a, p) => a + p.hand.length, 0);
  }

  canPlay(c: Card): boolean {
    return canPlayCard(this.s, c);
  }

  playable(c: Card): boolean {
    return playableCard(this.s, c);
  }

  /** Whose hand is shown face-up to the screen right now (null = nobody's). */
  viewer(): number | null {
    const s = this.s;
    if (s.phase === 'handover') return null;
    if (!this.cp().bot) return s.cur;
    const hs = this.humans();
    return hs.length === 1 ? hs[0] : null;
  }

  /** Who sits at the near edge of the table. */
  seat(): number {
    const s = this.s;
    if (!this.cp().bot) return s.cur;
    return s.lastHuman ?? this.humans()[0] ?? 0;
  }

  /* ---------- actions ---------- */
  confirmHandover() {
    if (this.s.phase !== 'handover') return;
    this.afterHandover();
    this.commit();
  }

  resolveDare(accepted: boolean) {
    const s = this.s;
    if (s.phase !== 'dare') return;
    const p = this.cp();
    if (accepted) this.say(`🎭 ${p.name} выполняет фант: «${s.dare}». Аплодисменты!`);
    else {
      this.give(p, 2);
      this.say(`🐔 ${p.name} струсил(а) и тянет 2`);
      this.fx('shake');
    }
    s.dare = null;
    this.stepEvent();
    this.commit();
  }

  callUno() {
    const s = this.s;
    if (s.phase !== 'play' || s.unoCalled) return;
    s.unoCalled = true;
    this.fx('uno', `${this.cp().name}: UNO!`);
    this.commit();
  }

  /** The UNO window is open for `victim` right now. */
  catchable(): boolean {
    const s = this.s;
    const c = s.unoCatch;
    return !!c && s.phase !== 'over' && s.turn <= c.until && s.players[c.victim]?.hand.length === 1;
  }

  /** Someone noticed the victim did not call UNO: the victim draws 2. On one shared screen the catcher is whoever is looking. */
  catchUno(by: number = this.catcherHere()) {
    const s = this.s;
    if (!this.catchable() || !s.unoCatch || by === s.unoCatch.victim || !s.players[by]) return;
    const v = s.players[s.unoCatch.victim];
    s.unoCatch = null;
    this.give(v, s.table.unoPenalty);
    this.say(`🫵 ${s.players[by].name} ловит ${v.name}: забыл(а) крикнуть UNO! +2`);
    this.fx('caught', `🫵 ${s.players[by].name} поймал(а) ${v.name}! +2`);
    this.fx('shake');
    this.commit();
  }

  /** Shared screen: the person looking at it, or failing that the first person who is not the victim. */
  private catcherHere() {
    const v = this.viewer();
    const victim = this.s.unoCatch?.victim;
    if (v !== null && v !== victim) return v;
    return this.humans().find(i => i !== victim) ?? -1;
  }

  /** The victim remembers in time and calls UNO before anyone catches them. */
  lateUno(who: number = this.s.unoCatch?.victim ?? -1) {
    const s = this.s;
    if (!this.catchable() || s.unoCatch?.victim !== who) return;
    s.unoCatch = null;
    this.fx('uno', `${s.players[who].name}: UNO! (успел)`);
    this.commit();
  }

  /** The target of a +4 challenges it. */
  challengeWild4() {
    const s = this.s;
    const ch = s.challenge;
    if (s.phase !== 'play' || !ch || ch.target !== s.cur || s.drawn) return;
    s.challenge = null;
    const off = s.players[ch.by];
    const me = this.cp();
    if (ch.guilty) {
      // caught: the one who laid the +4 draws it, the challenger's penalty shrinks by those 4
      this.give(off, 4);
      s.pending = Math.max(0, s.pending - 4);
      if (!s.pending) s.pendingType = null;
      this.say(`⚖️ ${me.name} оспаривает +4 и прав(а)! У ${off.name} был нужный цвет — тянет 4`);
      this.fx('challenge', `⚖️ Попался! ${off.name} тянет 4`);
      this.fx('shake');
      this.commit();
      return;
    }
    s.pending += 2;
    this.say(`⚖️ ${me.name} оспаривает +4, но ${off.name} играл(а) честно. Штраф +${s.pending}`);
    this.fx('challenge', `⚖️ Честно! ${me.name} тянет ${s.pending}`);
    this.draw();
  }

  declineChallenge() {
    const s = this.s;
    if (!s.challenge || s.challenge.target !== s.cur) return;
    s.challenge = null;
    this.commit();
  }

  /** Pause the turn clock (round start): it restarts in full once `ms` have passed. */
  holdClock(ms: number) {
    const s = this.s;
    if (s.turnDeadline !== null) s.turnDeadline = this.now() + ms + s.turnTotal;
    // the round clock does not run while the cards are being dealt
    if (s.endsAt !== null) s.endsAt = this.now() + ms + s.table.roundMin * 60_000;
    this.commit();
  }

  /** The turn clock ran out: play the rest of this turn on autopilot. */
  timeoutTurn() {
    const s = this.s;
    if (s.turnDeadline === null || this.now() < s.turnDeadline || s.phase === 'over') return;
    s.turnDeadline = null;
    const turn = s.turn;
    const who = this.cp().name;
    this.say(`⏰ ${who} не успел(а), сходил автопилот`);
    this.fx('timeout', `⏰ Время! За ${who} сходил автопилот`);
    const live = () => s.turn === turn && (s.phase as string) !== 'over';
    for (let i = 0; i < 12 && live(); i++) {
      const v = this.version;
      this.botAct(true);
      if (this.version === v) break;
    }
    this.commit();
  }

  play(cardId: number): boolean {
    const s = this.s;
    if (s.phase !== 'play') return false;
    const p = this.cp();
    const idx = p.hand.findIndex(c => c.id === cardId);
    if (idx < 0 || !this.playable(p.hand[idx])) return false;
    const card = p.hand.splice(idx, 1)[0];
    // a +4 is "guilty" when laid while holding a card of the colour in play
    const guilty = card.type === 'wild4' && p.hand.some(c => c.color === s.color);
    s.discard.push(card);
    s.bombDeadline = null;
    s.timerKind = null;
    s.challenge = null;
    if (card.color !== 'wild') s.color = card.color;
    this.say(`${p.name} кладёт ${cardName(card)}`);

    if (p.hand.length === 1 && s.rules.uno) {
      if (s.unoCalled) this.fx('uno', `${p.name}: UNO!`);
      else {
        // forgot to call it: anyone may catch them until the end of the next turn
        // only opponents catch you (a partner keeps quiet)
        const bots = s.players.map((x, i) => (x.bot && i !== s.cur && !this.sameTeam(i, s.cur) ? i : -1)).filter(i => i >= 0);
        const botCatcher = bots.length && this.rng() < 0.55 ? bots[Math.floor(this.rng() * bots.length)] : null;
        s.unoCatch = { victim: s.cur, until: s.turn + 1, botCatcher, botDelay: 1400 + Math.floor(this.rng() * 2200) };
        this.say(`🤫 ${p.name} осталась одна карта… а «UNO!» никто не слышал`);
      }
    }
    if (p.hand.length === 0) {
      this.win();
      this.commit();
      return true;
    }
    s.effect = { card, steps: 1, guilty };
    this.runEffect();
    this.commit();
    return true;
  }

  draw(): void {
    const s = this.s;
    if (s.phase !== 'play') return;
    const p = this.cp();
    s.bombDeadline = null;
    s.challenge = null;
    if (s.pending > 0) {
      const n = s.pending;
      s.pending = 0;
      s.pendingType = null;
      this.give(p, n);
      this.say(`${p.name} тянет ${n} и тихо плачет 😭`);
      if (n >= 6) this.fx('toast', `+${n}! 😱`);
      this.fx('shake');
      this.advance();
      this.commit();
      return;
    }
    if (s.drawn) return;
    const got: Card[] = [];
    if (s.rules.drawPlay) {
      for (let i = 0; i < 80; i++) {
        const g = this.give(p, 1);
        if (!g.length) break;
        got.push(g[0]);
        if (this.canPlay(g[0])) break;
      }
    } else got.push(...this.give(p, 1));
    s.drawn = true;
    s.lastDrawn = got.length ? got[got.length - 1].id : null;
    this.say(`${p.name} тянет ${got.length > 1 ? `${got.length} карт(ы)` : got.length ? 'карту' : '… а колода пуста'}`);
    if (!p.hand.some(c => this.playable(c))) this.advance();
    this.commit();
  }

  pass() {
    const s = this.s;
    if (s.phase !== 'play' || !s.drawn) return;
    this.say(`${this.cp().name} пасует`);
    this.advance();
    this.commit();
  }

  /** value: a Color, a player index or a card id, depending on the choice kind */
  resolveChoice(value: string | number) {
    const s = this.s;
    if (s.phase !== 'choose' || !s.choice || !s.effect) return;
    const p = this.cp();
    const e = s.effect;
    const ch = s.choice;
    if (ch.kind === 'color') {
      if (!COLORS.includes(value as Color)) return;
      const col = value as Color;
      if (e.card.type === 'dump') {
        const out = p.hand.filter(c => c.color === col);
        p.hand = p.hand.filter(c => c.color !== col);
        s.discard.splice(s.discard.length - 1, 0, ...out);
        this.say(`🧹 ${p.name} выкидывает все ${CPLURAL[col]}: ${out.length} шт.`);
      }
      s.color = col;
      if (e.card.type === 'wild4') {
        s.pending += 4;
        s.pendingType = 'wild4';
        this.say(`Цвет ${CNAME[col].toLowerCase()}, штраф уже +${s.pending}`);
        if (s.rules.challenge) s.challenge = { by: s.cur, target: this.nextIdx(), guilty: !!e.guilty };
      } else if (e.card.type !== 'dump') this.say(`Цвет теперь ${CNAME[col].toLowerCase()}`);
      return this.finishEffect();
    }
    if (ch.kind === 'card') {
      if (!p.hand.some(c => c.id === value)) return;
      e.giftCard = value as number;
      s.choice = { kind: 'player', title: 'Кому дарим?', mode: 'gift' };
      this.commit();
      return;
    }
    const ti = Number(value);
    if (!Number.isInteger(ti) || ti < 0 || ti >= s.players.length || ti === s.cur) return;
    const t = s.players[ti];
    if (ch.mode === 'swap') {
      [p.hand, t.hand] = [t.hand, p.hand];
      this.say(`⇆ ${p.name} и ${t.name} меняются картами. Теперь у ${p.name} ${p.hand.length}, у ${t.name} ${t.hand.length}`);
      this.fx('flip');
    } else {
      const gi = p.hand.findIndex(c => c.id === e.giftCard);
      if (gi >= 0) t.hand.push(p.hand.splice(gi, 1)[0]);
      this.say(`🎁 ${p.name} дарит ${t.name} карту. Какая щедрость!`);
    }
    this.finishEffect();
  }

  /** Called periodically by the UI while a bomb is ticking. */
  checkBomb() {
    const s = this.s;
    if (s.phase !== 'play' || s.bombDeadline === null || this.now() < s.bombDeadline) return;
    s.bombDeadline = null;
    const p = this.cp();
    const bomb = s.timerKind === 'bomb';
    const n = (bomb ? 3 : 2) + s.pending;
    s.timerKind = null;
    s.pending = 0;
    s.pendingType = null;
    this.give(p, n);
    if (bomb) {
      this.say(`💥 БАБАХ! ${p.name} не успел(а) и тянет ${n}`);
      this.fx('boom', '💥 БАБАХ!');
    } else {
      this.say(`⚡ ${p.name} не успел(а) в блице и тянет ${n}`);
      this.fx('toast', `⚡ Время! +${n}`);
      this.fx('shake');
    }
    this.advance();
    this.commit();
  }

  /**
   * One step of bot behaviour for the current player.
   * `force` lets the server play on autopilot for a human who dropped out or went idle.
   */
  botAct(force = false) {
    const s = this.s;
    const p = this.cp();
    if (!p.bot && !force) return;
    if (s.phase === 'handover') return this.confirmHandover();
    if (s.phase === 'dare') return this.resolveDare(true);
    if (s.phase === 'coin') return s.coin ? this.finishCoin() : this.guessCoin(this.rng() < 0.5 ? 'heads' : 'tails');
    if (s.phase === 'choose' && s.choice) return this.resolveChoice(this.botChoice(s.choice));
    if (s.phase !== 'play') return;
    if (s.challenge && s.challenge.target === s.cur) {
      // bots smell a bluff about a third of the time; autopilot never gambles
      if (!force && this.rng() < 0.35) return this.challengeWild4();
      s.challenge = null;
    }
    const opts = p.hand.filter(c => this.playable(c));
    if (!opts.length) return s.drawn && s.pending === 0 ? this.pass() : this.draw();
    const nxt = s.players[this.nextIdx()];
    const danger = nxt.hand.length <= 2;
    const counts = this.colorCount(p);
    const best = Math.max(...COLORS.map(c => counts[c]));
    const minOther = Math.min(...s.players.filter(o => o !== p).map(o => o.hand.length));
    const rate = (c: Card) => {
      let r = this.rng() * 3;
      if (c.color === 'wild') r -= 6;
      if (['draw2', 'wild4', 'skip', 'bomb', 'rain'].includes(c.type)) r += danger ? 10 : 1;
      if (c.type === 'num') r += (c.value ?? 0) / 3;
      if (c.type === 'dump') r += best * 2;
      if (c.type === 'swap') r += minOther < p.hand.length - 2 ? 8 : -8;
      if (c.type === 'mirror' && s.pending) r += 20;
      return r;
    };
    opts.sort((a, b) => rate(b) - rate(a));
    if (p.hand.length === 2) s.unoCalled = this.rng() > 0.2;
    this.play(opts[0].id);
  }

  /* ---------- internals ---------- */
  private botChoice(ch: Choice): string | number {
    const s = this.s;
    const p = this.cp();
    if (ch.kind === 'color') {
      const c = this.colorCount(p);
      return COLORS.slice().sort((a, b) => c[b] - c[a])[0];
    }
    if (ch.kind === 'card') {
      const nonWild = p.hand.filter(c => c.color !== 'wild');
      const pool = nonWild.length ? nonWild : p.hand;
      return pool.reduce((a, b) => ((b.value ?? -1) > (a.value ?? -1) ? b : a)).id;
    }
    // swap with / dump a card on the opponent with the fewest cards; never pick the partner
    let best = -1;
    s.players.forEach((o, i) => {
      if (i === s.cur || this.sameTeam(i, s.cur)) return;
      if (best < 0 || o.hand.length < s.players[best].hand.length) best = i;
    });
    return best >= 0 ? best : (s.cur + 1) % s.players.length;
  }

  private colorCount(p: Player) {
    const c: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
    p.hand.forEach(x => { if (x.color !== 'wild') c[x.color]++; });
    return c;
  }

  private buildDeck(r: Rules): Card[] {
    const d: Card[] = [];
    const add = (color: Card['color'], type: Card['type'], value?: number) => d.push({ id: 0, color, type, value });
    for (const c of COLORS) {
      add(c, 'num', 0);
      for (let n = 1; n <= 9; n++) { add(c, 'num', n); add(c, 'num', n); }
      for (const t of ['skip', 'rev', 'draw2'] as const) { add(c, t); add(c, t); }
      if (r.crazy) for (const t of ['swap', 'gift', 'bomb', 'rain', 'mirror'] as const) add(c, t);
      if (r.dares) add(c, 'dare');
    }
    for (let i = 0; i < 4; i++) { add('wild', 'wild'); add('wild', 'wild4'); }
    if (r.crazy) for (let i = 0; i < 2; i++) { add('wild', 'chaos'); add('wild', 'dump'); }
    // ids are handed out after shuffling, so an id tells nothing about the card's face
    this.shuffle(d).forEach(c => { c.id = this.nextId++; });
    return d;
  }

  private shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  private pick<T>(a: T[]): T { return a[Math.floor(this.rng() * a.length)]; }

  private say(m: string) {
    this.s.log.push(m);
    if (this.s.log.length > 50) this.s.log.shift();
  }

  private fx(kind: FxKind, text?: string, extra: Partial<Fx> = {}) {
    this.s.fx.push({ id: ++this.fxId, kind, text, ...extra });
    if (this.s.fx.length > 20) this.s.fx.shift();
  }

  private refill() {
    const s = this.s;
    if (s.discard.length < 2) return;
    const t = s.discard.pop()!;
    // fresh ids: online players saw these faces in the discard pile and must not track them
    s.deck = this.shuffle(s.discard).map(c => ({ ...c, id: this.nextId++, dealIdx: undefined }));
    s.discard = [t];
    this.say('Колода кончилась, перемешали сброс 🔄');
  }

  private give(p: Player, n: number): Card[] {
    const got: Card[] = [];
    for (let i = 0; i < n; i++) {
      if (!this.s.deck.length) this.refill();
      if (!this.s.deck.length) break;
      const c = this.s.deck.pop()!;
      p.hand.push(c);
      got.push(c);
    }
    return got;
  }

  private advance(steps = 1) {
    if (this.s.phase === 'over') return;
    this.s.cur = this.nextIdx(this.s.cur, steps);
    this.beginTurn();
  }

  private beginTurn() {
    const s = this.s;
    s.turn++;
    s.drawn = false;
    s.lastDrawn = null;
    s.unoCalled = false;
    s.choice = null;
    s.effect = null;
    s.bombDeadline = null;
    s.timerKind = null;
    s.turnDeadline = null;
    if (s.blindTurns > 0) s.blindTurns--;
    if (s.blitzTurns > 0) s.blitzTurns--;
    // a challenge belongs to the +4's target only, and only on their very next turn
    if (s.challenge && s.challenge.target !== s.cur) s.challenge = null;
    const p = this.cp();
    const struck = s.skipNext.indexOf(s.cur);
    if (struck >= 0) {
      s.skipNext.splice(struck, 1);
      this.say(`🌩️ ${p.name} всё ещё дымится после молнии и пропускает ход`);
      return this.advance();
    }
    if (!p.bot) {
      const multi = this.humans().length > 1 && !this.online;
      const sameAsBefore = s.lastHuman === s.cur;
      s.lastHuman = s.cur;
      // the same person moving again (skip in a 2-player game) needs no curtain
      if (multi && !sameAsBefore) {
        s.phase = 'handover';
        return;
      }
    }
    this.afterHandover();
  }

  /** Turn start pipeline: dare → random event → play. Each stage may pause for input. */
  private afterHandover() {
    const s = this.s;
    const p = this.cp();
    if (s.dareNext) {
      s.dareNext = false;
      const d = this.pick(DARES);
      if (p.bot) this.say(`🎭 ${p.name} получает фант: «${d}». Бот уверяет, что выполнил.`);
      else {
        s.dare = d;
        s.phase = 'dare';
        return;
      }
    }
    this.stepEvent();
  }

  private stepEvent() {
    const s = this.s;
    if (s.rules.events && s.turn > 2) {
      const since = s.turn - s.lastEventTurn;
      const freq = { rare: { gap: 7, p: 0.08, max: 20 }, normal: { gap: 4, p: 0.15, max: 13 }, often: { gap: 3, p: 0.3, max: 7 } }[s.table.events];
      if (since >= freq.gap && (this.rng() < freq.p || since >= freq.max)) {
        s.lastEventTurn = s.turn;
        if (this.fireEvent()) return;
      }
    }
    this.startPlay();
  }

  /** Applies a random event. Returns true when it waits for player input. */
  fireEvent(forced?: EventId): boolean {
    const s = this.s;
    const n = s.players.length;
    const p = this.cp();
    const ids = (Object.keys(EVENTS) as EventId[]).filter(id => id !== 'group' || this.humans().length > 0);
    const id = forced ?? this.pick(ids);
    const ev = EVENTS[id];
    const randomPlayer = () => Math.floor(this.rng() * n);
    const banner = (sub: string, target?: number) => {
      this.fx('event', ev.title, { sub, icon: ev.icon, target });
      this.say(`${ev.icon} ${ev.title} ${sub}`);
    };
    const shed = (pl: Player, k: number) => {
      const m = Math.min(k, pl.hand.length - 1);
      for (let i = 0; i < m; i++) s.deck.unshift(pl.hand.splice(Math.floor(this.rng() * pl.hand.length), 1)[0]);
      return Math.max(0, m);
    };
    const randomColor = () => this.pick(COLORS);

    switch (id) {
      case 'meteor': {
        const t = randomPlayer();
        const got = this.give(s.players[t], 10).length;
        banner(`Прилетел в ${s.players[t].name}: +${got} карт!`, t);
        this.fx('meteor', undefined, { target: t });
        break;
      }
      case 'recolor':
        s.players.forEach(pl => pl.hand.forEach(c => { if (c.color !== 'wild') c.color = randomColor(); }));
        s.color = randomColor();
        banner(`Цвета перемешаны, сейчас ${CNAME[s.color].toLowerCase()}`);
        this.fx('spin');
        break;
      case 'mono': {
        const col = randomColor();
        s.players.forEach(pl => pl.hand.forEach(c => { if (c.color !== 'wild') c.color = col; }));
        s.color = col;
        banner(`Сегодня всё ${CPLURAL[col]}!`);
        this.fx('spin');
        break;
      }
      case 'carousel': {
        const old = s.players.map(x => x.hand);
        s.players.forEach((_, i) => { s.players[this.nextIdx(i)].hand = old[i]; });
        banner('Все карты уехали к соседу');
        this.fx('carousel');
        break;
      }
      case 'robin': {
        const order = s.players.map((_, i) => i).sort((a, b) => s.players[a].hand.length - s.players[b].hand.length);
        const rich = s.players[order[0]];
        const poor = s.players[order[order.length - 1]];
        const m = rich === poor ? 0 : Math.min(2, rich.hand.length - 1);
        for (let i = 0; i < m; i++) poor.hand.push(rich.hand.splice(Math.floor(this.rng() * rich.hand.length), 1)[0]);
        banner(m ? `${rich.name} отдаёт ${m} карт(ы) игроку ${poor.name}` : 'Отнимать не у кого, все равны', order[0]);
        break;
      }
      case 'upside':
        banner('На ближайшие ходы стол вверх ногами');
        this.fx('upside');
        break;
      case 'blind':
        s.blindTurns = n;
        banner('Целый круг карты лежат рубашкой вверх. Удачи!');
        break;
      case 'blitz':
        s.blitzTurns = n;
        banner('Круг на скорость: 7 секунд на ход, иначе +2');
        break;
      case 'lightning': {
        const t = randomPlayer();
        s.skipNext.push(t);
        banner(`Попала в ${s.players[t].name}: пропуск следующего хода`, t);
        this.fx('lightning', undefined, { target: t });
        break;
      }
      case 'bomber': {
        const t = randomPlayer();
        const got = this.give(s.players[t], 3).length;
        banner(`Летит прямо на ${s.players[t].name}: +${got} карты!`, t);
        this.fx('bomber', undefined, { target: t });
        break;
      }
      case 'jackpot': {
        const t = randomPlayer();
        const m = shed(s.players[t], 3);
        banner(m ? `${s.players[t].name} сбрасывает ${m} карт(ы)!` : `${s.players[t].name} и так почти пуст`, t);
        this.fx('jackpot', undefined, { target: t });
        break;
      }
      case 'group':
        s.dare = this.pick(GROUP_DARES);
        banner('Задание для всех сразу');
        s.phase = 'group';
        return true;
      case 'coin':
        banner(`${p.name}, орёл или решка?`);
        if (!p.bot) {
          s.coin = null;
          s.phase = 'coin';
          return true;
        }
        this.flipCoin(this.rng() < 0.5 ? 'heads' : 'tails');
        s.coin = null;
        break;
    }
    return false;
  }

  doneGroup() {
    if (this.s.phase !== 'group') return;
    this.s.dare = null;
    this.say('🎤 Общий фант выполнен. Красавцы!');
    this.startPlay();
    this.commit();
  }

  guessCoin(guess: 'heads' | 'tails') {
    if (this.s.phase !== 'coin' || this.s.coin) return;
    this.flipCoin(guess);
    this.commit();
  }

  finishCoin() {
    if (this.s.phase !== 'coin' || !this.s.coin) return;
    this.s.coin = null;
    this.startPlay();
    this.commit();
  }

  private flipCoin(guess: 'heads' | 'tails') {
    const s = this.s;
    const p = this.cp();
    const result = this.rng() < 0.5 ? 'heads' : 'tails';
    const win = guess === result;
    s.coin = { guess, result, win };
    const side = result === 'heads' ? 'орёл' : 'решка';
    if (win) {
      const m = Math.min(2, p.hand.length - 1);
      for (let i = 0; i < m; i++) s.deck.unshift(p.hand.splice(Math.floor(this.rng() * p.hand.length), 1)[0]);
      this.say(`🪙 Выпал ${side}. ${p.name} угадал(а) и сбрасывает ${m}`);
    } else {
      this.give(p, 2);
      this.say(`🪙 Выпал ${side}. ${p.name} не угадал(а) и тянет 2`);
    }
  }

  private startPlay() {
    const s = this.s;
    const p = this.cp();
    s.phase = 'play';
    if (s.rules.timer && !p.bot) {
      // the event banner eats a few seconds, give them back
      const grace0 = s.lastEventTurn === s.turn ? 2500 : 0;
      s.turnTotal = s.table.turnSec * 1000 + grace0;
      s.turnDeadline = this.now() + s.turnTotal;
    }
    // give humans back the seconds the event banner took
    const grace = s.lastEventTurn === s.turn ? 2500 : 0;
    if (!s.bombNext) {
      if (s.blitzTurns > 0 && !p.bot) {
        s.bombDeadline = this.now() + BLITZ_MS + grace;
        s.timerKind = 'blitz';
      }
      return;
    }
    s.bombNext = false;
    if (!p.bot) {
      s.bombDeadline = this.now() + s.table.bombSec * 1000 + grace;
      s.timerKind = 'bomb';
      return;
    }
    if (this.rng() < 0.3) {
      const n = 3 + s.pending;
      s.pending = 0;
      s.pendingType = null;
      this.give(p, n);
      this.say(`💥 ${p.name} запаниковал(а) от бомбы и тянет ${n}`);
      this.fx('boom', `💥 ${p.name} подорвался!`);
      this.advance();
    } else this.say(`💣 ${p.name} хладнокровно разминирует бомбу 😎`);
  }

  private ask(choice: Choice) {
    this.s.choice = choice;
    this.s.phase = 'choose';
  }

  private runEffect() {
    const s = this.s;
    const e = s.effect!;
    const card = e.card;
    const p = this.cp();
    const n = s.players.length;
    const nextName = s.players[this.nextIdx()].name;
    switch (card.type) {
      case 'num':
        if (s.rules.sevenZero && card.value === 7) return this.ask({ kind: 'player', title: 'Семёрка! С кем меняемся картами?', mode: 'swap' });
        if (s.rules.sevenZero && card.value === 0) {
          const old = s.players.map(x => x.hand);
          s.players.forEach((_, i) => { s.players[this.nextIdx(i)].hand = old[i]; });
          this.say('🔄 Ноль! Все передают свои карты дальше по кругу');
          this.fx('flip');
        }
        break;
      case 'skip':
        e.steps = 2;
        this.say(`💤 ${nextName} пропускает ход. Обидно.`);
        break;
      case 'rev':
        s.dir = s.dir === 1 ? -1 : 1;
        if (n === 2) e.steps = 2;
        this.say('⇄ Разворот! Едем в другую сторону');
        break;
      case 'draw2':
        s.pending += 2;
        s.pendingType = 'draw2';
        if (s.pending > 2) this.say(`📚 Стопка! Штраф уже +${s.pending}`);
        break;
      case 'wild':
        return this.ask({ kind: 'color', title: 'Какой цвет?' });
      case 'wild4':
        return this.ask({ kind: 'color', title: '+4! Какой цвет?' });
      case 'swap':
        return this.ask({ kind: 'player', title: 'С кем меняемся картами?', mode: 'swap' });
      case 'gift':
        return this.ask({ kind: 'card', title: 'Какую карту подарить?' });
      case 'bomb':
        s.bombNext = true;
        this.say(`💣 ${p.name} подкладывает бомбу под ${nextName}!`);
        this.fx('toast', `💣 Бомба для ${nextName}!`);
        break;
      case 'dare':
        if (s.rules.dares) {
          s.dareNext = true;
          this.say(`🎭 ${nextName}, тебе фант!`);
        }
        break;
      case 'rain':
        s.players.forEach(o => { if (o !== p) this.give(o, 1); });
        this.say('☔ Ливень! Все остальные тянут по карте');
        this.fx('toast', '☔ Ливень!');
        break;
      case 'mirror':
        s.dir = s.dir === 1 ? -1 : 1;
        if (s.pending > 0) {
          this.say(`🪞 Отражено! +${s.pending} летит обратно`);
          this.fx('toast', `🪞 Отражено! +${s.pending}`);
        } else {
          if (n === 2) e.steps = 2;
          this.say('🪞 Зеркало без штрафа работает как разворот');
        }
        break;
      case 'chaos': {
        const all = this.shuffle(s.players.flatMap(x => x.hand));
        s.players.forEach(x => { x.hand = []; });
        let i = s.cur;
        while (all.length) {
          i = this.nextIdx(i);
          s.players[i].hand.push(all.pop()!);
        }
        this.say('🌪 ХАОС! Все карты перемешаны и розданы заново');
        this.fx('chaos', '🌪 ХАОС!');
        if (s.players.some(x => x.hand.length === 0)) break;
        return this.ask({ kind: 'color', title: 'Хаос! Какой цвет?' });
      }
      case 'dump':
        return this.ask({ kind: 'color', title: 'Карты какого цвета выкидываем?', mode: 'dump' });
    }
    this.finishEffect();
  }

  private finishEffect() {
    const s = this.s;
    const steps = s.effect?.steps ?? 1;
    s.effect = null;
    s.choice = null;
    s.phase = 'play';
    if (s.players.some(p => p.hand.length === 0)) this.win();
    else this.advance(steps);
    this.commit();
  }

  /** Same team (teams format only). */
  sameTeam(a: number, b: number) {
    const t = this.s.teams;
    return !!t && t[a] === t[b];
  }

  /** Round time is up: whoever has the fewest cards wins (in teams, their team). */
  checkTimeLimit() {
    const s = this.s;
    if (s.endsAt === null || s.phase === 'over' || this.now() < s.endsAt) return;
    let w = 0;
    s.players.forEach((p, i) => { if (p.hand.length < s.players[w].hand.length) w = i; });
    s.timeUp = true;
    this.say(`⏱ Время вышло! Меньше всех карт у ${s.players[w].name}`);
    this.fx('toast', '⏱ Время вышло!');
    this.win(w);
    this.commit();
  }

  private win(forced?: number) {
    const s = this.s;
    const w = forced ?? s.players.findIndex(p => p.hand.length === 0);
    s.phase = 'over';
    s.winner = w;
    s.winTeam = s.teams ? s.teams[w] : null;
    s.endsAt = null;
    s.turnDeadline = null;
    s.bombDeadline = null;
    s.choice = null;
    // the punishment goes to the worst player of the losing side
    let loser = -1;
    s.players.forEach((p, i) => {
      if (i === w || this.sameTeam(i, w)) return;
      if (loser < 0 || p.hand.length > s.players[loser].hand.length) loser = i;
    });
    s.loser = loser >= 0 ? loser : null;
    s.punishment = s.rules.punish ? this.pick(PUNISH) : null;
    if (s.winTeam !== null) {
      const names = s.players.filter((_, i) => s.teams![i] === s.winTeam).map(p => p.name).join(' и ');
      this.say(`🏆 Команда «${TEAM_NAMES[s.winTeam]}» побеждает: ${names}!`);
    } else this.say(`🏆 ${s.players[w].name} побеждает!`);
    this.fx('win');
  }
}
