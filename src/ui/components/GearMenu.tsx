import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { haptics } from '../../audio/haptics';
import { sound } from '../../audio/sound';
import { useT } from '../../i18n';
import { IconGear, IconMenu, IconMusic, IconSound, IconVibrate } from './Icons';
import { LangSwitch } from './LangSwitch';
import './GearMenu.css';

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
      <button className={`btn glass icon-btn ${className.includes('labeled-menu') ? 'labeled' : ''} ${open ? 'on' : ''}`} aria-expanded={open} aria-label={label} title={label} onClick={() => setOpen(o => !o)}>
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

/** One setting row: icon, name, and the switch at the right edge. */
function Toggle({ id, icon, label, on, set }: { id: string; icon: ReactNode; label: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className={`menu-toggle ${on ? 'is-on' : ''}`} htmlFor={id}>
      <span className="menu-ico">{icon}</span>
      <span className="menu-label">{label}</span>
      <input id={id} type="checkbox" checked={on} onChange={e => set(e.target.checked)} />
      <span className="sw" aria-hidden />
    </label>
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
      <Toggle id="snd-music" icon={<IconMusic />} label={t('sound.music')} on={music} set={v => sound.setMusic(v)} />
      <Toggle id="snd-sfx" icon={<IconSound />} label={t('sound.sfx')} on={sfx} set={v => sound.setSfx(v)} />
      {/* phones only: a light tap on your turn, harder for a penalty and for "UNO!" */}
      {haptics.supported && (
        <Toggle id="snd-haptics" icon={<IconVibrate />} label={t('sound.haptics')} on={buzz} set={v => { haptics.set(v); setBuzz(v); }} />
      )}
    </>
  );
}

export interface GearItem {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  /** leaving the table: drawn apart, in red */
  danger?: boolean;
}

/**
 * The table's menu: sound settings on top, then the table's other actions.
 * On a phone it hides behind a round gold gear; on a computer it is the "Menu" button.
 */
export function GearMenu({ items, labeled }: { items: GearItem[]; labeled?: boolean }) {
  const t = useT();
  const icon = labeled ? <><IconMenu /><span>{t('ov.menu')}</span></> : <IconGear />;
  return (
    <Popover icon={icon} label={t('ov.settings')} className={`gear-menu ${labeled ? 'labeled-menu' : ''}`}>
      {close => (
        <>
          <div className="menu-head">{t('ov.settings')}</div>
          {/* two columns on a short phone screen, one under the other elsewhere */}
          <div className="menu-cols">
            <div className="menu-col">
              <div className="menu-sec">{t('sound.aria')}</div>
              <div className="menu-card">
                <SoundSwitches />
              </div>
            </div>
            <div className="menu-col">
              <div className="menu-sec">{t('lang.label')}</div>
              <div className="menu-card menu-lang-card">
                <LangSwitch className="menu-langs" />
              </div>
              <div className="menu-card menu-actions">
                {items.map(it => (
                  <button key={it.label} type="button" className={`gear-item ${it.danger ? 'danger' : ''}`} onClick={() => { close(); it.onClick(); }}>
                    <span className="menu-ico">{it.icon}</span><span className="menu-label">{it.label}</span>
                    <svg className="menu-chev" viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </Popover>
  );
}
