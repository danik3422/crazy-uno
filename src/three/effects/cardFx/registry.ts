import type { CardType } from '../../../game/types';
import type { Motif } from './kit';
import { bomb } from './motifs/bomb';
import { dare } from './motifs/dare';
import { discardAll, dump } from './motifs/discard';
import { gift } from './motifs/gift';
import { handPass } from './motifs/handPass';
import { mirror } from './motifs/mirror';
import { penalty } from './motifs/penalty';
import { rain } from './motifs/rain';
import { reverse } from './motifs/reverse';
import { roulette } from './motifs/roulette';
import { skip } from './motifs/skip';
import { skipAll } from './motifs/skipAll';
import { swap } from './motifs/swap';
import { chaos, wild, wildDraw, wildRev4 } from './motifs/wild';

/** Which animation each card plays. Number cards only get one under the 7–0 rule (see motifFor). */
const MOTIFS: Record<Exclude<CardType, 'num'>, Motif> = {
  skip,
  rev: reverse,
  draw2: penalty,
  wild,
  wild4: wildDraw,
  swap,
  gift,
  bomb,
  dare,
  rain,
  mirror,
  chaos,
  dump,
  draw4: penalty,
  skipAll,
  discardAll,
  wildRev4,
  wild6: wildDraw,
  wild10: wildDraw,
  roulette,
};

export function motifFor(type: CardType, value?: number): Motif | null {
  if (type === 'num') return value === 0 ? handPass : value === 7 ? swap : null;
  return MOTIFS[type];
}

/** cards whose badge (their emblem) the effect shows */
export const HAS_BADGE: CardType[] = ['skip', 'rev', 'swap', 'skipAll', 'discardAll', 'mirror', 'num'];
