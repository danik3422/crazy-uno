import type { Config } from '../App';
import { BOT_AVATARS, HUMAN_AVATARS, avatarOf } from '../game/avatars';
import { BOTNAMES, EVENTS } from '../game/content';
import { AvatarImg } from './AvatarImg';
import { Hero } from './Hero';
import { DEFAULT_TABLE, teamsProblem } from '../game/content';
import { RulesPanel } from './RulesPanel';
import { TablePanel } from './TablePanel';
import { ThemePicker } from './ThemePicker';
import { Legend } from './Legend';
import { SMALL_SCREEN, enterFullscreen, useMedia } from './phone';
import { SwipeBack } from './SwipeBack';
import { useEffect } from 'react';
import { PhoneTip } from './RotateGate';

interface Props {
  cfg: Config;
  setCfg: (f: (c: Config) => Config) => void;
  onStart: () => void;
  onBack: () => void;
}

export function Setup({ cfg, setCfg, onStart, onBack }: Props) {
  const players = cfg.players;
  const update = (i: number, patch: Partial<Config['players'][number]>) =>
    setCfg(c => ({ ...c, players: c.players.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  const freeBot = () => BOTNAMES.find(n => !players.some(p => p.name === n)) ?? `Бот №${players.length + 1}`;
  const humans = players.filter(p => !p.bot).length;
  const table = cfg.table ?? DEFAULT_TABLE;
  const teamsWrong = table.teams ? teamsProblem(players.length) : null;
  const small = useMedia(SMALL_SCREEN);
  const theme = cfg.theme ?? 'classic';
  useEffect(() => {
    document.body.classList.add(`page-${theme}`);
    return () => document.body.classList.remove(`page-${theme}`);
  }, [theme]);

  return (
    <div className={`setup-page page-${cfg.theme ?? 'classic'}`}>
      <SwipeBack onBack={onBack} />
      <button className="btn back" onClick={onBack}>← Назад</button>
      <Hero sub="Один экран на всю компанию. Передаёте телефон или ноутбук по кругу, и пусть победит самый наглый." />

      <div className="setup">
        <section className="panel">
          <h2>Игроки</h2>
          <div className="plist-edit">
            {players.map((p, i) => (
              <div className="prow" key={i}>
                <button
                  className="ava-btn"
                  title="Сменить аватар"
                  onClick={() => {
                    const pool = p.bot ? BOT_AVATARS : HUMAN_AVATARS;
                    const curA = avatarOf(p.avatar, p.name, p.bot);
                    const at = pool.findIndex(a => a.id === curA.id);
                    update(i, { avatar: pool[(at + 1) % pool.length].id });
                  }}
                >
                  <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={42} />
                </button>
                <input
                  id={`pname${i}`}
                  maxLength={16}
                  value={p.name}
                  aria-label={`Имя игрока ${i + 1}`}
                  onChange={e => update(i, { name: e.target.value })}
                />
                <button
                  className="btn tog"
                  title={p.bot ? 'Бот — нажми, чтобы стал человеком' : 'Человек — нажми, чтобы стал ботом'}
                  onClick={() => update(i, p.bot ? { bot: false, avatar: undefined } : { bot: true, avatar: undefined, name: /^Бот/.test(p.name) ? p.name : freeBot() })}
                >
                  <span aria-hidden>{p.bot ? '🤖' : '🙂'}</span>
                  <span className="tog-label">{p.bot ? 'Бот' : 'Человек'}</span>
                </button>
                <button
                  className="btn x"
                  aria-label="Убрать игрока"
                  disabled={players.length <= 2}
                  onClick={() => setCfg(c => ({ ...c, players: c.players.filter((_, k) => k !== i) }))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="row">
            <button className="btn" disabled={players.length >= 8}
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, { name: `Игрок ${c.players.length + 1}`, bot: false }] }))}>
              + Человек
            </button>
            <button className="btn" disabled={players.length >= 8}
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, { name: freeBot(), bot: true }] }))}>
              + Бот
            </button>
          </div>
          <small className="muted">
            От 2 до 8 игроков. {humans > 1
              ? 'Людей несколько: перед каждым ходом карты прячутся, пока устройство не передадут.'
              : 'Добавь людей, и игра будет прятать карты между ходами.'}
          </small>
          {teamsWrong && <p className="table-warn">{teamsWrong}: добавь игрока или бота.</p>}
          <PhoneTip />
          <button className="btn big" disabled={!!teamsWrong} onClick={() => { void enterFullscreen(); onStart(); }}>Раздавай!</button>
        </section>

        <section className="panel">
          <h2>Правила</h2>
          <RulesPanel rules={cfg.rules} onChange={rules => setCfg(c => ({ ...c, rules }))} />
          <h2 style={{ marginTop: 8 }}>Формат</h2>
          <TablePanel table={table} players={players.length} onChange={t => setCfg(c => ({ ...c, table: t }))} />
        </section>
      </div>

      <section className="panel">
        <h2>Оформление</h2>
        <ThemePicker compact={small} value={cfg.theme ?? 'classic'} onChange={theme => setCfg(c => ({ ...c, theme }))} />
      </section>

      {/* the reference is long: folded away on phones, open on a big screen */}
      <details className="panel ref-panel" open={!small || undefined}>
        <summary>
          <h2>Что за карты и события</h2>
          <span className="ref-count">17 карт · 13 событий</span>
          <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <Legend />
        <h3 className="ref-sub">Безумные события</h3>
        <small className="muted">Случаются сами, в случайный момент, примерно раз в 4–13 ходов.</small>
        <div className="legend">
          {Object.entries(EVENTS).map(([id, e]) => (
            <div className="li" key={id}>
              <span className="ev-icon" aria-hidden>{e.icon}</span>
              <div>
                <b>{e.title}</b>
                <small>{e.desc}</small>
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
