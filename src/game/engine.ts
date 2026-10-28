import { Observable } from '../lib/observable';
import { botCatchers, botDecision, pickBotCard } from './bot';
import { CNAME, COLORS, CPLURAL, DARES, DEFAULT_TABLE, effectiveTable, MERCY_LIMIT, PUNISH, TEAM_NAMES } from './content';
import { eventDue, fireEvent, flipCoin, type EventTools } from './events';
import { buildDeck } from './deck';
import { pick, randomIndex, shuffle, type Rng } from './random';
import { activeSeats, canPlayCard, cardName, drawValue, isCatchable, nextSeat, playableCard, sameTeam } from './rules';
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

/** What the setup screen of a local (one device) game edits. */
export type LocalSetup = Pick<GameConfig, 'players' | 'rules' | 'theme' | 'table'>;

export interface GameOptions {
  rng?: Rng;
  now?: () => number;
}

/** Time per turn during a blitz event. */
export const BLITZ_MS = 7_000;
/** An event banner eats a few seconds of the turn: the person moving gets them back. */
const EVENT_GRACE_MS = 2_500;
const LOG_LIMIT = 50;
const FX_LIMIT = 20;

/**
 * Pure game logic. Synchronous and UI-agnostic: every public action mutates `s`
 * and notifies subscribers. Timing (bot delays, the bomb countdown) is driven from outside:
 * by GameScreen for a local game, by the server's Room online.
 */
export class Game extends Observable {
  s: State;
  readonly isLocal = true;
  /** server clock minus local clock; always 0 for a local game */
  readonly clockOffset = 0;
  /** effects with an id up to this were already shown */
  readonly fxBaseline = 0;
  private fxId = 0;
  private nextCardId = 0;
  private online: boolean;
  private rng: Rng;
  private now: () => number;

  constructor(cfg: GameConfig, opts: GameOptions = {}) {
    super();
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
    // ids are handed out after shuffling, so an id tells nothing about the card's face
    const deck = shuffle(buildDeck(cfg.rules), this.rng);
    deck.forEach(c => { c.id = this.nextCardId++; });
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
    // the pile starts with a number card
    const first = deck.splice(deck.map(c => c.type).lastIndexOf('num'), 1)[0];

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
      cur: randomIndex(n, this.rng),
      dir: 1,
      color: first.color as Color,
      pending: 0,
      pendingType: null,
      pendingLast: 0,
      rouletteNext: false,
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
    this.say(`Раздали по ${table.handSize}. Первым ходит ${players[this.s.cur].name}. Удачи, она понадобится.`);
    this.beginTurn();
  }

  /* ================= queries ================= */

  /** The player whose turn it is. */
  cp() { return this.s.players[this.s.cur]; }
  top() { return this.s.discard[this.s.discard.length - 1]; }
  nextIdx(from = this.s.cur, steps = 1) { return nextSeat(this.s, from, steps); }
  /** Seat indices of the people (not bots). */
  humans() { return this.s.players.map((p, i) => (p.bot ? -1 : i)).filter(i => i >= 0); }
  /** Cards in the game, wherever they are. Never changes during a round. */
  totalCards() {
    return this.s.deck.length + this.s.discard.length + this.s.players.reduce((a, p) => a + p.hand.length, 0);
  }
  canPlay(c: Card) { return canPlayCard(this.s, c); }
  playable(c: Card) { return playableCard(this.s, c); }
  sameTeam(a: number, b: number) { return sameTeam(this.s, a, b); }
  /** The UNO window is open for the victim right now. */
  catchable() { return isCatchable(this.s); }

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

