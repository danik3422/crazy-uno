import type { CSSProperties, ReactNode } from 'react';
import type { Card, ThemeId } from '../../game/types';
import { cardImage } from '../../three/textures';
import './CardLoader.css';

const FACES: Card[] = [
  { id: 1, color: 'red', type: 'num', value: 7 },
  { id: 2, color: 'yellow', type: 'skip' },
  { id: 3, color: 'green', type: 'num', value: 3 },
  { id: 4, color: 'blue', type: 'draw2' },
];

/** A deck being shuffled: cards split left and right, then riffle back into one stack. */
export function CardLoader({ title, sub, theme = 'classic', children }: { title: string; sub?: string; theme?: ThemeId; children?: ReactNode }) {
  const back = cardImage(null, theme);
  return (
    <div className="card-loader" role="status" aria-live="polite">
      <div className="shuffle" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <img key={i} src={i % 3 === 1 ? cardImage(FACES[(i >> 1) % 4]) : back} alt="" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
      {children}
    </div>
  );
}
