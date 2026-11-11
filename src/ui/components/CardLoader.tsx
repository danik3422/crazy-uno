import type { CSSProperties, ReactNode } from 'react';
import type { Card, Color, ThemeId } from '../../game/types';
import { THEMES } from '../../three/themes';
import { cardImage } from '../../three/cards/cardArt';
import './CardLoader.css';

const FACES: Card[] = [
  { id: 1, color: 'red', type: 'num', value: 7 },
  { id: 5, color: 'wild', type: 'wild' },
  { id: 4, color: 'blue', type: 'draw2' },
];

/** The loading backdrop in the table's own colours, so the curtain lifts onto a matching room. */
export function loaderStage(theme: ThemeId = 'classic', color: Color = 'red') {
  const p = THEMES[theme].palette[color];
  return `radial-gradient(ellipse at 50% 28%, ${p.inner} 0%, ${p.mid} 38%, ${p.outer} 88%)`;
}

/** A deck being shuffled: cards split left and right, then riffle back into one stack (faces and backs of the table's theme). */
export function CardLoader({ title, sub, theme = 'classic', children }: { title: string; sub?: string; theme?: ThemeId; children?: ReactNode }) {
  const back = cardImage(null, theme, 64);
  return (
    <div className="card-loader" role="status" aria-live="polite">
      <div className="shuffle" aria-hidden>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <img key={i} src={i % 2 === 1 ? cardImage(FACES[(i >> 1) % FACES.length], theme, 64) : back} alt="" style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
      <h2>{title}</h2>
      {sub && <p>{sub}</p>}
      {children}
    </div>
  );
}
