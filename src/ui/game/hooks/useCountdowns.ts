import { useEffect, useState } from 'react';
import { sound } from '../../../audio/sound';
import type { Game } from '../../../game/engine/Game';
import type { GameView } from '../../../game/view';

const CLOCK_TICK_MS = 100;
/** the last seconds of your own clock tick audibly */
const TICK_FROM_SEC = 5;

/**
 * Countdowns on screen: the bomb / blitz timer and the round limit, in whole seconds.
 * The server times them online; for a local game the engine's clocks are checked here too.
 */
export function useCountdowns(game: GameView, local: Game | null) {
  const [now, setNow] = useState(Date.now());
  const deadline = game.s.bombDeadline;
  const turnDeadline = game.s.turnDeadline;
  const endsAt = game.s.phase === 'over' ? null : game.s.endsAt;
  useEffect(() => {
    if (deadline === null && turnDeadline === null && endsAt === null) return;
    let lastTick = -1;
    const t = setInterval(() => {
      setNow(Date.now());
      local?.checkBomb();
      local?.timeoutTurn();
      local?.checkTimeLimit();
      // tick through the last seconds of my own clock
      const dl = game.s.bombDeadline ?? game.s.turnDeadline;
      if (dl !== null && game.viewer() !== null && game.viewer() === game.s.cur) {
        const left = Math.ceil((dl - Date.now() - game.clockOffset) / 1000);
        if (left <= TICK_FROM_SEC && left > 0 && left !== lastTick) {
          lastTick = left;
          sound.play(game.s.bombDeadline !== null ? 'bombTick' : left <= 2 ? 'hurry' : 'tick');
        }
      }
    }, CLOCK_TICK_MS);
    return () => clearInterval(t);
  }, [game, local, deadline, turnDeadline, endsAt]);

  const secondsLeft = (until: number) => Math.max(0, Math.ceil((until - now - game.clockOffset) / 1000));
  return {
    /** bomb or blitz countdown; 0 when none is running */
    bombLeft: deadline === null ? 0 : secondsLeft(deadline),
    /** seconds left in a timed round; null when the round has no limit */
    roundLeft: endsAt === null ? null : secondsLeft(endsAt),
  };
}
