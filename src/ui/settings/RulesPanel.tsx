import { useId, useState } from 'react';
import { presetOf, PRESETS, RULE_GROUPS, RULES } from '../../game/content';
import { useT } from '../../i18n';
import type { Rules } from '../../game/types';
import { ModeIcon } from './ModeIcon';
import './panels.css';
import './RulesPanel.css';

interface Props {
  rules: Rules;
  /** omitted: read-only (only the host may change the rules) */
  onChange?: (r: Rules) => void;
}

const ruleOf = (id: keyof Rules) => RULES.find(r => r.id === id)!;

/**
 * The game mode is the main choice: three presets and one line about the chosen one.
 * Individual rules hide behind "Customize rules". Read-only (guests) gets a short summary instead.
 */
export function RulesPanel({ rules, onChange }: Props) {
  const t = useT();
  const current = presetOf(rules);
  // the 25-card knockout only means something with No Mercy: otherwise it is neither counted nor listed
  const ids = RULES.map(r => r.id).filter(k => k !== 'mercy' || rules.noMercy);
  const on = ids.filter(k => rules[k]).length;
  const summary = current ? current.desc : t('rules.customOn', { on, all: ids.length });

  if (!onChange) {
    return (
      <div className="rules-panel ro">
        <p className="mode-title">
          <ModeIcon id={current?.id ?? 'custom'} size={30} /> {current?.name ?? t('rules.custom')}
        </p>
        <p className="mode-now">{current ? current.desc : t('rules.hostCustom', { on, all: ids.length })}</p>
        <ul className="rule-chips" aria-label={t('rules.enabled')}>
          {ids.filter(k => rules[k]).map(k => <li key={k} title={ruleOf(k).desc}>{ruleOf(k).name}</li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="rules-panel">
      <div className="modes" role="radiogroup" aria-label={t('rules.mode')}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={current?.id === p.id}
            className={`mode ${current?.id === p.id ? 'on' : ''}`}
            onClick={() => onChange({ ...p.rules })}
          >
            <span className="mode-icon"><ModeIcon id={p.id} size={34} /></span>
            <span className="mode-name">{p.name}</span>
          </button>
        ))}
      </div>
      <p className="mode-now" aria-live="polite">{summary}</p>
      <RuleList rules={rules} onChange={onChange} on={on} all={ids.length} />
    </div>
  );
}

/** "Customize rules": every rule as one quiet row with a switch. Closed by default. */
function RuleList({ rules, onChange, on, all }: { rules: Rules; onChange: (r: Rules) => void; on: number; all: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button type="button" className={`rules-toggle ${open ? 'open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span>{open ? t('rules.collapse') : t('rules.customize')}</span>
        <span className="rules-count">{t('lobby.of', { a: on, b: all })}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="rule-list" id={id}>
          {RULE_GROUPS.map(g => (
            <section key={g.id} className="rule-group">
              <h4>{g.title}</h4>
              {/* the 25-card knockout belongs to No Mercy: shown only with it */}
              {g.rules.filter(r => r.id !== 'mercy' || rules.noMercy).map(r => (
                <label key={r.id} className={`rule-row ${rules[r.id] ? 'on' : ''} ${r.id === 'mercy' ? 'sub-rule' : ''}`}>
                  <span className="rule-text">
                    <b>{ruleOf(r.id).name}</b>
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
