import { useEffect, useState } from 'react';
import { sound } from '../../audio/sound';
import type { Achievement } from '../../game/stats';
import { useT } from '../../i18n';
import { Badge } from './Badge';
import { profile } from './store';
import './Profile.css';

/** "Achievement unlocked!" over the table for a few seconds, one card per achievement. */
export function AchievementToasts() {
  const t = useT();
  const [shown, setShown] = useState<{ a: Achievement; key: number }[]>([]);
  useEffect(() => {
    let seq = 0;
    return profile.onUnlock(a => {
      const key = ++seq;
      // a moment after the move that earned it, so it does not drown in the card's own effect
      setTimeout(() => {
        sound.play('jackpot');
        setShown(list => [...list, { a, key }]);
        setTimeout(() => setShown(list => list.filter(x => x.key !== key)), 4100);
      }, 600);
    });
  }, []);
  if (!shown.length) return null;
  return (
    <div className="ach-toasts" aria-live="polite">
      {shown.map(({ a, key }) => (
        <div key={key} className="ach-toast">
          <Badge glyph={a.glyph} tier={a.tier} size={40} />
          <div><small>{t('ach.unlocked')}</small><b>{t(`ach.${a.id}`)}</b></div>
        </div>
      ))}
    </div>
  );
}
