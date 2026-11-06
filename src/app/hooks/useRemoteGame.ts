import { useRef } from 'react';
import type { Connection } from '../../net/connection';
import { RemoteGame } from '../../net/remoteGame';

/**
 * The online game as this client sees it: one RemoteGame per round.
 * Updates within a round keep its identity (and so its queue of effects still to show).
 * Runs during render, so the screen and the latest server view never disagree.
 */
export function useRemoteGame(conn: Connection) {
  const remote = useRef<RemoteGame | null>(null);
  const view = conn.view;
  if (!view) remote.current = null;
  else if (!remote.current || remote.current.s.round !== view.state.round) {
    // the opening effects play only if we saw the round from its start (not after a reload mid-round)
    const fresh = !!remote.current || view.state.turn <= 1;
    remote.current = new RemoteGame(conn, view, conn.viewNow, fresh);
  } else if (remote.current.src !== view) remote.current.apply(view, conn.viewNow);
  return remote;
}
