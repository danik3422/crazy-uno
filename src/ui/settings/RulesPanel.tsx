import { useId, useState } from 'react';
import { presetOf, PRESETS, RULE_GROUPS, RULES } from '../../game/content';
import type { Rules } from '../../game/types';
import { ModeIcon } from './ModeIcon';
import './settings.css';
import './RulesPanel.css';

interface Props {
  rules: Rules;
  /** omitted: read-only (only the host may change the rules) */
  onChange?: (r: Rules) => void;
}

const NAME = Object.fromEntries(RULES.map(r => [r.id, r.name])) as Record<keyof Rules, string>;
const DESC = Object.fromEntries(RULES.map(r => [r.id, r.desc])) as Record<keyof Rules, string>;

/**
 * The game mode is the main choice: three presets and one line about the chosen one.
 * Individual rules hide behind "Настроить правила". Read-only (guests) gets a short summary instead.
 */
export function RulesPanel({ rules, onChange }: Props) {
  const current = presetOf(rules);
  const ids = RULES.map(r => r.id);
  const on = ids.filter(k => rules[k]).length;
  const summary = current ? current.desc : `Свои правила · включено ${on} из ${RULES.length}`;

  if (!onChange) {
    return (
      <div className="rules-panel ro">
        <p className="mode-title">
          <ModeIcon id={current?.id ?? 'custom'} size={30} /> {current?.name ?? 'Свои правила'}
        </p>
        <p className="mode-now">{current ? current.desc : `Хост настроил сам: включено ${on} из ${RULES.length}`}</p>
        <ul className="rule-chips" aria-label="Что включено">
          {ids.filter(k => rules[k]).map(k => <li key={k} title={DESC[k]}>{NAME[k]}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="rules-panel">
      <div className="modes" role="radiogroup" aria-label="Режим игры">
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={current?.id === p.id}
            className={`mode ${current?.id === p.id ? 'on' : ''}`}
            onClick={() => onChange({ ...p.rules })}
          >
            <span className="mode-icon"><ModeIcon id={p.id} /></span>
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <p className="mode-now" aria-live="polite">{summary}</p>
      <RuleList rules={rules} onChange={onChange} on={on} />
    </div>
  );
}

/** "Настроить правила": every rule as one quiet row with a switch. Closed by default. */
function RuleList({ rules, onChange, on }: { rules: Rules; onChange: (r: Rules) => void; on: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button type="button" className={`rules-toggle ${open ? 'open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span>{open ? 'Свернуть правила' : 'Настроить правила'}</span>
        <span className="rules-count">{on} из {RULES.length}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="rule-list" id={id}>
          {RULE_GROUPS.map(g => (
            <section key={g.title} className="rule-group">
              <h4>{g.title}</h4>
              {g.rules.map(r => (
                <label key={r.id} className={`rule-row ${rules[r.id] ? 'on' : ''}`}>
                  <span className="rule-text">
                    <b>{NAME[r.id]}</b>
                    <small>{r.short}</small>
                  </span>
                  <span className="switch">
                    <input
                      id={`rule-${r.id}`}
                      type="checkbox"
                      checked={rules[r.id]}
                      onChange={e => onChange({ ...rules, [r.id]: e.target.checked })}
                    />
                    <span className="sw" aria-hidden />
                  </span>
                </label>
              ))}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
