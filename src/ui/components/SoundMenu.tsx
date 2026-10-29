import { useState, useSyncExternalStore } from 'react';
import { sound } from '../../audio/sound';
import { IconMusic, IconMute, IconSound } from './Icons';
import './SoundMenu.css';

/** Speaker button with two switches: music and sound effects. */
export function SoundMenu() {
  useSyncExternalStore(sound.subscribe, sound.getVersion);
  const [open, setOpen] = useState(false);
  const { sfx, music } = sound.prefs;
  const icon = !sfx && !music ? <IconMute /> : music ? <IconMusic /> : <IconSound />;
  return (
    <div className="sound-menu">
      <button className={`btn glass icon-btn ${open ? 'on' : ''}`} aria-expanded={open} aria-label="Звук" title="Звук" onClick={() => setOpen(o => !o)}>
        {icon}
      </button>
      {open && (
        <div className="sound-pop" role="group" aria-label="Звук">
          <label className="switch">
            <input id="snd-music" type="checkbox" checked={music} onChange={e => sound.setMusic(e.target.checked)} />
            <span className="sw" aria-hidden />
            Музыка
          </label>
          <label className="switch">
            <input id="snd-sfx" type="checkbox" checked={sfx} onChange={e => sound.setSfx(e.target.checked)} />
            <span className="sw" aria-hidden />
            Звуки
          </label>
        </div>
      )}
    </div>
  );
}
