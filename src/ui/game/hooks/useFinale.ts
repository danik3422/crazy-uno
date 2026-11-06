import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { GameView } from '../../../game/view';
import { vanBusy } from '../../../three/van/vanBusy';

/** the van has this long to show up once the round is over (it starts on the next frame) */
const START_MS = 1500;
/** and never holds the finale longer than this (a hidden tab draws no frames, so the van never leaves) */
const MAX_HOLD_MS = 20_000;

/**
 * Whether the round's finale (podium, confetti, the camera's lap, the fanfare, the results) may play.
 * A round that ends because someone was knocked out (No Mercy, the winner still holds cards) waits for the van
 * to take them away first; any other round's finale starts the moment it is over.
 */
export function useFinale(game: GameView): boolean {
  const s = game.s;
  const over = s.phase === 'over';
  const knockedOut = over && s.winner !== null && s.players[s.winner].hand.length > 0;
  const busy = useSyncExternalStore(vanBusy.subscribe, vanBusy.get);
  // which round's finale was let go, and whether its van was seen on the way
  const key = `${s.round}`;
  const [released, setReleased] = useState<string | null>(null);
  const saw = useRef<{ key: string; van: boolean }>({ key: '', van: false });

  useEffect(() => {
    if (!knockedOut || released === key) return;
    if (saw.current.key !== key) saw.current = { key, van: false };
    if (busy) saw.current.van = true;
    else if (saw.current.van) return setReleased(key);
    const t = setTimeout(() => setReleased(key), saw.current.van ? MAX_HOLD_MS : START_MS);
    return () => clearTimeout(t);
  }, [knockedOut, busy, key, released]);

  return over && (!knockedOut || released === key);
}
