import { useState } from 'react';
import { avatarOf, randomBot } from '../../../game/avatars';
import { DEFAULT_TABLE } from '../../../game/content';
import { MAX_PLAYERS } from '../../../net/protocol';
import type { LocalSetup } from '../../../game/engine/Game';
import { teamsOf, teamsProblem } from '../../../game/teams';
import { render, useT } from '../../../i18n';
import { usePageTheme } from '../../backdrop/pageTheme';
import { AvatarPicker } from '../../components/AvatarImg';
import { Hero } from '../../components/Hero';
import { LangMenu } from '../../components/LangMenu';
import { PhoneTip } from '../../components/phone/PhoneTip';
import { SwipeBack } from '../../components/SwipeBack';
import { TeamBox } from '../../components/TeamBox';
import { enterFullscreen, SMALL_SCREEN, useMedia } from '../../hooks/phone';
import { RulesPanel } from '../../settings/RulesPanel';
import { TablePanel } from '../../settings/TablePanel';
import { ThemePicker } from '../../settings/ThemePicker';
import { PlayerRow } from './PlayerRow';
import { RulesReference } from './RulesReference';
import { TutorialLink } from '../../tutorial/TutorialLink';
import type { TutorialMode } from '../../tutorial/tutorial';
import './Setup.css';

type SetupPlayer = LocalSetup['players'][number];

interface Props {
  cfg: LocalSetup;
  setCfg: (f: (c: LocalSetup) => LocalSetup) => void;
  onStart: () => void;
  onBack: () => void;
  /** the No Mercy tutorial, offered while those rules are picked */
  onTutorial: (mode: TutorialMode) => void;
}

/**
 * Setting up a game on one device: who plays (people and bots), the rules and format, the table look,
 * and the card reference. "Deal" starts it.
 */
export function Setup({ cfg, setCfg, onStart, onBack, onTutorial }: Props) {
  const t = useT();
  const players = cfg.players;
  const [pickFor, setPickFor] = useState<number | null>(null);
  const table = cfg.table ?? DEFAULT_TABLE;
  const theme = cfg.theme ?? 'classic';
  const teams = teamsOf(players);
  const teamsWrong = table.teams ? teamsProblem(teams) : null;
  const humans = players.filter(p => !p.bot).length;
  const small = useMedia(SMALL_SCREEN);
  usePageTheme(theme);

  const setPlayers = (f: (ps: SetupPlayer[]) => SetupPlayer[]) => setCfg(c => ({ ...c, players: f(c.players) }));
  const update = (i: number, patch: Partial<SetupPlayer>) => setPlayers(ps => ps.map((p, k) => (k === i ? { ...p, ...patch } : p)));
  // a random name and robot face, preferably ones nobody at the table has yet
  const newBot = (others: SetupPlayer[]) => ({ bot: true, ...randomBot(others) });

  const row = (i: number) => {
    const p = players[i];
    return (
      <PlayerRow
        key={i}
        index={i}
        player={p}
        team={table.teams ? teams[i] : null}
        canRemove={players.length > 2}
        onAvatar={() => setPickFor(i)}
        onName={name => update(i, { name })}
        onTeam={team => update(i, { team })}
        onToggleBot={() => update(i, p.bot ? { bot: false, avatar: undefined } : newBot(players.filter((_, k) => k !== i)))}
        onRemove={() => setPlayers(ps => ps.filter((_, k) => k !== i))}
      />
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
            <button className="btn" disabled={players.length >= MAX_PLAYERS}
              onClick={() => setPlayers(ps => [...ps, { name: t('setup.playerN', { n: ps.length + 1 }), bot: false }])}>
              {t('setup.addHuman')}
            </button>
            <button className="btn" disabled={players.length >= MAX_PLAYERS} onClick={() => setPlayers(ps => [...ps, newBot(ps)])}>
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
          {cfg.rules.noMercy && <TutorialLink mode="nomercy" onStart={onTutorial} />}
          <h2 className="after-rules">{t('setup.format')}</h2>
          <TablePanel table={table} teams={teams} onChange={tb => setCfg(c => ({ ...c, table: tb }))} />
        </section>
      </div>

      <section className="panel">
        <h2>{t('setup.look')}</h2>
        <ThemePicker compact={small} value={theme} onChange={th => setCfg(c => ({ ...c, theme: th }))} />
      </section>

      <RulesReference rules={cfg.rules} theme={theme} open={!small} />

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
