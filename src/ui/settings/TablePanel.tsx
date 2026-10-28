import { useId, useState } from 'react';
import { effectiveTable, QUICK, TABLE_CHOICES } from '../../game/content';
import { teamsProblem } from '../../game/teams';
import type { Table } from '../../game/types';
import { ModeIcon } from './ModeIcon';

interface Props {
  table: Table;
  /** the team of every seated player, to tell whether teams can be played */
  teams: readonly number[];
  /** omitted: read-only (guests) */
  onChange?: (t: Table) => void;
}

const EVENT_NAMES = { rare: 'Редко', normal: 'Обычно', often: 'Часто' } as const;
const BOT_NAMES = { easy: 'Лёгкие', normal: 'Обычные', hard: 'Хитрые' } as const;
const BOT_HINTS = {
  easy: 'кладут что попало и часто забывают «UNO!»',
  normal: 'играют разумно, иногда ошибаются',
  hard: 'просчитывают ходы наперёд: бьют лидера штрафами, берегут дикие карты',
} as const;

const ROWS: { key: keyof typeof TABLE_CHOICES; label: string; hint: string; fmt: (v: never) => string; quick?: boolean }[] = [
  { key: 'botLevel', label: 'Боты', hint: '', fmt: (v: keyof typeof BOT_NAMES) => BOT_NAMES[v] },
  { key: 'handSize', label: 'Карт на старте', hint: 'сколько раздают каждому', fmt: (v: number) => `${v}`, quick: true },
  { key: 'turnSec', label: 'Время на ход', hint: 'не успел — тянешь карту', fmt: (v: number) => `${v} с`, quick: true },
  { key: 'roundMin', label: 'Лимит раунда', hint: 'по сигналу побеждает тот, у кого меньше карт', fmt: (v: number) => (v ? `${v} мин` : 'Нет'), quick: true },
  { key: 'bombSec', label: 'Таймер бомбы', hint: 'на ход после карты «Бомба»', fmt: (v: number) => `${v} с` },
  { key: 'unoPenalty', label: 'Штраф за UNO', hint: 'если поймали без «UNO!»', fmt: (v: number) => `+${v}` },
  { key: 'events', label: 'Безумные события', hint: 'как часто что-то случается', fmt: (v: keyof typeof EVENT_NAMES) => EVENT_NAMES[v] },
];

/** Format switches (quick round, 2 on 2, autopilot) and the table's numbers, in the same calm style as the rules. */
export function TablePanel({ table, teams, onChange }: Props) {
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
        title="Быстрый раунд"
        desc={`${QUICK.handSize} карт · ${QUICK.turnSec} с на ход · ${QUICK.roundMin} мин`}
        on={table.quick}
        ro={ro}
        onToggle={v => set({ quick: v })}
      />
      <FormatSwitch
        id="fmt-teams"
        icon="teams"
        title="2 на 2"
        desc="Командами: выбери, кто с кем"
        on={table.teams}
        ro={ro}
        onToggle={v => set({ teams: v })}
      />
      <FormatSwitch
        id="fmt-autopilot"
        icon="autopilot"
        title="Автопилот"
        desc={table.autopilot ? 'Не успел — за тебя ходит бот' : 'Выкл.: не успел — берёшь карту'}
        on={table.autopilot}
        ro={ro}
        onToggle={v => set({ autopilot: v })}
      />
    </div>
  );

  if (ro) {
    const chips = [
      table.quick && '⚡ Быстрый раунд',
      table.teams && '👥 2 на 2',
      table.autopilot && '🤖 Автопилот',
      table.botLevel && table.botLevel !== 'normal' && `Боты: ${BOT_NAMES[table.botLevel].toLowerCase()}`,
      `${eff.handSize} карт`,
      `${eff.turnSec} с на ход`,
      eff.roundMin ? `раунд ${eff.roundMin} мин` : null,
    ].filter(Boolean) as string[];
    return (
      <ul className="rule-chips" aria-label="Формат стола">
        {chips.map(c => <li key={c}>{c}</li>)}
      </ul>
    );
  }

  return (
    <div className="table-panel">
      {formats}
      {teamsWrong && <p className="table-warn" role="alert">{teamsWrong}.</p>}
      <button type="button" className={`rules-toggle ${open ? 'open' : ''}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(o => !o)}>
        <span>{open ? 'Свернуть настройки стола' : 'Настройки стола'}</span>
        <span className="rules-count">{eff.handSize} карт · {eff.turnSec} с{eff.botLevel && eff.botLevel !== 'normal' ? ` · боты ${BOT_NAMES[eff.botLevel].toLowerCase()}` : ''}</span>
        <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
      {open && (
        <div className="rule-list" id={id}>
          {ROWS.map(r => {
            const hint =
              r.key === 'botLevel' ? BOT_HINTS[eff.botLevel ?? 'normal']
              : r.key === 'turnSec' && table.autopilot ? 'потом ходит автопилот'
              : r.hint;
            const locked = r.quick && table.quick;
            const cur = (locked ? eff : table)[r.key] ?? (r.key === 'botLevel' ? 'normal' : undefined);
            return (
              <div key={r.key} className={`rule-row num-row ${locked ? 'locked' : ''}`}>
                <span className="rule-text">
                  <b>{r.label}</b>
                  <small>{locked ? 'задано быстрым раундом' : hint}</small>
                </span>
                <span className="seg" role="radiogroup" aria-label={r.label}>
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
