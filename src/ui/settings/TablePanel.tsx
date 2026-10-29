import { useId, useState } from 'react';
import { effectiveTable, QUICK, TABLE_CHOICES } from '../../game/content';
import { teamsProblem } from '../../game/teams';
import { render, t, useT } from '../../i18n';
import type { Table } from '../../game/types';
import { ModeIcon } from './ModeIcon';
import './settings.css';
import './TablePanel.css';

interface Props {
  table: Table;
  /** the team of every seated player, to tell whether teams can be played */
  teams: readonly number[];
  /** omitted: read-only (guests) */
  onChange?: (t: Table) => void;
}

type BotLevel = 'easy' | 'normal' | 'hard';
const botName = (v: BotLevel) => t(`table.bots.${v}`);

const ROWS: { key: keyof typeof TABLE_CHOICES; quick?: boolean; fmt: (v: never) => string }[] = [
  { key: 'botLevel', fmt: (v: BotLevel) => botName(v) },
  { key: 'handSize', fmt: (v: number) => `${v}`, quick: true },
  { key: 'turnSec', fmt: (v: number) => t('table.sec', { n: v }), quick: true },
  { key: 'roundMin', fmt: (v: number) => (v ? t('table.min', { n: v }) : t('table.none')), quick: true },
  { key: 'bombSec', fmt: (v: number) => t('table.sec', { n: v }) },
  { key: 'unoPenalty', fmt: (v: number) => `+${v}` },
  { key: 'events', fmt: (v: 'rare' | 'normal' | 'often') => t(`table.events.${v}`) },
];

/** Format switches (quick round, 2 on 2, autopilot) and the table's numbers, in the same calm style as the rules. */
export function TablePanel({ table, teams, onChange }: Props) {
  useT();
  const ro = !onChange;
  const eff = effectiveTable(table);
  const teamsWrong = table.teams ? teamsProblem(teams) : null;
  const [open, setOpen] = useState(false);
  const id = useId();
  const set = (patch: Partial<Table>) => onChange?.({ ...table, ...patch });

  const formats = (
    <div className="formats">
      <FormatSwitch
        id="fmt-quick"
        icon="quick"
        title={t('table.quick')}
        desc={t('table.quickDesc', { n: QUICK.handSize, s: QUICK.turnSec, m: QUICK.roundMin })}
        on={table.quick}
        ro={ro}
        onToggle={v => set({ quick: v })}
      />
      <FormatSwitch
        id="fmt-teams"
        icon="teams"
        title={t('table.teams')}
        desc={t('table.teamsDesc')}
        on={table.teams}
        ro={ro}
        onToggle={v => set({ teams: v })}
      />
      <FormatSwitch
        id="fmt-autopilot"
        icon="autopilot"
        title={t('table.autopilot')}
        desc={table.autopilot ? t('table.autopilotOn') : t('table.autopilotOff')}
        on={table.autopilot}
        ro={ro}
        onToggle={v => set({ autopilot: v })}
      />
    </div>
  );

  if (ro) {
    const chips = [
      table.quick && t('table.chipQuick'),
      table.teams && t('table.chipTeams'),
      table.autopilot && t('table.chipAutopilot'),
      table.botLevel && table.botLevel !== 'normal' && t('table.chipBots', { level: botName(table.botLevel).toLowerCase() }),
      t('table.cards', { n: eff.handSize }),
      t('table.perTurn', { n: eff.turnSec }),
      eff.roundMin ? t('table.roundChip', { n: eff.roundMin }) : null,
    ].filter(Boolean) as string[];
    return (
      <ul className="rule-chips" aria-label={t('table.aria')}>
        {chips.map(c => <li key={c}>{c}</li>)}
      </ul>
    );
  }

  return (
    <div className="table-panel">
      {formats}
      {teamsWrong && <p className="table-warn" role="alert">{render(teamsWrong)}.</p>}
      <button type="button" className={`rules-toggle ${open ? 'open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span>{open ? t('table.collapse') : t('table.settings')}</span>
        <span className="rules-count">{t('table.cards', { n: eff.handSize })} · {t('table.sec', { n: eff.turnSec })}{eff.botLevel && eff.botLevel !== 'normal' ? ` · ${t('table.botsSummary', { level: botName(eff.botLevel).toLowerCase() })}` : ''}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="rule-list" id={id}>
          {ROWS.map(r => {
            const label = t(`table.row.${r.key}`);
            const hint =
              r.key === 'botLevel' ? t(`table.botHint.${eff.botLevel ?? 'normal'}`)
              : r.key === 'turnSec' && table.autopilot ? t('table.hint.turnSecAuto')
              : t(`table.hint.${r.key as Exclude<typeof r.key, 'botLevel'>}`);
            const locked = r.quick && table.quick;
            const cur = (locked ? eff : table)[r.key] ?? (r.key === 'botLevel' ? 'normal' : undefined);
            return (
              <div key={r.key} className={`rule-row num-row ${locked ? 'locked' : ''}`}>
                <span className="rule-text">
                  <b>{label}</b>
                  <small>{locked ? t('table.byQuick') : hint}</small>
                </span>
                <span className="seg" role="radiogroup" aria-label={label}>
                  {(TABLE_CHOICES[r.key] as readonly (string | number)[]).map(v => (
                    <button
                      key={String(v)}
                      type="button"
                      role="radio"
                      id={`tbl-${r.key}-${v}`}
                      aria-checked={cur === v}
                      className={cur === v ? 'on' : ''}
                      disabled={locked}
                      onClick={() => set({ [r.key]: v } as Partial<Table>)}
                    >
                      {r.fmt(v as never)}
                    </button>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** A whole tile that turns a format on and off: drawn icon, short line, a check when on. */
function FormatSwitch({ id, icon, title, desc, on, ro, onToggle }: { id: string; icon: string; title: string; desc: string; on: boolean; ro: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={on}
      disabled={ro}
      className={`format ${on ? 'on' : ''}`}
      onClick={() => onToggle(!on)}
    >
      <span className="format-icon"><ModeIcon id={icon} size={40} /></span>
      <span className="format-text">
        <b>{title}</b>
        <small>{desc}</small>
      </span>
      <span className="format-check" aria-hidden>
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </button>
  );
}
