import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';
import { canFullscreen, enterFullscreen, isIOS, usePhone } from '../hooks/phone';
import './RotateGate.css';

/** A phone outline that turns on its side, with the table glowing on its screen. */
function PhoneTurn() {
  return (
    <svg className="rg-phone" viewBox="0 0 120 120" width="120" height="120" aria-hidden>
      <g className="rg-turn">
        <rect x="38" y="14" width="44" height="92" rx="9" fill="rgba(255,255,255,0.08)" stroke="#fff" strokeWidth="4" />
        <rect x="44" y="24" width="32" height="70" rx="3" fill="url(#rg-felt)" />
        <rect x="53" y="52" width="9" height="13" rx="2" fill="#e5413a" stroke="#fff" strokeWidth="1.5" transform="rotate(-12 57 58)" />
        <rect x="59" y="51" width="9" height="13" rx="2" fill="#ffc61a" stroke="#fff" strokeWidth="1.5" transform="rotate(10 63 57)" />
        <circle cx="60" cy="99" r="2.6" fill="#fff" />
      </g>
      <path className="rg-arrow" d="M96 30 A44 44 0 0 1 104 74" fill="none" stroke="#ffd84a" strokeWidth="5" strokeLinecap="round" />
      <path className="rg-arrow" d="M96 66 L104 76 L110 64" fill="none" stroke="#ffd84a" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <radialGradient id="rg-felt">
          <stop offset="0" stopColor="#3fd07a" />
          <stop offset="1" stopColor="#0b6b3a" />
        </radialGradient>
      </defs>
    </svg>
  );
}

/**
 * On a phone the table is played lying on its side. Held upright, the game is covered by this screen:
 * turn the phone, and (where the browser can) open it full screen, which on Android also turns it for you.
 */
export function RotateGate({ waiting = false }: { waiting?: boolean }) {
  const t = useT();
  const { phone, portrait, fullscreen } = usePhone();
  const on = phone && portrait;
  // the page behind takes the gate's colour too: on an iPhone home-screen app the strip under the
  // home indicator shows the page background, not a fixed layer
  useEffect(() => {
    if (!on) return;
    document.documentElement.classList.add('gate-on');
    return () => document.documentElement.classList.remove('gate-on');
  }, [on]);
  if (!on) return null;
  const fs = canFullscreen() && !fullscreen;
  // straight into <body>: no game container (overflow, transforms) can cut it short
  return createPortal(
    <div className="rotate-gate" role="dialog" aria-modal="true" aria-labelledby="rg-title">
      <PhoneTurn />
      <h2 id="rg-title">{t('rotate.title')}</h2>
      <p>{waiting ? t('rotate.waiting') : t('rotate.why')}</p>
      {fs && (
        <button type="button" className="btn big rg-btn" onClick={() => void enterFullscreen()}>
          <FullscreenIcon /> {t('rotate.fs')}
        </button>
      )}
      {!fs && !fullscreen && isIOS() && (
        <p className="rg-ios">
          {t('rotate.ios').split('{icon}')[0]}<ShareIcon />{t('rotate.ios').split('{icon}')[1]}
        </p>
      )}
    </div>,
    document.body,
  );
}

/** Lying on its side but still inside the browser bars: a small button in the corner to go full screen. */
export function FullscreenButton() {
  const t = useT();
  const { phone, portrait, fullscreen } = usePhone();
  if (!phone || portrait || fullscreen || !canFullscreen()) return null;
  return (
    <button type="button" className="btn glass icon-btn fs-btn" onClick={() => void enterFullscreen()} title={t('fs.btn')} aria-label={t('fs.btn')}>
      <FullscreenIcon />
    </button>
  );
}

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

/** a phone lying on its side */
function PhoneSideIcon() {
  return (
    <svg viewBox="0 0 32 24" width="30" height="22" aria-hidden>
      <rect x="2" y="3" width="28" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="6" y="6.5" width="20" height="11" rx="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="28" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden style={{ verticalAlign: '-2px' }}>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
