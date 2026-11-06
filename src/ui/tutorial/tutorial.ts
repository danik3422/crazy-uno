import { randomBot } from '../../game/avatars';
import { DEFAULT_TABLE, MERCY_LIMIT, PRESETS } from '../../game/content';
import type { LocalSetup } from '../../game/engine/Game';
import type { CardType } from '../../game/types';
import type { GameView } from '../../game/view';
import type { StrKey } from '../../i18n/types';
import { botNames, t } from '../../i18n/core';
import { readJson, STORAGE_KEYS, writeJson } from '../../lib/storage';

/*
 * The first game with hints: you and two easy bots, no turn clock, no random events.
 * Two of them: classic UNO, and No Mercy with its own cards and rules.
 * A tip shows at the moment it is needed (your first turn, nothing to play, two cards left…), each once.
 */

export type TutorialMode = 'classic' | 'nomercy';

/** The tutorial game: the mode's rules without the turn clock and the +4 challenge, two easy bots. */
export function tutorialSetup(mode: TutorialMode, name: string, avatar?: string): LocalSetup {
  const rules = PRESETS.find(p => p.id === mode)!.rules;
  const players: LocalSetup['players'] = [{ name: name.trim() || t('setup.me'), bot: false, avatar }];
  for (const bot of botNames().slice(0, 2)) players.push({ name: bot, bot: true, avatar: randomBot(players).avatar });
  return {
    players,
    rules: { ...rules, timer: false, challenge: false, events: false },
    table: { ...DEFAULT_TABLE, botLevel: 'easy' },
    theme: 'classic',
  };
}

/** which tutorials were played (or skipped) */
const done = () => readJson<Partial<Record<TutorialMode, boolean>>>(STORAGE_KEYS.tutorial) ?? {};
export const tutorialDone = (mode: TutorialMode) => done()[mode] === true;
export const markTutorialDone = (mode: TutorialMode) => writeJson(STORAGE_KEYS.tutorial, { ...done(), [mode]: true });

export interface TipContext {
  game: GameView;
  /** the cards are still being dealt */
  locked: boolean;
}

export interface Tip {
  /** each id shows once (some tips have a classic and a No Mercy wording under one id) */
  id: string;
  title: StrKey;
  text: StrKey;
  /** the text may name a number (the penalty) */
  n?: (c: TipContext) => number;
  when: (c: TipContext) => boolean;
}

const ACTIONS: CardType[] = ['skip', 'rev', 'draw2'];
const WILDS: CardType[] = ['wild', 'wild4'];
const NM_DRAWS: CardType[] = ['draw4', 'wild6', 'wild10', 'wildRev4'];
const NM_SPECIAL: CardType[] = ['skipAll', 'discardAll'];
/** No Mercy: a hand this big gets a warning (25 knocks you out) */
const DANGER = 15;

const me = ({ game }: TipContext) => game.s.players[game.seat()];
const nm = (c: TipContext) => c.game.s.rules.noMercy;
const myTurn = ({ game, locked }: TipContext) => !locked && game.viewer() === game.s.cur;
const playing = (c: TipContext) => myTurn(c) && c.game.s.phase === 'play';
const choosing = (c: TipContext) => (myTurn(c) && c.game.s.phase === 'choose' ? c.game.s.choice : null);
/** your turn, asked for this kind of choice (a colour, a player…) with this twist (none, the roulette, the 7) */
const asked = (c: TipContext, kind: 'color' | 'player', mode?: string) => {
  const ch = choosing(c);
  return !!ch && ch.kind === kind && ('mode' in ch ? ch.mode : undefined) === mode;
};
const anyPlayable = (c: TipContext) => me(c).hand.some(card => c.game.playable(card));
const holds = (c: TipContext, types: CardType[]) => me(c).hand.some(card => types.includes(card.type));
const noPenalty = (c: TipContext) => playing(c) && !c.game.s.drawn && c.game.s.pending === 0;

