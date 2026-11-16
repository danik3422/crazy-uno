import { useEffect } from 'react';
import type { Player } from '../../game/types';
import { useT } from '../../i18n';
import { AvatarImg } from '../components/AvatarImg';
import './ChallengePick.css';

interface Props {
  /** who laid the +4 */
  by: Player;
  /** cards waiting for you now (4, or more when penalties were stacked) */
  pending: number;
  /** you hold a card that can answer the +4 (accepting then lets you play it) */
  canAnswer: boolean;
  onAccept: () => void;
  onChallenge: () => void;
}

/**
 * Someone laid a +4 on you: accept it, or call the bluff. Two equal columns, each a quiet tile saying what the
 * choice costs (a sure +N; or "they take 4" on a bluff against "you take N+2" on a fair +4) above the game's own
 * blue and red buttons. Keys 1 and 2 pick too; nothing is focused up front, so neither looks chosen already.
 */
export function ChallengePick({ by, pending, canAnswer, onAccept, onChallenge }: Props) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '1') { e.preventDefault(); onAccept(); }
      if (e.key === '2') { e.preventDefault(); onChallenge(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAccept, onChallenge]);

  return (
    <div className="chal" role="dialog" aria-label={t('ov.challenge')}>
      <p className="chal-who">
        <AvatarImg id={by.avatar} name={by.name} bot={by.bot} size={26} className="chal-ava" />
        <span className="chal-name">{t('ov.laid4', { who: by.name })}</span>
      </p>
      <h2 className="chal-title">{t('ov.challenge')}</h2>

      <div className="chal-opts">
        <div className="chal-opt">
          <div className="chal-info">
            <span className="chal-big">+{pending}</span>
            <span className="chal-sub">{canAnswer ? t('ov.chAnswer', { n: pending }) : t('ov.chSafe')}</span>
          </div>
          <button type="button" className="btn big blue" onClick={onAccept}>
            {canAnswer ? t('ov.accept') : t('ov.acceptTake', { n: pending })}
            <kbd aria-hidden>1</kbd>
          </button>
        </div>
        <div className="chal-opt">
          <div className="chal-info chal-odds">
            <span className="good">{t('ov.chWin', { who: by.name })}</span>
            <span className="bad">{t('ov.chLose', { n: pending + 2 })}</span>
          </div>
          <button type="button" className="btn big red" onClick={onChallenge}>
            {t('ov.challengeBtn')}
            <kbd aria-hidden>2</kbd>
          </button>
        </div>
      </div>

      <p className="chal-rule">{t('ov.chRule')}</p>
    </div>
  );
}
