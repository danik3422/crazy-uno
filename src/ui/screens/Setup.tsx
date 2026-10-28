import { useEffect } from 'react';
import { avatarOf, BOT_AVATARS, HUMAN_AVATARS, randomBot } from '../../game/avatars';
import { DEFAULT_TABLE, EVENTS, TEAM_NAMES } from '../../game/content';
import { teamsOf, teamsProblem } from '../../game/teams';
import type { LocalSetup } from '../../game/engine';
import { AvatarImg } from '../components/AvatarImg';
import { Hero } from '../components/Hero';
import { Legend } from '../components/Legend';
import { SwapTeamIcon, TeamBox } from '../components/TeamBox';
import { PhoneTip } from '../components/RotateGate';
import { SwipeBack } from '../components/SwipeBack';
import { enterFullscreen, SMALL_SCREEN, useMedia } from '../hooks/phone';
import { RulesPanel } from '../settings/RulesPanel';
import { TablePanel } from '../settings/TablePanel';
import { ThemePicker } from '../settings/ThemePicker';

interface Props {
  cfg: LocalSetup;
  setCfg: (f: (c: LocalSetup) => LocalSetup) => void;
  onStart: () => void;
  onBack: () => void;
}

export function Setup({ cfg, setCfg, onStart, onBack }: Props) {
  const players = cfg.players;
  const update = (i: number, patch: Partial<LocalSetup['players'][number]>) =>
    setCfg(c => ({ ...c, players: c.players.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  // a random name and robot face, preferably ones nobody at the table has yet
  const newBot = (others = players) => ({ bot: true, ...randomBot(others) });
  const humans = players.filter(p => !p.bot).length;
  const table = cfg.table ?? DEFAULT_TABLE;
  const teams = teamsOf(players);
  const teamsWrong = table.teams ? teamsProblem(teams) : null;
  const small = useMedia(SMALL_SCREEN);
  const theme = cfg.theme ?? 'classic';
  useEffect(() => {
    document.body.classList.add(`page-${theme}`);
    return () => document.body.classList.remove(`page-${theme}`);
  }, [theme]);

  /** One editable player: avatar, name, team switch (teams format), person/bot, remove. */
  const row = (i: number) => {
    const p = players[i];
    return (
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
        {table.teams && (
          <button
            className={`btn team-swap to${1 - teams[i]}`}
            title={`Перевести в команду «${TEAM_NAMES[1 - teams[i]]}»`}
            aria-label={`${p.name}: перевести в команду «${TEAM_NAMES[1 - teams[i]]}»`}
            onClick={() => update(i, { team: teams[i] ? 0 : 1 })}
          >
            <SwapTeamIcon />
          </button>
        )}
        <button
          className="btn tog"
          title={p.bot ? 'Бот — нажми, чтобы стал человеком' : 'Человек — нажми, чтобы стал ботом'}
          onClick={() => update(i, p.bot ? { bot: false, avatar: undefined } : newBot(players.filter((_, k) => k !== i)))}
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
    );
  };

  return (
    <div className={`setup-page page-${cfg.theme ?? 'classic'}`}>
      <SwipeBack onBack={onBack} />
      <button className="btn back" onClick={onBack}>← Назад</button>
      <Hero sub="Один экран на всю компанию. Передаёте телефон или ноутбук по кругу, и пусть победит самый наглый." />

      <div className="setup">
        <section className="panel">
          <h2>Игроки</h2>
          {table.teams ? (
            <div className="team-cols">
              {([0, 1] as const).map(t => {
                const mine = players.map((_, i) => i).filter(i => teams[i] === t);
                return (
                  <TeamBox key={t} team={t} count={mine.length} empty="Пока никого: нажми ⇄ у игрока из другой команды">
                    {mine.length > 0 && <div className="plist-edit">{mine.map(row)}</div>}
                  </TeamBox>
                );
              })}
            </div>
          ) : (
            <div className="plist-edit">{players.map((_, i) => row(i))}</div>
          )}
          <div className="row">
            <button className="btn" disabled={players.length >= 8}
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, { name: `Игрок ${c.players.length + 1}`, bot: false }] }))}>
              + Человек
            </button>
            <button className="btn" disabled={players.length >= 8}
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, newBot(c.players)] }))}>
              + Бот
            </button>
          </div>
          <small className="muted">
            От 2 до 8 игроков. {humans > 1
              ? 'Людей несколько: перед каждым ходом карты прячутся, пока устройство не передадут.'
              : 'Добавь людей, и игра будет прятать карты между ходами.'}
          </small>
          {teamsWrong && <p className="table-warn">{teamsWrong}: поменяй команды или добавь игрока.</p>}
          <PhoneTip />
          <button className="btn big" disabled={!!teamsWrong} onClick={() => { void enterFullscreen(); onStart(); }}>Раздавай!</button>
        </section>

        <section className="panel">
          <h2>Правила</h2>
          <RulesPanel rules={cfg.rules} onChange={rules => setCfg(c => ({ ...c, rules }))} />
          <h2 style={{ marginTop: 8 }}>Формат</h2>
          <TablePanel table={table} teams={teams} onChange={t => setCfg(c => ({ ...c, table: t }))} />
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
        <Legend rules={cfg.rules} />
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
