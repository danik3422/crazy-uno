import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { haptics } from '../../audio/haptics';
import { sound } from '../../audio/sound';
import { useT } from '../../i18n';
import { IconMusic, IconMute, IconSound } from './Icons';
import './SoundMenu.css';

/** Speaker button with two switches (music and sound effects). A tap anywhere else, or Escape, closes it. */
export function SoundMenu() {
  const t = useT();
  useSyncExternalStore(sound.subscribe, sound.getVersion);
  const [open, setOpen] = useState(false);
  const [buzz, setBuzz] = useState(haptics.on);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    // capture: the 3D table stops some events, the menu must still hear about them
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  const { sfx, music } = sound.prefs;
  const icon = !sfx && !music ? <IconMute /> : music ? <IconMusic /> : <IconSound />;
  return (
    <div className="sound-menu" ref={root}>
      <button className={`btn glass icon-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-label={t('sound.aria')} title={t('sound.aria')} onClick={() => setOpen(o => !o)}>
        {icon}
      </button>
      {open && (
        <div className="sound-pop" role="group" aria-label={t('sound.aria')}>
          <label className="switch">
            <input id="snd-music" type="checkbox" checked={music} onChange={e => sound.setMusic(e.target.checked)} />
            <span className="sw" aria-hidden />
            {t('sound.music')}
          </label>
          <label className="switch">
            <input id="snd-sfx" type="checkbox" checked={sfx} onChange={e => sound.setSfx(e.target.checked)} />
            <span className="sw" aria-hidden />
            {t('sound.sfx')}
          </label>
          {/* phones only: a light tap on your turn, harder for a penalty and for "UNO!" */}
          {haptics.supported && (
            <label className="switch">
              <input id="snd-haptics" type="checkbox" checked={buzz} onChange={e => { haptics.set(e.target.checked); setBuzz(e.target.checked); }} />
              <span className="sw" aria-hidden />
              {t('sound.haptics')}
            </label>
          )}
        </div>
      )}
    </div>
  );
}
