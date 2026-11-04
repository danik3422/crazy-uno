import { PRESETS } from '../../game/content';
import { useT } from '../../i18n';
import { EventLegend, Legend } from '../components/Legend';
import { ModeIcon } from '../settings/ModeIcon';
import './HowTo.css';

/** "How to play" (a tab of the home screen): the four modes, what every special card does, and the random events. */
export function HowTo() {
  const t = useT();
  return (
    <div className="howto">
      <section className="ht-card">
        <h2>{t('howto.modes')}</h2>
        <div className="ht-modes">
          {PRESETS.map(p => (
            <div key={p.id} className="ht-mode">
              <ModeIcon id={p.id} size={34} />
              <div><b>{p.name}</b><small>{p.desc}</small></div>
            </div>
          ))}
        </div>
        <p className="ht-basic">{t('howto.basic')}</p>
      </section>
      <section className="ht-card">
        <h2>{t('howto.cards')}</h2>
        <Legend />
      </section>
      <section className="ht-card">
        <h2>{t('howto.events')}</h2>
        <small className="muted">{t('setup.eventsHint')}</small>
        <EventLegend />
      </section>
    </div>
  );
}
