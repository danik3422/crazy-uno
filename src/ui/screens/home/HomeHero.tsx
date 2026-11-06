import { Suspense } from 'react';
import { useT } from '../../../i18n';
import { lazyFile } from '../../../lib/lazyFile';
import { UiIcon } from '../../components/UiIcon';
import './HomeHero.css';

/** the 3D mascot loads on its own, after the menu is up */
const MascotStage = lazyFile(() => import('../../components/MascotStage'));

const FEATURES = [
  { icon: 'events', key: 'home.feat.events' },
  { icon: 'themes', key: 'home.feat.themes' },
  { icon: 'players', key: 'home.feat.players' },
  { icon: 'robot', key: 'home.feat.bots' },
] as const;

/** The left side of the play tab: the mascot with its card fan, the logo, the tagline and what the game has. */
export function HomeHero() {
  const t = useT();
  return (
    <section className="home-hero">
      <div className="home-stage">
        <Suspense fallback={null}>
          <MascotStage />
        </Suspense>
      </div>
      <h1 className="logo home-logo" aria-label={t('app.title')}>
        <span className="logo-top">
          {t('app.top').split('').map((ch, i) => <span key={i}>{ch}</span>)}
        </span>
        <span className="logo-uno">UNO</span>
      </h1>
      <p className="home-tag">{t('home.tag')}</p>
      <ul className="home-chips">
        {FEATURES.map(f => (
          <li key={f.key}><UiIcon name={f.icon} size={20} />{t(f.key)}</li>
        ))}
      </ul>
    </section>
  );
}
