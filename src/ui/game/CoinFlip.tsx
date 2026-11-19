import { useEffect, useState } from 'react';
import { EventIcon } from '../components/EventIcon';
import { useT } from '../../i18n';
import type React from 'react';
import { CoinHeads, CoinTails } from './CoinFaces';
import { GamePanel, Key } from './GamePanel';
import './CoinFlip.css';

type Side = 'heads' | 'tails';
interface Props {
  name: string;
  coin: { guess: Side; result: Side; win: boolean } | null;
  onGuess: (g: Side) => void;
  onDone: () => void;
}

const FLIP_MS = 1700;

export function CoinFlip({ name, coin, onGuess, onDone }: Props) {
  const t = useT();
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!coin) return;
    const id = setTimeout(() => setLanded(true), FLIP_MS);
    return () => clearTimeout(id);
  }, [coin]);

  const guess = !coin ? onGuess : null;
  const done = coin && landed ? onDone : undefined;

  return (
    <GamePanel
      className="coin-panel"
      pill={<><EventIcon id="coin" size={22} /><span>{t('coin.title')}</span></>}
      title={t('coin.ask', { who: name })}
      keys={guess ? { 1: () => guess('heads'), 2: () => guess('tails') } : undefined}
      onEnter={done}
    >
      <div className="coin-stage">
        <div
          className={`coin ${coin ? 'flipping' : 'idle'}`}
          style={{ '--end': coin?.result === 'tails' ? '1980deg' : '1800deg' } as React.CSSProperties}
        >
          <span className="face heads"><CoinHeads /></span>
          <span className="face tails"><CoinTails /></span>
        </div>
      </div>
      {/* the rule, then the verdict in its place: the panel keeps its height while the coin flies */}
      {coin && landed ? (
        <p className={`gp-card coin-verdict ${coin.win ? 'good' : 'bad'}`} aria-live="polite">{coin.win ? t('coin.win') : t('coin.lose')}</p>
      ) : (
        <p className="gp-note coin-rule">{t('coin.rule')}</p>
      )}
      {!coin ? (
        <div className="gp-actions">
          <button type="button" className="btn big" onClick={() => onGuess('heads')}>{t('coin.heads')}<Key k={1} /></button>
          <button type="button" className="btn big" onClick={() => onGuess('tails')}>{t('coin.tails')}<Key k={2} /></button>
        </div>
      ) : (
        <div className="gp-actions one">
          {/* hidden (not gone) while the coin flies, so nothing jumps when it lands */}
          <button type="button" className="btn big" disabled={!landed} style={landed ? undefined : { visibility: 'hidden' }} onClick={onDone}>{t('coin.next')}</button>
        </div>
      )}
    </GamePanel>
  );
}
