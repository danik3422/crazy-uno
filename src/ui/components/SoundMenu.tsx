import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { haptics } from '../../audio/haptics';
import { sound } from '../../audio/sound';
import { useT } from '../../i18n';
import { IconGear, IconMusic, IconMute, IconSound } from './Icons';
import './SoundMenu.css';

/** A button with a small panel under it. A tap anywhere else, or Escape, closes it. */
function Popover({ icon, label, className = '', children }: { icon: ReactNode; label: string; className?: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
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
  return (
    <div className={`sound-menu ${className}`} ref={root}>
      <button className={`btn glass icon-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(o => !o)}>
        {icon}
      </button>
      {open && (
        <div className="sound-pop" role="group" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

/** Music, sound effects and (phones) vibration switches. */
function SoundSwitches() {
  const t = useT();
  useSyncExternalStore(sound.subscribe, sound.getVersion);
  const [buzz, setBuzz] = useState(haptics.on);
  const { sfx, music } = sound.prefs;
  return (
    <>
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
    </>
  );
}

/** Speaker button with the sound switches. */
export function SoundMenu() {
  const t = useT();
  useSyncExternalStore(sound.subscribe, sound.getVersion);
  const { sfx, music } = sound.prefs;
  const icon = !sfx && !music ? <IconMute /> : music ? <IconMusic /> : <IconSound />;
  return <Popover icon={icon} label={t('sound.aria')}>{() => <SoundSwitches />}</Popover>;
}

export interface GearItem {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

/** Phones: one gear button holding the sound switches and the table's other buttons, so the screen stays clear. */
export function GearMenu({ items }: { items: GearItem[] }) {
  const t = useT();
  return (
    <Popover icon={<IconGear />} label={t('ov.settings')} className="gear-menu">
      {close => (
        <>
          <SoundSwitches />
          <div className="gear-sep" aria-hidden />
          {items.map(it => (
            <button key={it.label} type="button" className="gear-item" onClick={() => { close(); it.onClick(); }}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </>
      )}
    </Popover>
  );
}
