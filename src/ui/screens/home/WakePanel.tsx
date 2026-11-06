import { useEffect, useRef, useState } from 'react';
import type { ServerStatus } from '../../../app/hooks/useServerCheck';
import { useT } from '../../../i18n';
import './WakePanel.css';

/** a sleeping server usually takes about this long to wake (the progress bar is an estimate) */
const WAKE_MS = 50_000;
/** how long "ready!" stays after it woke up */
const READY_MS = 2600;

/**
 * While the free host wakes the server up: what is going on, about how long it takes, and that bots are playable now.
 * When it is up, a short "ready!" and it folds away; if it never answers, an honest message and "try again".
 */
export function WakePanel({ server }: { server: ServerStatus }) {
  const t = useT();
  const [now, setNow] = useState(Date.now());
  const [ready, setReady] = useState(false);
  const was = useRef(server.state);
  useEffect(() => {
    if (server.state !== 'waking') return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [server.state]);
  // it just woke up: say so for a moment
  useEffect(() => {
    const prev = was.current;
    was.current = server.state;
    if (server.state === 'up' && (prev === 'waking' || prev === 'down')) {
      setReady(true);
      const id = setTimeout(() => setReady(false), READY_MS);
      return () => clearTimeout(id);
    }
  }, [server.state]);

  if (ready) return <div className="wake ready" role="status"><span className="wake-ok" aria-hidden>✓</span>{t('wake.ready')}</div>;
  if (server.state !== 'waking' && server.state !== 'down') return null;
  if (server.state === 'down') {
    return (
      <div className="wake down" role="status">
        <b>{t('wake.downTitle')}</b>
        <small>{t('wake.downText')}</small>
        <button type="button" className="btn wake-retry" onClick={server.retry}>{t('wake.retry')}</button>
      </div>
    );
  }
  const secs = Math.max(0, Math.round((now - server.since) / 1000));
  const pct = Math.min(95, ((now - server.since) / WAKE_MS) * 100);
  return (
    <div className="wake" role="status" aria-live="polite">
      <div className="wake-head">
        <span className="wake-zz" aria-hidden><i>z</i><i>z</i><i>z</i></span>
        <b>{t('wake.title')}</b>
        <em>{t('wake.secs', { n: secs })}</em>
      </div>
      <div className="wake-bar" aria-hidden><span style={{ width: `${pct}%` }} /></div>
      <small>{t('wake.text')}</small>
    </div>
  );
}
