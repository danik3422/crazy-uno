import { useEffect, useState } from 'react';
import type React from 'react';
import { CoinHeads, CoinTails } from './CoinFaces';

type Side = 'heads' | 'tails';
interface Props {
  name: string;
  coin: { guess: Side; result: Side; win: boolean } | null;
  onGuess: (g: Side) => void;
  onDone: () => void;
}

const FLIP_MS = 1700;

export function CoinFlip({ name, coin, onGuess, onDone }: Props) {
  const [landed, setLanded] = useState(false);
  useEffect(() => {
    if (!coin) return;
    const t = setTimeout(() => setLanded(true), FLIP_MS);
    return () => clearTimeout(t);
  }, [coin]);

  return (
    <>
      <p className="muted">🪙 Монетка судьбы</p>
      <h2>{name}, орёл или решка?</h2>
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
          <p className="muted small">Угадаешь — сбросишь 2 карты. Нет — тянешь 2.</p>
          <div className="row center">
            <button className="btn big" onClick={() => onGuess('heads')}>Орёл</button>
            <button className="btn big" onClick={() => onGuess('tails')}>Решка</button>
          </div>
        </>
      )}
      {coin && landed && (
        <>
          <p className="dare">{coin.win ? 'Угадал(а)! Минус 2 карты 🎉' : 'Мимо! Тянешь 2 🙈'}</p>
          <button className="btn big" autoFocus onClick={onDone}>Дальше</button>
        </>
      )}
    </>
  );
}
