import type { Msg } from '../i18n/msg';

export type Color = 'red' | 'yellow' | 'green' | 'blue';
export type CardColor = Color | 'wild';
export type CardType =
  | 'num' | 'skip' | 'rev' | 'draw2' | 'wild' | 'wild4'
  | 'swap' | 'gift' | 'bomb' | 'dare' | 'rain' | 'mirror' | 'chaos' | 'dump'
  // UNO Show 'Em No Mercy
  | 'draw4' | 'skipAll' | 'discardAll' | 'wildRev4' | 'wild6' | 'wild10' | 'roulette';

export interface Card {
  id: number;
  color: CardColor;
  type: CardType;
  value?: number;
  /** order in the initial deal, used to stagger the deal animation */
  dealIdx?: number;
  /** online: someone else's card, face unknown to this client */
  hidden?: boolean;
  /** online: the id this card had a moment ago on this screen, so it can fly from there */
  fromId?: number;
}

export interface Player {
  name: string;
  bot: boolean;
  hand: Card[];
  /** preset avatar id (see avatars.ts) */
  avatar?: string;
  /** online: the room member sitting here; the evening's score is kept by this id, not by name */
  member?: string;
  /** online only: the player's connection dropped (autopilot may be playing) */
  offline?: boolean;
  /** No Mercy: knocked out for holding too many cards; the number says in what order (1 = first out) */
  out?: number;
}

export interface Rules {
  stack: boolean;
  sevenZero: boolean;
  crazy: boolean;
  dares: boolean;
  uno: boolean;
  drawPlay: boolean;
  punish: boolean;
  events: boolean;
  /** 30 seconds per turn for people; when it runs out the turn is played for them */
  timer: boolean;
  /** a +4 may be challenged: if it was played while holding the current colour, the player who laid it draws 4 */
  challenge: boolean;
  /**
   * UNO Show 'Em No Mercy: its 168-card deck (+6, +10, colour roulette…), penalties stacked only with an
   * equal or bigger draw card, draw until you can play, and 25 cards knock you out.
   */
  noMercy: boolean;
  /**
   * The old official start: if the first card turned up is an action card, it works on the first player
   * (Skip: they miss the turn, Reverse: the dealer starts the other way, +2: they draw 2, Wild: they pick the colour).
   * A +4 goes back into the deck. Off: the pile always starts with a number.
   */
  startAction: boolean;
  /**
   * Jump-In (official house rule): holding a card exactly like the one just played (same colour and number/symbol),
   * you may lay it out of turn; play then carries on from you as if it were your turn.
   */
  jumpIn: boolean;
  /** No Mercy only: 25 cards in hand knock you out of the round (off: hands grow without limit) */
  mercy: boolean;
}

export type EventId =
  | 'meteor' | 'recolor' | 'mono' | 'carousel' | 'robin' | 'upside'
  | 'blind' | 'blitz' | 'lightning' | 'jackpot' | 'group' | 'coin' | 'bomber';

/** How the table plays, beyond the rules: format and the numbers. */
export interface Table {
  /** 2 on 2 (or 3 on 3, 4 on 4): partners alternate around the table, so they sit opposite with 4 players */
  teams: boolean;
  /** 5 cards, 15 seconds a turn, and the round ends after 5 minutes */
  quick: boolean;
  handSize: number;
  turnSec: number;
  bombSec: number;
  unoPenalty: number;
  /** minutes; 0 = no limit */
  roundMin: number;
  events: 'rare' | 'normal' | 'often';
  /** a person who lets the turn clock run out: on autopilot plays on for them, off (the default) draws a card and loses the turn */
  autopilot: boolean;
  /** how well the bots play */
  botLevel: BotLevel;
}

export type BotLevel = 'easy' | 'normal' | 'hard';

/** Table look picked by the host. Card faces stay the same in every theme, so they are always easy to read. */
export type ThemeId = 'classic' | 'neon' | 'space' | 'halloween' | 'winter';

