import { avatarOf, randomBot } from '../../game/avatars';
import { DEFAULT_TABLE, teamName } from '../../game/content';
import { render, useT } from '../../i18n';
import { teamsOf, teamsProblem } from '../../game/teams';
import type { LocalSetup } from '../../game/engine';
import { useState } from 'react';
import { AvatarImg, AvatarPicker } from '../components/AvatarImg';
import { UiIcon } from '../components/UiIcon';
import { Hero } from '../components/Hero';
import { EventLegend, Legend } from '../components/Legend';
import { SwapTeamIcon, TeamBox } from '../components/TeamBox';
import { PhoneTip } from '../components/RotateGate';
import { SwipeBack } from '../components/SwipeBack';
import { LangMenu } from '../components/LangMenu';
import { enterFullscreen, SMALL_SCREEN, useMedia } from '../hooks/phone';
import { RulesPanel } from '../settings/RulesPanel';
import { TablePanel } from '../settings/TablePanel';
import { ThemePicker } from '../settings/ThemePicker';
import { usePageTheme } from '../backdrop/pageTheme';
import './Setup.css';

interface Props {
  cfg: LocalSetup;
  setCfg: (f: (c: LocalSetup) => LocalSetup) => void;
  onStart: () => void;
  onBack: () => void;
}

export function Setup({ cfg, setCfg, onStart, onBack }: Props) {
  const t = useT();
  const players = cfg.players;
  const [pickFor, setPickFor] = useState<number | null>(null);
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
  usePageTheme(theme);

  /** One editable player: avatar, name, team switch (teams format), person/bot, remove. */
  const row = (i: number) => {
    const p = players[i];
    return (
      <div className="prow" key={i}>
        <button
          className="ava-btn"
          title={t('home.changeAvatar')}
          onClick={() => setPickFor(i)}
        >
          <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={42} />
        </button>
        <input
          id={`pname${i}`}
          maxLength={16}
          value={p.name}
          aria-label={t('setup.nameAria', { n: i + 1 })}
          onChange={e => update(i, { name: e.target.value })}
        />
        {table.teams && (
          <button
            className={`btn team-swap to${1 - teams[i]}`}
            title={t('team.moveTo', { team: teamName(1 - teams[i]) })}
            aria-label={t('team.moveAria', { name: p.name, team: teamName(1 - teams[i]) })}
            onClick={() => update(i, { team: teams[i] ? 0 : 1 })}
          >
            <SwapTeamIcon />
          </button>
        )}
        <button
          className="btn tog"
          title={p.bot ? t('setup.botTip') : t('setup.humanTip')}
          onClick={() => update(i, p.bot ? { bot: false, avatar: undefined } : newBot(players.filter((_, k) => k !== i)))}
        >
          <UiIcon name={p.bot ? 'robot' : 'person'} size={22} />
          <span className="tog-label">{p.bot ? t('setup.bot') : t('setup.human')}</span>
        </button>
        <button
          className="btn x"
          aria-label={t('setup.remove')}
          disabled={players.length <= 2}
          onClick={() => setCfg(c => ({ ...c, players: c.players.filter((_, k) => k !== i) }))}
        >
          ✕
        </button>
      </div>
    );
  };

  return (
    <div className="setup-page">
      <SwipeBack onBack={onBack} />
      <header className="page-top">
        <button className="btn back" onClick={onBack}>{t('setup.back')}</button>
        <LangMenu />
      </header>
      <Hero sub={t('setup.sub')} />

      <div className="setup">
        <section className="panel">
          <h2>{t('setup.players')}</h2>
          {table.teams ? (
            <div className="team-cols">
              {([0, 1] as const).map(side => {
                const mine = players.map((_, i) => i).filter(i => teams[i] === side);
                return (
                  <TeamBox key={side} team={side} count={mine.length} empty={t('setup.teamEmpty')}>
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
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, { name: t('setup.playerN', { n: c.players.length + 1 }), bot: false }] }))}>
              {t('setup.addHuman')}
            </button>
            <button className="btn" disabled={players.length >= 8}
              onClick={() => setCfg(c => ({ ...c, players: [...c.players, newBot(c.players)] }))}>
              {t('setup.addBot')}
            </button>
          </div>
          <small className="muted">
            {t('setup.count')} {humans > 1 ? t('setup.manyHumans') : t('setup.oneHuman')}
          </small>
          {teamsWrong && <p className="table-warn">{t('setup.teamsFix', { why: render(teamsWrong) })}</p>}
          <PhoneTip />
          <button className="btn big" disabled={!!teamsWrong} onClick={() => { void enterFullscreen(); onStart(); }}>{t('setup.deal')}</button>
        </section>

        <section className="panel">
          <h2>{t('setup.rules')}</h2>
          <RulesPanel rules={cfg.rules} onChange={rules => setCfg(c => ({ ...c, rules }))} />
          <h2 className="after-rules">{t('setup.format')}</h2>
          <TablePanel table={table} teams={teams} onChange={tb => setCfg(c => ({ ...c, table: tb }))} />
        </section>
      </div>

      <section className="panel">
        <h2>{t('setup.look')}</h2>
        <ThemePicker compact={small} value={cfg.theme ?? 'classic'} onChange={theme => setCfg(c => ({ ...c, theme }))} />
      </section>

      {/* the reference is long: folded away on phones, open on a big screen */}
      <details className="panel ref-panel" open={!small || undefined}>
        <summary>
          <h2>{t('setup.ref')}</h2>
          <span className="ref-count">{t('setup.refCount')}</span>
          <svg className="chev" viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </summary>
        <Legend rules={cfg.rules} theme={theme} />
        <h3 className="ref-sub">{t('setup.events')}</h3>
        <small className="muted">{t('setup.eventsHint')}</small>
        <EventLegend />
      </details>
      {pickFor !== null && players[pickFor] && (
        <AvatarPicker
          pool={players[pickFor].bot ? 'bot' : 'human'}
          value={avatarOf(players[pickFor].avatar, players[pickFor].name, players[pickFor].bot).id}
          title={players[pickFor].name || t('home.changeAvatar')}
          onChange={id => { update(pickFor, { avatar: id }); setPickFor(null); }}
          onClose={() => setPickFor(null)}
        />
      )}
    </div>
  );
}
