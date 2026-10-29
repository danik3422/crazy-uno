import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import type React from 'react';
import { CoinHeads, CoinTails } from './CoinFaces';
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

  return (
    <>
      <p className="muted">{t('coin.title')}</p>
      <h2>{t('coin.ask', { who: name })}</h2>
      <div className="coin-stage">
        <div
          className={`coin ${coin ? 'flipping' : 'idle'}`}
          style={{ '--end': coin?.result === 'tails' ? '1980deg' : '1800deg' } as React.CSSProperties}
        >
          <span className="face heads"><CoinHeads /></span>
          <span className="face tails"><CoinTails /></span>
        </div>
      </div>
      {!coin && (
        <>
          <p className="muted small">{t('coin.rule')}</p>
          <div className="row center">
            <button className="btn big" onClick={() => onGuess('heads')}>{t('coin.heads')}</button>
            <button className="btn big" onClick={() => onGuess('tails')}>{t('coin.tails')}</button>
          </div>
        </>
      )}
      {coin && landed && (
        <>
          <p className="dare">{coin.win ? t('coin.win') : t('coin.lose')}</p>
          <button className="btn big" autoFocus onClick={onDone}>{t('coin.next')}</button>
        </>
      )}
    </>
  );
}