/** In the order they are checked: the first one due that has not been shown yet comes up. */
export const TIPS: Tip[] = [
  { id: 'welcome', title: 'tut.welcome.t', text: 'tut.welcome', when: c => !c.locked && !nm(c) },
  { id: 'welcome', title: 'tut.nm.welcome.t', text: 'tut.nm.welcome', when: c => !c.locked && nm(c) },
  { id: 'catch', title: 'tut.catch.t', text: 'tut.catch', when: c => !!c.game.s.unoCatch && c.game.s.unoCatch.victim !== c.game.seat() && c.game.catchable() },
  { id: 'out', title: 'tut.nm.out.t', text: 'tut.nm.out', n: () => MERCY_LIMIT, when: c => nm(c) && c.game.s.players.some((p, i) => p.out && i !== c.game.seat()) },
  // a penalty you can pass on (stacking) or one you have to take
  { id: 'stack', title: 'tut.stack.t', text: 'tut.stack', n: c => c.game.s.pending, when: c => playing(c) && c.game.s.pending > 0 && anyPlayable(c) },
  { id: 'penalty', title: 'tut.penalty.t', text: 'tut.penalty', n: c => c.game.s.pending, when: c => playing(c) && c.game.s.pending > 0 && !anyPlayable(c) },
  { id: 'roulette', title: 'tut.nm.roulette.t', text: 'tut.nm.roulette', when: c => asked(c, 'color', 'roulette') },
  { id: 'color', title: 'tut.color.t', text: 'tut.color', when: c => asked(c, 'color') },
  { id: 'seven', title: 'tut.nm.seven.t', text: 'tut.nm.seven', when: c => asked(c, 'player', 'swap') },
  { id: 'danger', title: 'tut.nm.danger.t', text: 'tut.nm.danger', n: () => MERCY_LIMIT, when: c => nm(c) && c.game.s.rules.mercy && !c.locked && !me(c).out && me(c).hand.length >= DANGER },
  { id: 'uno', title: 'tut.uno.t', text: 'tut.uno', when: c => playing(c) && me(c).hand.length === 2 && anyPlayable(c) && !c.game.s.unoCalled },
  { id: 'drawn', title: 'tut.drawn.t', text: 'tut.drawn', when: c => !nm(c) && playing(c) && c.game.s.drawn && anyPlayable(c) },
  { id: 'drawn', title: 'tut.drawn.t', text: 'tut.nm.drawn', when: c => nm(c) && playing(c) && c.game.s.drawn && anyPlayable(c) },
  { id: 'draw', title: 'tut.draw.t', text: 'tut.draw', when: c => !nm(c) && noPenalty(c) && !anyPlayable(c) },
  { id: 'draw', title: 'tut.draw.t', text: 'tut.nm.draw', when: c => nm(c) && noPenalty(c) && !anyPlayable(c) },
  { id: 'play', title: 'tut.play.t', text: 'tut.play', when: c => noPenalty(c) && anyPlayable(c) },
  { id: 'action', title: 'tut.action.t', text: 'tut.action', when: c => noPenalty(c) && holds(c, ACTIONS) },
  { id: 'wild', title: 'tut.wild.t', text: 'tut.wild', when: c => noPenalty(c) && holds(c, WILDS) },
  { id: 'nmDraws', title: 'tut.nm.draws.t', text: 'tut.nm.draws', when: c => noPenalty(c) && holds(c, NM_DRAWS) },
  { id: 'nmSpecial', title: 'tut.nm.special.t', text: 'tut.nm.special', when: c => noPenalty(c) && holds(c, NM_SPECIAL) },
  { id: 'sevenZero', title: 'tut.nm.sevenZero.t', text: 'tut.nm.sevenZero', when: c => noPenalty(c) && c.game.s.rules.sevenZero && me(c).hand.some(card => card.type === 'num' && (card.value === 7 || card.value === 0)) },
];