export type Choice =
  | { kind: 'color'; title: Msg; mode?: 'dump' | 'roulette' }
  | { kind: 'player'; title: Msg; mode: 'swap' | 'gift' }
  | { kind: 'card'; title: Msg };

/**
 * handover — hot-seat curtain, waiting for the next human to take the device
 * dare     — current human must accept or refuse a dare
 * play     — normal turn
 * group    — a random event gave everybody a dare, waiting for "done"
 * coin     — a random event: the current human guesses heads or tails
 * choose   — the played card needs a decision (color, target player, card to gift)
 * over     — somebody won
 */
export type Phase = 'handover' | 'dare' | 'group' | 'coin' | 'play' | 'choose' | 'over';

export type FxKind =
  | 'toast' | 'shake' | 'chaos' | 'boom' | 'win' | 'uno' | 'flip'
  | 'event' | 'meteor' | 'spin' | 'lightning' | 'jackpot' | 'upside' | 'carousel' | 'bomber'
  | 'caught' | 'challenge' | 'timeout' | 'knockout' | 'jump' | 'flyby';
export interface Fx {
  id: number;
  kind: FxKind;
  text?: Msg;
  /** event banner: second line, and which event (its drawn icon and its look on the table) */
  sub?: Msg;
  event?: EventId;
  /** player index the effect lands on */
  target?: number;
  /** who caused it, where that matters (who caught a missing UNO) */
  from?: number;
  /** flyby: which route the mascot takes (0..999), the same on every screen */
  seed?: number;
}

export interface State {
  round: number;
  table: Table;
  /** team index per player (teams format), otherwise null */
  teams: number[] | null;
  winTeam: number | null;
  /** quick round / round limit: server time the round ends; null = no limit */
  endsAt: number | null;
  /** the round ended on time: the fewest cards won */
  timeUp: boolean;
  theme: ThemeId;
  players: Player[];
  rules: Rules;
  deck: Card[];
  discard: Card[];
  cur: number;
  dir: 1 | -1;
  color: Color;
  pending: number;
  pendingType: 'draw2' | 'wild4' | null;
  /** No Mercy: the value of the last draw card in the stack; only an equal or bigger one may go on it */
  pendingLast: number;
  /** No Mercy: a colour roulette was played; the next player names a colour and draws until it comes up */
  rouletteNext: boolean;
  /** the round opened with a Wild: the first player picks the colour before moving */
  wildStart: boolean;
  drawn: boolean;
  lastDrawn: number | null;
  unoCalled: boolean;
  bombNext: boolean;
  bombDeadline: number | null;
  /** what the countdown is for: a bomb card (+3) or a blitz event (+2) */
  timerKind: 'bomb' | 'blitz' | null;
  lastEventTurn: number;
  /** turns left during which the near player's hand is face down */
  blindTurns: number;
  blitzTurns: number;
  /** players struck by lightning: they lose their next turn */
  skipNext: number[];
  coin: { guess: 'heads' | 'tails'; result: 'heads' | 'tails'; win: boolean } | null;
  dareNext: boolean;
  /** the dare being done right now (a key + index, rendered in each reader's language) */
  dare: Msg | null;
  phase: Phase;
  choice: Choice | null;
  effect: { card: Card; steps: number; giftCard?: number; guilty?: boolean } | null;
  /** turn clock for people (server time, ms); null when the rule is off or a bot is moving */
  turnDeadline: number | null;
  turnTotal: number;
  /** someone got down to one card without calling UNO: anyone may catch them until `until` (a turn number) */
  unoCatch: { victim: number; until: number; botCatcher: number | null; botDelay: number } | null;
  /** the target of a +4 may challenge it; `guilty` stays on the server */
  challenge: { by: number; target: number; guilty: boolean } | null;
  /** what happened, newest last: keys + params, so each screen reads it in its own language */
  log: Msg[];
  fx: Fx[];
  turn: number;
  lastHuman: number | null;
  winner: number | null;
  loser: number | null;
  punishment: Msg | null;
}
