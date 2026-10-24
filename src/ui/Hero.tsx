import { lazy, Suspense, type CSSProperties } from 'react';
import type { Card } from '../game/types';
import { cardImage } from '../three/textures';

const MascotStage = lazy(() => import('./MascotStage'));

const HERO: Card[] = [
  { id: 1, color: 'red', type: 'num', value: 7 },
  { id: 2, color: 'yellow', type: 'bomb' },
  { id: 3, color: 'wild', type: 'chaos' },
  { id: 4, color: 'green', type: 'dare' },
  { id: 5, color: 'blue', type: 'draw2' },
];

/** Flat fan shown while the 3D stage loads. */
function FlatFan() {
  return (
    <div className="fan" aria-hidden>
      {HERO.map((c, i) => (
        <img key={c.id} src={cardImage(c)} alt="" style={{ '--i': i - 2 } as CSSProperties} />
      ))}
    </div>
  );
}

export function Hero({ sub }: { sub: string }) {
  return (
    <header className="hero">
      <Suspense fallback={<FlatFan />}>
        <MascotStage />
      </Suspense>
      <h1 className="logo" aria-label="Безумное UNO">
        {'БЕЗУМНОЕ'.split('').map((ch, i) => <span key={i}>{ch}</span>)}{' '}
        <span className="w">U</span><span>N</span><span>O</span>
      </h1>
      <p className="sub">{sub}</p>
    </header>
  );
}
