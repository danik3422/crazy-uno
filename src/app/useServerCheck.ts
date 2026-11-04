import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * - checking: the first moment (a server that is awake answers well within it)
 * - waking: no answer yet; the free host puts the server to sleep after 15 quiet minutes and takes up to a minute to wake it
 * - up: online play is ready
 * - down: no answer for a long while (still retried quietly in the background)
 * - none: no game server behind this page at all (opened as a file or from a plain static host)
 * - offline: the device has no internet
 */
export type ServerState = 'checking' | 'waking' | 'up' | 'down' | 'none' | 'offline';

export interface ServerStatus {
  state: ServerState;
  /** when the wait started (ms), for the progress shown while it wakes */
  since: number;
  /** ask again right now (the "try again" button) */
  retry: () => void;
}

/** an awake server answers well within this; after it the screen says the server is waking up */
const QUICK_MS = 2000;
/** one attempt: the host holds the first request while it wakes, so give it time */
const ATTEMPT_MS = 9000;
/** between attempts while waking */
const GAP_MS = 1500;
/** after this long without an answer it is "down" (but still tried every SLOW_MS) */
const GIVE_UP_MS = 90_000;
const SLOW_MS = 15_000;

/**
 * Is there a game server behind this page, and is it awake? The very first request is also what wakes it,
 * so this starts the moment the home screen opens, while the player is still typing a name.
 */
export function useServerCheck(): ServerStatus {
  const [state, setState] = useState<ServerState>('checking');
  const since = useRef(Date.now());
  const [kick, setKick] = useState(0);
  const retry = useCallback(() => {
    since.current = Date.now();
    setState('checking');
    setKick(k => k + 1);
  }, []);

  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return setState('none');
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let ctrl: AbortController | null = null;
    const start = since.current;
    // past the first moment without an answer: say it is waking up
    const slow = setTimeout(() => { if (!stop) setState(s => (s === 'checking' ? 'waking' : s)); }, QUICK_MS);

    const attempt = async () => {
      if (stop) return;
      if (navigator.onLine === false) {
        setState('offline');
        return;
      }
      ctrl = new AbortController();
      const t = setTimeout(() => ctrl?.abort(), ATTEMPT_MS);
      let verdict: 'up' | 'none' | 'again' = 'again';
      try {
        const r = await fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' });
        if (r.ok) {
          const j = await r.json().catch(() => null);
          // something answered, but not our server (a static host): no online play here
          verdict = j?.ok ? 'up' : 'none';
        } else if (r.status === 404) verdict = 'none';
        // 502 / 503 / 504: the host is still starting the server
      } catch {
        // no answer in time, or the connection dropped while it starts: try again
      } finally {
        clearTimeout(t);
      }
      if (stop) return;
      if (verdict === 'up') return setState('up');
      if (verdict === 'none') return setState('none');
      const waited = Date.now() - start;
      if (waited > GIVE_UP_MS) setState('down');
      else setState(s => (s === 'checking' && waited < QUICK_MS ? s : 'waking'));
      timer = setTimeout(attempt, waited > GIVE_UP_MS ? SLOW_MS : GAP_MS);
    };
    void attempt();

    // the internet came back: start over
    const back = () => retry();
    window.addEventListener('online', back);
    return () => {
      stop = true;
      clearTimeout(timer);
      clearTimeout(slow);
      ctrl?.abort();
      window.removeEventListener('online', back);
    };
  }, [kick, retry]);

  return { state, since: since.current, retry };
}
