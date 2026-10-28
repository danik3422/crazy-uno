import { useEffect, useRef } from 'react';
import { sound } from '../../audio/sound';
import type { GameView } from '../../game/view';

interface Snapshot {
  game: GameView | null;
  discard: number;
  hands: number;
  cur: number;
  round: number;
}

/** Music that follows the table theme, and a sound for each card laid, drawn, and for "your turn". */
export function useTableSounds(game: GameView, version: number) {
  const theme = game.s.theme ?? 'classic';
  useEffect(() => {
    sound.music(theme);
  }, [theme]);
  // silence when leaving the table
  useEffect(() => () => {
    sound.music(null);
    sound.propeller(0);
  }, []);

  // what changed on the table since the last update
  const prev = useRef<Snapshot>({ game: null, discard: 0, hands: 0, cur: -1, round: 0 });
  useEffect(() => {
    const s = game.s;
    const hands = s.players.reduce((a, p) => a + p.hand.length, 0);
    const p = prev.current;
    if (p.game === game && p.round === s.round) {
      if (s.discard.length > p.discard) sound.play('card');
      const drawn = hands - p.hands + (s.discard.length - p.discard);
      if (drawn > 0) sound.play('draw', drawn);
      const v = game.viewer();
      if (s.cur !== p.cur && v !== null && v === s.cur && s.phase !== 'over') sound.play('turn');
    }
    prev.current = { game, discard: s.discard.length, hands, cur: s.cur, round: s.round };
  }, [game, version]);
}
