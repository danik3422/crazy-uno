import { useEffect, useRef } from 'react';
import { haptics } from '../../audio/haptics';
import { type Sfx, sound } from '../../audio/sound';
import type { Card, CardType } from '../../game/types';
import type { GameView } from '../../game/view';

interface Snapshot {
  game: GameView | null;
  discard: number;
  hands: number;
  /** cards in the hand of the person at this screen */
  mine: number;
  cur: number;
  round: number;
  /** a colour is being picked for a wild card */
  picking: boolean;
}

/** How many cards a draw card costs (0: not a draw card). */
const DRAWS: Partial<Record<CardType, number>> = { draw2: 2, wild4: 4, draw4: 4, wildRev4: 4, wild6: 6, wild10: 10 };

/** The extra sound an action card makes on top of the card being laid. */
function actionSound(c: Card): [Sfx, number] | null {
  const draws = DRAWS[c.type];
  if (draws) return ['stack', draws];
  if (c.type === 'skip' || c.type === 'skipAll') return ['skip', 1];
  if (c.type === 'rev') return ['reverse', 1];
  return null;
}

const isWild = (c: Card | undefined) => !!c && c.color === 'wild';

/**
 * The table's palette and music follow its theme; a sound for each card laid (with an extra one for action cards),
 * drawn, a wild colour picked, and "your turn".
 */
export function useTableSounds(game: GameView, version: number) {
  const theme = game.s.theme ?? 'classic';
  useEffect(() => {
    sound.setTheme(theme);
    sound.music(theme);
  }, [theme]);
  // silence when leaving the table
  useEffect(() => () => {
    sound.music(null);
    sound.setTheme(null);
    sound.propeller(0);
  }, []);

  // what changed on the table since the last update
  const prev = useRef<Snapshot>({ game: null, discard: 0, hands: 0, mine: 0, cur: -1, round: 0, picking: false });
  useEffect(() => {
    const s = game.s;
    const hands = s.players.reduce((a, p) => a + p.hand.length, 0);
    const p = prev.current;
    const picking = s.phase === 'choose' && s.choice?.kind === 'color';
    if (p.game === game && p.round === s.round) {
      const top = s.discard[s.discard.length - 1];
      if (s.discard.length > p.discard) {
        sound.play('card');
        const extra = top && actionSound(top);
        if (extra) sound.play(extra[0], extra[1]);
        // a bot picks its colour straight away; a person picks it on the colour wheel, heard when it closes
        if (isWild(top) && !picking) sound.play('wild');
      } else if (p.picking && !picking && isWild(top)) {
        sound.play('wild');
      }
      const drawn = hands - p.hands + (s.discard.length - p.discard);
      if (drawn > 0) sound.play('draw', drawn);
      const v = game.viewer();
      if (s.cur !== p.cur && v !== null && v === s.cur && s.phase !== 'over') {
        sound.play('turn');
        haptics.play('turn');
      }
      // a phone buzzes harder the more cards its owner is made to take at once (+2, +4 … +10)
      if (v !== null) {
        const mine = s.players[v]?.hand.length ?? 0;
        const got = mine - p.mine;
        if (got >= 4) haptics.play('heavy');
        else if (got >= 2 && s.discard.length === p.discard) haptics.play('medium');
      }
    }
    const v0 = game.viewer();
    prev.current = { game, discard: s.discard.length, hands, mine: v0 === null ? 0 : (s.players[v0]?.hand.length ?? 0), cur: s.cur, round: s.round, picking };
  }, [game, version]);
}
