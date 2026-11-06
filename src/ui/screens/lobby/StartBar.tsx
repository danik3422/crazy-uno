import { useEffect, useRef, useState } from 'react';
import { useT } from '../../../i18n';
import { enterFullscreen } from '../../hooks/phone';
import './StartBar.css';

/** The host's start button. Sticks to the bottom of the screen when the page is long (rules open, phones). */
export function StartBar({ canStart, hint, onStart }: { canStart: boolean; hint: string | null; onStart: () => void }) {
  const t = useT();
  const bar = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = bar.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // the bar sits at bottom: -1px, so while it is stuck one pixel of it is out of view
    const io = new IntersectionObserver(([e]) => setStuck(e.intersectionRatio < 1), { threshold: [1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={bar} className={`lb-start ${stuck ? 'stuck' : ''}`}>
      {!canStart && hint && <p className="lb-start-hint">{hint}</p>}
      <button className="btn big start-btn" disabled={!canStart} onClick={() => { void enterFullscreen(); onStart(); }}>{t('lobby.start')}</button>
    </div>
  );
}

/** What a guest sees instead of the start button. */
export function WaitingForHost({ hostName }: { hostName: string }) {
  const t = useT();
  return (
    <p className="lb-waiting">
      <span className="lb-dot" aria-hidden />
      {t('lobby.waiting', { name: hostName })}
    </p>
  );
}
