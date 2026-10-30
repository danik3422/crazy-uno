import { type CSSProperties, Suspense } from 'react';
import { lazyFile } from '../../lib/lazyFile';
import { useT } from '../../i18n';
import type { Card } from '../../game/types';
import { cardImage } from '../../three/textures';
import './Hero.css';

const MascotStage = lazyFile(() => import('./MascotStage'));

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
        <img key={c.id} src={cardImage(c, 'classic', 96)} alt="" style={{ '--i': i - 2 } as CSSProperties} />
      ))}
    </div>
  );
}

export function Hero({ sub }: { sub: string }) {
  const t = useT();
  return (
    <header className="hero">
      <Suspense fallback={<FlatFan />}>
        <MascotStage />
      </Suspense>
      <h1 className="logo" aria-label={t('app.title')}>
        {t('app.top').split('').map((ch, i) => <span key={i}>{ch}</span>)}{' '}
        <span className="w">U</span><span>N</span><span>O</span>
      </h1>
      <p className="sub">{sub}</p>
    </header>
  );
}
