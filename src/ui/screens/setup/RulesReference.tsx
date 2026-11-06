import type { Rules, ThemeId } from '../../../game/types';
import { useT } from '../../../i18n';
import { EventLegend, Legend } from '../../components/Legend';
import './RulesReference.css';

/** What every card and every random event does: long, so folded away on phones and open on a big screen. */
export function RulesReference({ rules, theme, open }: { rules: Rules; theme: ThemeId; open: boolean }) {
  const t = useT();
  return (
    <details className="panel ref-panel" open={open || undefined}>
      <summary>
        <h2>{t('setup.ref')}</h2>
        <span className="ref-count">{t('setup.refCount')}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </summary>
      <Legend rules={rules} theme={theme} />
      <h3 className="ref-sub">{t('setup.events')}</h3>
      <small className="muted">{t('setup.eventsHint')}</small>
      <EventLegend />
    </details>
  );
}
