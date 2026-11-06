import { standIn } from '../../../game/avatars';
import type { Card } from '../../../game/types';
import type { GameView } from '../../../game/view';
import { render, type useT } from '../../../i18n';

type Tr = ReturnType<typeof useT>;

export interface HintContext {
  game: GameView;
  /** the round is still being dealt */
  locked: boolean;
  /** it is this viewer's turn to play a card */
  playing: boolean;
  /** this viewer holds something playable */
  anyPlay: boolean;
  /** Jump-In: a card exactly like the top one, while someone else is moving */
  jumpCard: Card | undefined;
  spectator: boolean;
}

/**
 * The line by the player's plate: what to do now (your turn, stack or take, call a colour…) or who is
 * doing what. "Title|second line" splits into a big title and a quiet line under it.
 */
export function turnHint(t: Tr, { game, locked, playing, anyPlay, jumpCard, spectator }: HintContext): string {
  const s = game.s;
  const me = s.players[game.seat()];
  const cur = game.cp();
  const myTurn = game.viewer() !== null && game.viewer() === s.cur;
  if (locked) return t('hud.dealing');
  if (s.phase === 'over') return '';
  if (myTurn && s.phase === 'choose' && s.choice?.kind === 'card') return t('hud.giftPick');
  if (playing && s.blindTurns > 0) return t('hud.blind');
  if (me.out) return t('hud.out');
  if (playing && s.pending > 0 && s.rules.noMercy) return anyPlay ? t('hud.nmStack', { last: s.pendingLast, n: s.pending }) : t('hud.nmNoStack', { n: s.pending });
  if (playing && s.pending > 0) return anyPlay ? t('hud.stack', { n: s.pending }) : t('hud.noStack', { n: s.pending });
  if (playing && s.drawn) return s.rules.noMercy ? t('hud.drawnNm') : t('hud.drawn');
  if (playing) return anyPlay ? t('hud.yourTurn') : t('hud.nothing');
  if (jumpCard) return t('hud.jumpIn');
  if (spectator) return t('hud.spectator', { who: cur.name });
  if (s.phase === 'dare') return t('hud.dare', { who: cur.name, dare: render(s.dare) });
  if (s.phase === 'coin') return t('hud.coin', { who: cur.name });
  // your own choice (a colour, a player): its question; someone else's: they are thinking
  if (s.phase === 'choose') return myTurn && s.choice ? render(s.choice.title) : t('hud.thinking', { who: cur.name });
  if (s.phase !== 'handover') return cur.offline ? t('hud.standIn', { bot: standIn(cur.name).name, who: cur.name }) : t('hud.turnOf', { who: cur.name });
  return '';
}
