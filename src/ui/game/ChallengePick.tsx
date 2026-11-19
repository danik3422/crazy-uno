import type { Player } from '../../game/types';
import { useT } from '../../i18n';
import { AvatarImg } from '../components/AvatarImg';
import { GamePanel, Key } from './GamePanel';
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

  return (
    <GamePanel
      className="chal"
      pill={<><AvatarImg id={by.avatar} name={by.name} bot={by.bot} size={26} /><span>{t('ov.laid4', { who: by.name })}</span></>}
      title={t('ov.challenge')}
      keys={{ 1: onAccept, 2: onChallenge }}
    >
      <div className="chal-opts">
        <div className="chal-opt">
          <div className="chal-info">
            <span className="chal-big">+{pending}</span>
            <span className="chal-sub">{canAnswer ? t('ov.chAnswer', { n: pending }) : t('ov.chSafe')}</span>
          </div>
          <button type="button" className="btn big blue" onClick={onAccept}>
            {canAnswer ? t('ov.accept') : t('ov.acceptTake', { n: pending })}
            <Key k={1} />
          </button>
        </div>
        <div className="chal-opt">
          <div className="chal-info chal-odds">
            <span className="good">{t('ov.chWin', { who: by.name })}</span>
            <span className="bad">{t('ov.chLose', { n: pending + 2 })}</span>
          </div>
          <button type="button" className="btn big red" onClick={onChallenge}>
            {t('ov.challengeBtn')}
            <Key k={2} />
          </button>
        </div>
      </div>

      <p className="gp-note chal-rule">{t('ov.chRule')}</p>
    </GamePanel>
  );
}
