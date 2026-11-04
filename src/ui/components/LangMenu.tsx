import { useEffect, useRef, useState } from 'react';
import { LANGS, setLang, tr, useLang, useT } from '../../i18n';
import './LangMenu.css';

const Globe = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M3 12h18M12 3c2.8 2.6 2.8 15.4 0 18M12 3c-2.8 2.6-2.8 15.4 0 18" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

/**
 * The language picker: a small button with a globe and the current language, opening a list of the languages,
 * each written in itself (so it can be found whatever is showing now). Applies at once, on this screen only.
 * `nav`: drawn as one of the home screen's tabs; `up`: the list opens upwards (the tab bar at the bottom of a phone).
 */
export function LangMenu({ nav, up, className = '' }: { nav?: boolean; up?: boolean; className?: string }) {
  const t = useT();
  const cur = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`lang-menu ${nav ? 'as-nav' : 'as-pill'} ${up ? 'up' : ''} ${className}`} ref={root}>
      <button
        type="button"
        className={`lm-btn ${open ? 'on' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('lang.label')}: ${tr(cur, `lang.name.${cur}`)}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className="lm-ico"><Globe /></span>
        <span className="lm-code">{tr(cur, `lang.${cur}`)}</span>
        {nav && <span className="lm-label">{t('lang.label')}</span>}
      </button>
      {open && (
        <ul className="lm-pop" role="listbox" aria-label={t('lang.label')}>
          {LANGS.map(l => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={cur === l}
                lang={l}
                className={cur === l ? 'on' : ''}
                onClick={() => { setLang(l); setOpen(false); }}
              >
                <span className="lm-chip">{tr(l, `lang.${l}`)}</span>
                <span className="lm-name">{tr(l, `lang.name.${l}`)}</span>
                {cur === l && <span className="lm-check" aria-hidden>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
