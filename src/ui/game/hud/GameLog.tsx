import type { GameView } from '../../../game/view';
import { render } from '../../../i18n';
import { useLogRoom } from '../hooks/useLogRoom';

/** how many log lines show at most */
const LINES = 3;

/** The last few things that happened. When plates sit under it, only the newest lines that fit show (see useLogRoom). */
export function GameLog({ game }: { game: GameView }) {
  const s = game.s;
  const log = useLogRoom(LINES);
  return (
    <div ref={log.ref} className={`log ${log.room < LINES ? 'cramped' : ''}`} aria-live="polite">
      {s.log.slice(-LINES).map((l, i, arr) => (
        <div
          key={s.log.length - LINES + i}
          className={i === arr.length - 1 ? 'new' : ''}
          style={log.room < LINES && arr.length - 1 - i >= log.room ? { visibility: 'hidden' } : undefined}
        >
          {render(l)}
        </div>
      ))}
    </div>
  );
}
