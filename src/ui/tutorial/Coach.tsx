import { useEffect, useRef, useState } from 'react';
import type { GameView } from '../../game/view';
import { useT } from '../../i18n';
import { markTutorialDone, TIPS, type Tip, type TipContext, type TutorialMode } from './tutorial';
import './Coach.css';

/** a tip that stops being true closes by itself, but not before it could be read */
const MIN_SHOW_MS = 1500;

/**
 * The hints of the first game: one bubble at a time at the top of the screen, at the moment it is needed.
 * "Got it" closes it; "Skip the tutorial" closes every hint for good.
 */
export function Coach({ game, version, locked }: { game: GameView; version: number; locked: boolean }) {
  const t = useT();
  const shown = useRef(new Set<string>());
  const [tip, setTip] = useState<Tip | null>(null);
  const since = useRef(0);
  // the number in the text, as it was when the tip came up (a penalty taken drops it to 0)
  const [n, setN] = useState<number | undefined>();
  const [off, setOff] = useState(false);
  const mode: TutorialMode = game.s.rules.noMercy ? 'nomercy' : 'classic';

  useEffect(() => {
    if (off) return;
    // the round is over: the tutorial counts as done, and the podium and the results have the screen to themselves
    if (game.s.phase === 'over') {
      markTutorialDone(mode);
      if (tip) setTip(null);
      return;
    }
    const ctx: TipContext = { game, locked };
    if (tip) {
      // the moment passed (the card was drawn, the turn moved on): it goes, once it had a moment on screen
      if (!tip.when(ctx) && Date.now() - since.current > MIN_SHOW_MS) {
        shown.current.add(tip.id);
        setTip(null);
      }
      return;
    }
    const next = TIPS.find(x => !shown.current.has(x.id) && x.when(ctx));
    if (!next) return;
    since.current = Date.now();
    setN(next.n?.(ctx));
    setTip(next);
  }, [game, version, locked, tip, off, mode]);

  if (off || !tip) return null;
  const close = () => {
    shown.current.add(tip.id);
    setTip(null);
  };
  const skip = () => {
    markTutorialDone(mode);
    setOff(true);
  };
  const vars = n === undefined ? undefined : { n };
  return (
    <div className="coach" role="status" aria-live="polite" key={tip.id}>
      <span className="coach-badge" aria-hidden>?</span>
      <div className="coach-body">
        <b>{t(tip.title, vars)}</b>
        <p>{t(tip.text, vars)}</p>
        <div className="coach-btns">
          <button type="button" className="btn coach-ok" onClick={close}>{t('tut.ok')}</button>
          <button type="button" className="coach-skip" onClick={skip}>{t('tut.skip')}</button>
        </div>
      </div>
    </div>
  );
}
