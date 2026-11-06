import { PRESETS } from '../../../game/content';
import { useT } from '../../../i18n';
import { EventLegend, Legend } from '../../components/Legend';
import { ModeIcon } from '../../settings/ModeIcon';
import type { TutorialMode } from '../../tutorial/tutorial';
import './HowTo.css';

/** "How to play" (a tab of the home screen): the four modes, what every special card does, and the random events. */
export function HowTo({ onTutorial }: { onTutorial: (mode: TutorialMode) => void }) {
  const t = useT();
  return (
    <div className="howto">
      {(['classic', 'nomercy'] as const).map(mode => (
        <section key={mode} className="ht-card ht-tutorial">
          <ModeIcon id={mode} size={40} />
          <div>
            <h2>{t(mode === 'nomercy' ? 'tut.cardNm' : 'tut.card')}</h2>
            <small className="muted">{t(mode === 'nomercy' ? 'tut.cardSubNm' : 'tut.cardSub')}</small>
          </div>
          <button type="button" className="btn" onClick={() => onTutorial(mode)}>{t('tut.cardBtn')}</button>
        </section>
      ))}
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
