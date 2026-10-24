export type Color = 'red' | 'yellow' | 'green' | 'blue';
export type CardColor = Color | 'wild';
export type CardType =
  | 'num' | 'skip' | 'rev' | 'draw2' | 'wild' | 'wild4'
  | 'swap' | 'gift' | 'bomb' | 'dare' | 'rain' | 'mirror' | 'chaos' | 'dump';

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
  /** online only: the player's connection dropped (autopilot may be playing) */
  offline?: boolean;
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
}

export type EventId =
  | 'meteor' | 'recolor' | 'mono' | 'carousel' | 'robin' | 'upside'
  | 'blind' | 'blitz' | 'lightning' | 'jackpot' | 'group' | 'coin' | 'bomber';

/** Table look picked by the host. Card faces stay the same in every theme, so they are always easy to read. */
export type ThemeId = 'classic' | 'neon' | 'space' | 'halloween';

export type Choice =
  | { kind: 'color'; title: string; mode?: 'dump' }
  | { kind: 'player'; title: string; mode: 'swap' | 'gift' }
  | { kind: 'card'; title: string };

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
  | 'caught' | 'challenge' | 'timeout';
export interface Fx {
  id: number;
  kind: FxKind;
  text?: string;
  /** event banner: second line and icon */
  sub?: string;
  icon?: string;
  /** player index the effect lands on */
  target?: number;
}

export interface State {
  round: number;
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
  dare: string | null;
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
  log: string[];
  fx: Fx[];
  turn: number;
  lastHuman: number | null;
  winner: number | null;
  loser: number | null;
  punishment: string | null;
}
