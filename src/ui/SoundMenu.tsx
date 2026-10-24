import { useState, useSyncExternalStore } from 'react';
import { sound } from '../audio/sound';

/** Speaker button with two switches: music and sound effects. */
export function SoundMenu() {
  useSyncExternalStore(sound.subscribe, sound.getVersion);
  const [open, setOpen] = useState(false);
  const { sfx, music } = sound.prefs;
  const icon = !sfx && !music ? '🔇' : music ? '🎵' : '🔊';
  return (
    <div className="sound-menu">
      <button className="btn glass" aria-expanded={open} aria-label="Звук" onClick={() => setOpen(o => !o)}>
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
