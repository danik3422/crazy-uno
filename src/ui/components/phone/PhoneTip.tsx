import { useState } from 'react';
import { useT } from '../../../i18n';
import { canFullscreen, enterFullscreen, isIOS, usePhone } from '../../hooks/phone';
import { FullscreenIcon, PhoneSideIcon } from './phoneIcons';
import './PhoneTip.css';

/**
 * Before the game, in the menu and the room: one line that tells phone players how the game is meant to be held,
 * with a button that does it (where the browser can).
 */
export function PhoneTip() {
  const t = useT();
  const { phone, fullscreen } = usePhone();
  const [hidden, setHidden] = useState(false);
  if (!phone || fullscreen || hidden) return null;
  const fs = canFullscreen();
  return (
    <div className="phone-tip" role="note">
      <span className="pt-icon" aria-hidden><PhoneSideIcon /></span>
      <span className="pt-text">
        <b>{fs ? t('tip.titleFs') : t('tip.title')}</b>
        <small>{fs ? t('tip.fs') : isIOS() ? t('tip.ios') : t('tip.turn')}</small>
      </span>
      {fs && (
        <button type="button" className="pt-btn" onClick={() => void enterFullscreen()} aria-label={t('fs.btn')} title={t('fs.btn')}>
          <FullscreenIcon />
        </button>
      )}
      <button type="button" className="pt-close" onClick={() => setHidden(true)} aria-label={t('tip.hide')}>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