  /* ================= turn actions ================= */

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
      else this.openUnoCatch();
    }
    if (p.hand.length === 0) {
      this.win();
      this.emitChange();
      return true;
    }
    s.effect = { card, steps: 1, guilty };
    this.runEffect();
    this.emitChange();
    return true;
  }

  draw(): void {
    const s = this.s;
    if (s.phase !== 'play') return;
    const p = this.cp();
    s.bombDeadline = null;
    s.challenge = null;
    if (s.pending > 0) {
      const n = this.takePending();
      this.say(`${p.name} тянет ${n} и тихо плачет 😭`);
      if (n >= 6) this.fx('toast', `+${n}! 😱`);
      this.fx('shake');
      // the message comes first: in No Mercy the draw itself may knock them out and even end the round
      this.give(p, n);
      this.advance();
      this.emitChange();
      return;
    }
    if (s.drawn) return;
    const got: Card[] = [];
    if (s.rules.drawPlay || s.rules.noMercy) {
      // keep drawing until something fits (the cap only guards against an endless loop)
      for (let i = 0; i < 80; i++) {
        const g = this.give(p, 1);
        if (!g.length) break;
        got.push(g[0]);
        if (this.canPlay(g[0]) || p.out) break;
      }
    } else got.push(...this.give(p, 1));
    s.drawn = true;
    s.lastDrawn = got.length ? got[got.length - 1].id : null;
    this.say(`${p.name} тянет ${got.length > 1 ? `${got.length} карт(ы)` : got.length ? 'карту' : '… а колода пуста'}`);
    if (!p.hand.some(c => this.playable(c))) this.advance();
    this.emitChange();
  }

  pass() {
    const s = this.s;
    if (s.phase !== 'play' || !s.drawn) return;
    // No Mercy: the card you drew to has to be played
    if (s.rules.noMercy && this.cp().hand.some(c => this.playable(c))) return;
    this.say(`${this.cp().name} пасует`);
    this.advance();
    this.emitChange();
  }

  callUno() {
    const s = this.s;
    if (s.phase !== 'play' || s.unoCalled) return;
    s.unoCalled = true;
    this.fx('uno', `${this.cp().name}: UNO!`);
    this.emitChange();
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
        // the dumped cards go under the dump card itself
        s.discard.splice(s.discard.length - 1, 0, ...out);
        this.say(`🧹 ${p.name} выкидывает все ${CPLURAL[col]}: ${out.length} шт.`);
      }
      s.color = col;
      if (ch.mode === 'roulette') return this.spinRoulette(col);
      const penalty = drawValue(e.card);
      if (penalty) {
        this.addPending(e.card);
        this.say(`Цвет ${CNAME[col].toLowerCase()}, штраф уже +${s.pending}`);
        if (e.card.type === 'wild4' && s.rules.challenge) s.challenge = { by: s.cur, target: this.nextIdx(), guilty: !!e.guilty };
      } else if (e.card.type !== 'dump') this.say(`Цвет теперь ${CNAME[col].toLowerCase()}`);
      return this.finishEffect();
    }
    if (ch.kind === 'card') {
      if (!p.hand.some(c => c.id === value)) return;
      e.giftCard = value as number;
      s.choice = { kind: 'player', title: 'Кому дарим?', mode: 'gift' };
      this.emitChange();
      return;
    }
    const ti = Number(value);
    if (!Number.isInteger(ti) || ti < 0 || ti >= s.players.length || ti === s.cur || s.players[ti].out) return;
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

  /* ================= prompts between turns ================= */

  /** Hot seat: the next person has taken the device. */
  confirmHandover() {
    if (this.s.phase !== 'handover') return;
    this.afterHandover();
    this.emitChange();
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
    this.emitChange();
  }

  /** The group dare (a random event) is done. */
  doneGroup() {
    if (this.s.phase !== 'group') return;
    this.s.dare = null;
    this.say('🎤 Общий фант выполнен. Красавцы!');
    this.startPlay();
    this.emitChange();
  }

  guessCoin(guess: 'heads' | 'tails') {
    if (this.s.phase !== 'coin' || this.s.coin) return;
    flipCoin(this.eventTools, guess);
    this.emitChange();
  }

  /** The coin result has been shown: on with the turn. */
  finishCoin() {
    if (this.s.phase !== 'coin' || !this.s.coin) return;
    this.s.coin = null;
    this.startPlay();
    this.emitChange();
  }

  /* ================= UNO catching ================= */

  /** Someone noticed the victim did not call UNO: the victim draws. On one shared screen the catcher is whoever is looking. */
  catchUno(by: number = this.catcherHere()) {
    const s = this.s;
    if (!this.catchable() || !s.unoCatch || by === s.unoCatch.victim || !s.players[by]) return;
    const v = s.players[s.unoCatch.victim];
    s.unoCatch = null;
    const penalty = s.table.unoPenalty;
    this.give(v, penalty);
    this.say(`🫵 ${s.players[by].name} ловит ${v.name}: забыл(а) крикнуть UNO! +${penalty}`);
    this.fx('caught', `🫵 ${s.players[by].name} поймал(а) ${v.name}! +${penalty}`);
    this.fx('shake');
    this.emitChange();
  }

  /** The victim remembers in time and calls UNO before anyone catches them. */
  lateUno(who: number = this.s.unoCatch?.victim ?? -1) {
    const s = this.s;
    if (!this.catchable() || s.unoCatch?.victim !== who) return;
    s.unoCatch = null;
    this.fx('uno', `${s.players[who].name}: UNO! (успел)`);
    this.emitChange();
  }

  /** The current player is down to one card and forgot UNO: anyone may catch them until the end of the next turn. */
  private openUnoCatch() {
    const s = this.s;
    const p = this.cp();
    const bots = botCatchers(s, s.cur);
    // a bot notices about half the time, after a human-like pause
    const botCatcher = bots.length && this.rng() < 0.55 ? pick(bots, this.rng) : null;
    s.unoCatch = { victim: s.cur, until: s.turn + 1, botCatcher, botDelay: 1400 + Math.floor(this.rng() * 2200) };
    this.say(`🤫 ${p.name} осталась одна карта… а «UNO!» никто не слышал`);
  }

  /** Shared screen: the person looking at it, or failing that the first person who is not the victim. */
  private catcherHere() {
    const v = this.viewer();
    const victim = this.s.unoCatch?.victim;
    if (v !== null && v !== victim) return v;
    return this.humans().find(i => i !== victim) ?? -1;
  }

  /* ================= +4 challenge ================= */

  /** The target of a +4 challenges it. */
  challengeWild4() {
    const s = this.s;
    const ch = s.challenge;
    if (s.phase !== 'play' || !ch || ch.target !== s.cur || s.drawn) return;
    s.challenge = null;
    const offender = s.players[ch.by];
    const me = this.cp();
    if (ch.guilty) {
      // caught: the one who laid the +4 draws it, the challenger's penalty shrinks by those 4
      this.give(offender, 4);
      s.pending = Math.max(0, s.pending - 4);
      if (!s.pending) s.pendingType = null;
      this.say(`⚖️ ${me.name} оспаривает +4 и прав(а)! У ${offender.name} был нужный цвет — тянет 4`);
      this.fx('challenge', `⚖️ Попался! ${offender.name} тянет 4`);
      this.fx('shake');
      this.emitChange();
      return;
    }
    s.pending += 2;
    this.say(`⚖️ ${me.name} оспаривает +4, но ${offender.name} играл(а) честно. Штраф +${s.pending}`);
    this.fx('challenge', `⚖️ Честно! ${me.name} тянет ${s.pending}`);
    this.draw();
  }

  declineChallenge() {
    const s = this.s;
    if (!s.challenge || s.challenge.target !== s.cur) return;
    s.challenge = null;
    this.emitChange();
  }

  /* ================= clocks (called by whoever drives the timing) ================= */

  /** Pause the turn clock (round start): it restarts in full once `ms` have passed. */
  holdClock(ms: number) {
    const s = this.s;
    if (s.turnDeadline !== null) s.turnDeadline = this.now() + ms + s.turnTotal;
    // the round clock does not run while the cards are being dealt
    if (s.endsAt !== null) s.endsAt = this.now() + ms + s.table.roundMin * 60_000;
    this.emitChange();
  }

  /**
   * The turn clock ran out. With the autopilot on it plays the turn; otherwise, as in the official online UNO,
   * the player draws a card and the turn passes. `autopilot`: the server's call for someone whose connection dropped.
   */
  timeoutTurn(autopilot = false) {
    const s = this.s;
    if (s.turnDeadline === null || this.now() < s.turnDeadline || s.phase === 'over') return;
    s.turnDeadline = null;
    if (autopilot || s.table.autopilot) this.autopilotTurn();
    else this.missTurn();
  }

  /**
   * Someone sat their turn out (clock ran out, or idle online with autopilot off): they draw one card, or the
   * waiting penalty, and lose the turn. A decision they left open (colour, coin…) is made for them, with no penalty:
   * the card is already on the pile.
   */
  missTurn() {
    const s = this.s;
    if (s.phase === 'over') return;
    const p = this.cp();
    if (s.phase !== 'play') {
      this.botAct(true);
      return;
    }
    s.turnDeadline = null;
    s.challenge = null;
    if (s.pending > 0) {
      this.fx('timeout', `⏰ Время! ${p.name} берёт +${s.pending}`);
      return this.draw();
    }
    if (s.drawn) {
      this.say(`⏰ ${p.name} не успел(а) сходить, ход переходит дальше`);
      this.fx('timeout', '⏰ Время! Ход пропущен');
    } else {
      // one card only, even where you normally draw until something fits
      this.say(`⏰ ${p.name} не успел(а) и тянет карту`);
      this.fx('timeout', '⏰ Время! +1 карта и пропуск хода');
      this.give(p, 1);
    }
    this.advance();
    this.emitChange();
  }

  /** Plays the rest of the current person's turn as a bot would. */
  autopilotTurn() {
    const s = this.s;
    if (s.phase === 'over') return;
    s.turnDeadline = null;
    const turn = s.turn;
    const who = this.cp().name;
    this.say(`⏰ ${who} не успел(а), сходил автопилот`);
    this.fx('timeout', `⏰ Время! За ${who} сходил автопилот`);
    const sameTurn = () => s.turn === turn && (s.phase as string) !== 'over';
    // a turn can take several steps (draw, then choose a colour…); stop when a step changes nothing
    for (let i = 0; i < 12 && sameTurn(); i++) {
      const v = this.version;
      this.botAct(true);
      if (this.version === v) break;
    }
    this.emitChange();
  }

  /** The bomb or blitz countdown ran out: penalty and the turn passes. */
  checkBomb() {
    const s = this.s;
    if (s.phase !== 'play' || s.bombDeadline === null || this.now() < s.bombDeadline) return;
    s.bombDeadline = null;
    const p = this.cp();
    const bomb = s.timerKind === 'bomb';
    s.timerKind = null;
    const n = (bomb ? 3 : 2) + this.takePending();
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
    this.emitChange();
  }

  /** Round time is up: whoever has the fewest cards wins (in teams, their team). */
  checkTimeLimit() {
    const s = this.s;
    if (s.endsAt === null || s.phase === 'over' || this.now() < s.endsAt) return;
    const active = activeSeats(s);
    let w = active[0];
    active.forEach(i => { if (s.players[i].hand.length < s.players[w].hand.length) w = i; });
    s.timeUp = true;
    this.say(`⏱ Время вышло! Меньше всех карт у ${s.players[w].name}`);
    this.fx('toast', '⏱ Время вышло!');
    this.win(w);
    this.emitChange();
  }

  /* ================= bots ================= */

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
    if (s.phase === 'choose' && s.choice) return this.resolveChoice(botDecision(s, s.choice));
    if (s.phase !== 'play') return;
    if (s.challenge && s.challenge.target === s.cur) {
      // bots smell a bluff about a third of the time; autopilot never gambles
      if (!force && this.rng() < 0.35) return this.challengeWild4();
      s.challenge = null;
    }
    const options = p.hand.filter(c => this.playable(c));
    if (!options.length) return s.drawn && s.pending === 0 ? this.pass() : this.draw();
    const card = pickBotCard(s, options, this.rng);
    // bots forget to call UNO now and then, so people have someone to catch
    if (p.hand.length === 2) s.unoCalled = this.rng() > 0.2;
    this.play(card.id);
  }

  /* ================= turn flow ================= */

  private advance(steps = 1) {
    if (this.s.phase === 'over') return;
    this.s.cur = this.nextIdx(this.s.cur, steps);
    this.beginTurn();
  }

  private beginTurn() {
    const s = this.s;
    if (s.phase === 'over') return;
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
      const sharedScreen = this.humans().length > 1 && !this.online;
      const sameAsBefore = s.lastHuman === s.cur;
      s.lastHuman = s.cur;
      // the same person moving again (skip in a 2-player game) needs no curtain
      if (sharedScreen && !sameAsBefore) {
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
    if (s.rouletteNext) {
      // the colour roulette hits whoever moves now: they name a colour and dig for it
      s.rouletteNext = false;
      s.effect = { card: this.top(), steps: 1 };
      return this.ask({ kind: 'color', title: 'Рулетка! Какой цвет ищешь?', mode: 'roulette' });
    }
    if (s.dareNext) {
      s.dareNext = false;
      const d = pick(DARES, this.rng);
      if (p.bot) this.say(`🎭 ${p.name} получает фант: «${d}». Бот уверяет, что выполнил.`);
      else {
        s.dare = d;
        s.phase = 'dare';
        return;
      }
    }
    this.stepEvent();
  }

  /** Maybe fire a random event, then start the turn proper. */
  private stepEvent() {
    const s = this.s;
    if (eventDue(s, this.rng)) {
      s.lastEventTurn = s.turn;
      if (this.fireEvent()) return;
    }
    this.startPlay();
  }

  /** The player may now move: start the turn clock and any bomb or blitz countdown. */
  private startPlay() {
    const s = this.s;
    // the round may have just ended (No Mercy: an event knocked out the last opponent)
    if (s.phase === 'over') return;
    const p = this.cp();
    // knocked out just now (an event dealt them too many cards): the turn moves on
    if (p.out) return this.advance();
    s.phase = 'play';
    const grace = s.lastEventTurn === s.turn ? EVENT_GRACE_MS : 0;
    if (s.rules.timer && !p.bot) {
      s.turnTotal = s.table.turnSec * 1000 + grace;
      s.turnDeadline = this.now() + s.turnTotal;
    }
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
    // bots have no clock: they panic now and then instead
    if (this.rng() < 0.3) {
      const n = 3 + this.takePending();
      this.give(p, n);
      this.say(`💥 ${p.name} запаниковал(а) от бомбы и тянет ${n}`);
      this.fx('boom', `💥 ${p.name} подорвался!`);
      this.advance();
    } else this.say(`💣 ${p.name} хладнокровно разминирует бомбу 😎`);
  }

  /* ================= card effects ================= */

  private ask(choice: Choice) {
    if (this.s.phase === 'over') return;
    this.s.choice = choice;
    this.s.phase = 'choose';
  }

  /** Applies the card just played. Cards that need a decision stop at `ask` and continue in `resolveChoice`. */
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
          this.rotateHands();
          this.say('🔄 Ноль! Все передают свои карты дальше по кругу');
          this.fx('flip');
        }
        break;
      case 'skip':
        e.steps = 2;
        this.say(`💤 ${nextName} пропускает ход. Обидно.`);
        break;
      case 'rev':
        this.reverse();
        // with two players a reverse works like a skip
        if (n === 2) e.steps = 2;
        this.say('⇄ Разворот! Едем в другую сторону');
        break;
      case 'draw2':
      case 'draw4':
        this.addPending(card);
        if (s.pending > drawValue(card)) this.say(`📚 Стопка! Штраф уже +${s.pending}`);
        break;
      case 'wild6':
      case 'wild10':
        return this.ask({ kind: 'color', title: `+${drawValue(card)}! Какой цвет?` });
      case 'wildRev4':
        // reverse first: the +4 goes to whoever now moves next (with two players, that is you again)
        this.reverse();
        if (activeSeats(s).length === 2) e.steps = 2;
        this.say('⇄ Разворот +4! Едем в другую сторону');
        return this.ask({ kind: 'color', title: 'Разворот +4! Какой цвет?' });
      case 'skipAll':
        // everyone else is skipped: round the table and back to you
        e.steps = activeSeats(s).length;
        this.say(`⊘ ${p.name} пропускает всех и ходит ещё раз`);
        break;
      case 'discardAll': {
        const col = card.color as Color;
        const out = p.hand.filter(c => c.color === col);
        p.hand = p.hand.filter(c => c.color !== col);
        s.discard.splice(s.discard.length - 1, 0, ...out);
        this.say(`🗑️ ${p.name} сбрасывает все ${CPLURAL[col]}: ${out.length} шт.`);
        break;
      }
      case 'roulette':
        s.rouletteNext = true;
        this.say(`🎡 Рулетка для ${nextName}!`);
        this.fx('toast', `🎡 Рулетка для ${nextName}!`);
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
        s.players.forEach(o => { if (o !== p && !o.out) this.give(o, 1); });
        this.say('☔ Ливень! Все остальные тянут по карте');
        this.fx('toast', '☔ Ливень!');
        break;
      case 'mirror':
        this.reverse();
        if (s.pending > 0) {
          this.say(`🪞 Отражено! +${s.pending} летит обратно`);
          this.fx('toast', `🪞 Отражено! +${s.pending}`);
        } else {
          if (n === 2) e.steps = 2;
          this.say('🪞 Зеркало без штрафа работает как разворот');
        }
        break;
      case 'chaos': {
        const all = shuffle(s.players.flatMap(x => x.hand), this.rng);
        s.players.forEach(x => { x.hand = []; });
        let i = s.cur;
        while (all.length) {
          i = this.nextIdx(i);
          s.players[i].hand.push(all.pop()!);
        }
        this.say('🌪 ХАОС! Все карты перемешаны и розданы заново');
        this.fx('chaos', '🌪 ХАОС!');
        if (this.emptyHand() >= 0) break;
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
    // the effect itself may have ended the round (No Mercy knockout)
    if (s.phase === 'over') return this.emitChange();
    s.phase = 'play';
    if (this.emptyHand() >= 0) this.win();
    else this.advance(steps);
    this.emitChange();
  }

  /* ================= random events (see events.ts) ================= */

  /** Applies a random event (or `forced`). Returns true when it waits for player input. */
  fireEvent(forced?: EventId): boolean {
    return fireEvent(this.eventTools, forced);
  }

  /** What an event may touch: the state plus a few of the engine's helpers. */
  private get eventTools(): EventTools {
    return {
      s: this.s,
      rng: this.rng,
      current: () => this.cp(),
      hasHumans: () => this.humans().length > 0,
      give: (p, n) => this.give(p, n),
      takeRandomCard: from => this.takeRandomCard(from),
      shedRandom: (p, k) => this.shedRandom(p, k),
      rotateHands: () => this.rotateHands(),
      say: m => this.say(m),
      fx: (kind, text, extra) => this.fx(kind, text, extra),
    };
  }

  /* ================= end of round ================= */

  /** Ends the round. `forced`: the winner when time ran out; otherwise whoever has no cards left. */
  private win(forced?: number) {
    const s = this.s;
    const w = forced ?? this.emptyHand();
    s.phase = 'over';
    s.winner = w;
    s.winTeam = s.teams ? s.teams[w] : null;
    s.endsAt = null;
    s.turnDeadline = null;
    s.bombDeadline = null;
    s.choice = null;
    // the punishment goes to the worst player of the losing side: the first knocked out, or the most cards
    let loser = -1;
    s.players.forEach((p, i) => {
      if (i === w || this.sameTeam(i, w)) return;
      const l = loser >= 0 ? s.players[loser] : null;
      const worse = !l || (p.out ? !l.out || p.out < l.out : !l.out && p.hand.length > l.hand.length);
      if (worse) loser = i;
    });
    s.loser = loser >= 0 ? loser : null;
    s.punishment = s.rules.punish ? pick(PUNISH, this.rng) : null;
    if (s.winTeam !== null) {
      const names = s.players.filter((_, i) => s.teams![i] === s.winTeam).map(p => p.name).join(' и ');
      this.say(`🏆 Команда «${TEAM_NAMES[s.winTeam]}» побеждает: ${names}!`);
    } else this.say(`🏆 ${s.players[w].name} побеждает!`);
    this.fx('win');
  }

  /* ================= low-level helpers ================= */

  private say(message: string) {
    this.s.log.push(message);
    if (this.s.log.length > LOG_LIMIT) this.s.log.shift();
  }

  private fx(kind: FxKind, text?: string, extra: Partial<Fx> = {}) {
    this.s.fx.push({ id: ++this.fxId, kind, text, ...extra });
    if (this.s.fx.length > FX_LIMIT) this.s.fx.shift();
  }

  /** Deals `n` cards from the deck to `p` (fewer if even the reshuffled pile runs out). */
  private give(p: Player, n: number): Card[] {
    const got: Card[] = [];
    for (let i = 0; i < n; i++) {
      if (!this.s.deck.length) this.refill();
      if (!this.s.deck.length) break;
      const c = this.s.deck.pop()!;
      p.hand.push(c);
      got.push(c);
    }
    if (this.s.rules.noMercy && !p.out && p.hand.length >= MERCY_LIMIT) this.knockOut(p);
    return got;
  }

  /* ================= No Mercy ================= */

  /** Index of a player still in the game with no cards left (the winner), or -1. */
  private emptyHand(): number {
    return this.s.players.findIndex(p => !p.out && p.hand.length === 0);
  }

  /** Puts a penalty card on the stack. */
  private addPending(card: Card) {
    const s = this.s;
    s.pending += drawValue(card);
    s.pendingLast = drawValue(card);
    s.pendingType = card.type === 'draw2' ? 'draw2' : 'wild4';
  }

  /** The mercy rule: too many cards and you are out. Their cards go under the deck. */
  private knockOut(p: Player) {
    const s = this.s;
    p.out = s.players.filter(x => x.out).length + 1;
    s.deck.unshift(...p.hand);
    p.hand = [];
    this.say(`💀 ${p.name} набирает ${MERCY_LIMIT}+ карт и выбывает. Пощады нет!`);
    this.fx('knockout', `💀 ${p.name} выбывает!`);
    // the last one standing (or the last team) wins
    const left = activeSeats(s);
    if (s.phase !== 'over' && left.length && left.every(i => i === left[0] || this.sameTeam(i, left[0]))) this.win(left[0]);
  }

  /** Colour roulette: the current player turns up cards until one of `col` appears, keeps them all and loses the turn. */
  private spinRoulette(col: Color) {
    const p = this.cp();
    this.say(`🎡 ${p.name} ищет ${CNAME[col].toLowerCase()}…`);
    let n = 0;
    for (let i = 0; i < 200; i++) {
      const g = this.give(p, 1);
      if (!g.length) break;
      n++;
      if (g[0].color === col || p.out) break;
    }
    // the digging may have knocked them out and ended the round; then that is the last word
    if ((this.s.phase as string) !== 'over') {
      this.say(`🎡 …и тянет ${n} карт(ы)`);
      if (n >= 4) this.fx('toast', `🎡 +${n}! 😱`);
      this.fx('shake');
    }
    this.finishEffect();
  }

  /** Mercy check after any change (a swap or a zero can hand someone 25+ cards too); moves on if the current player is out. */
  protected emitChange() {
    const s = this.s;
    if (s.rules.noMercy && s.phase !== 'over') {
      for (const p of s.players) if (!p.out && p.hand.length >= MERCY_LIMIT) this.knockOut(p);
      if ((s.phase as string) !== 'over' && this.cp().out) this.advance();
    }
    super.emitChange();
  }

  /** The deck ran out: shuffle the pile (all but its top card) back into it. */
  private refill() {
    const s = this.s;
    if (s.discard.length < 2) return;
    const top = s.discard.pop()!;
    // fresh ids: online players saw these faces in the discard pile and must not track them
    s.deck = shuffle(s.discard, this.rng).map(c => ({ ...c, id: this.nextCardId++, dealIdx: undefined }));
    s.discard = [top];
    this.say('Колода кончилась, перемешали сброс 🔄');
  }

  private takeRandomCard(from: Player): Card {
    return from.hand.splice(randomIndex(from.hand.length, this.rng), 1)[0];
  }

  /** Puts up to `k` random cards of `p` back under the deck, always leaving at least one. Returns how many. */
  private shedRandom(p: Player, k: number): number {
    const m = Math.min(k, p.hand.length - 1);
    for (let i = 0; i < m; i++) this.s.deck.unshift(this.takeRandomCard(p));
    return Math.max(0, m);
  }

  /** Every hand moves on to the next player in the direction of play. */
  private rotateHands() {
    const s = this.s;
    const old = s.players.map(x => x.hand);
    s.players.forEach((p, i) => { if (!p.out) s.players[this.nextIdx(i)].hand = old[i]; });
  }

  private reverse() {
    this.s.dir = this.s.dir === 1 ? -1 : 1;
  }

  /** Clears the waiting penalty and returns its size. */
  private takePending(): number {
    const n = this.s.pending;
    this.s.pending = 0;
    this.s.pendingType = null;
    this.s.pendingLast = 0;
    return n;
  }
}
