import { useState } from 'react';
import { THEMES_LIST } from '../../../game/content';
import { teamsProblem } from '../../../game/teams';
import { lang, render, useT } from '../../../i18n';
import type { Connection } from '../../../net/connection';
import { MAX_PLAYERS, type RoomInfo } from '../../../net/protocol';
import { ConnBadge } from '../../components/ConnBadge';
import { LangMenu } from '../../components/LangMenu';
import { PhoneTip } from '../../components/RotateGate';
import { SwipeBack } from '../../components/SwipeBack';
import { usePageTheme } from '../../backdrop/pageTheme';
import { RulesPanel } from '../../settings/RulesPanel';
import { TablePanel } from '../../settings/TablePanel';
import { ThemePicker } from '../../settings/ThemePicker';
import { Invite } from './Invite';
import { PlayerList } from './PlayerList';
import { StartBar, WaitingForHost } from './StartBar';
import { useOptimisticRoom } from './useOptimisticRoom';
import './Lobby.css';

interface Props {
  conn: Connection;
  room: RoomInfo;
  onLeave: () => void;
  avatar: string;
  setAvatar: (id: string) => void;
}

/**
 * The online room before a round: room code and invite, who is here, game mode, format, table look, start.
 * The host changes everything; guests see the same read-only and a "waiting for the host" line.
 */
export function Lobby({ conn, room: serverRoom, onLeave, avatar, setAvatar }: Props) {
  const t = useT();
  const { room, change, pendingBots, botAsked } = useOptimisticRoom(serverRoom);
  const [picking, setPicking] = useState(false);
  // the whole page takes the room's table look, for the host and every guest
  usePageTheme(room.theme);

  const me = room.members.find(m => m.id === room.you);
  const isHost = !!me?.host;
  const hostName = room.members.find(m => m.host)?.name ?? t('lobby.host');
  const players = room.members.filter(m => !m.spectator);
  const watchers = room.members.filter(m => m.spectator);
  const theme = THEMES_LIST.find(x => x.id === room.theme);
  // the server tells everyone's side (their pick, or the side that is short)
  const teams = players.map(m => m.team ?? 0);
  const teamsWrong = room.table.teams ? teamsProblem(teams) : null;
  const canStart = isHost && players.length >= 2 && !teamsWrong;
  const startHint = players.length < 2 ? t('lobby.needMore') : teamsWrong ? t('lobby.teamsFix', { why: render(teamsWrong) }) : null;

  return (
    <div className="lobby">
      <SwipeBack onBack={onLeave} />
      <header className="lobby-top">
        <button className="btn ghost back" onClick={onLeave}>{t('lobby.leave')}</button>
        <div className="lobby-top-r">
          <ConnBadge conn={conn} />
          <LangMenu />
        </div>
      </header>

      <main className="lobby-card">
        {/* a computer: who is at the table on the left, how the game goes on the right, the start under both.
            A phone: the two columns melt into one (display: contents) */}
        <div className="lb-col lb-who">
          <Invite code={room.code} />
          <PlayerList
            players={players}
            watchers={watchers}
            you={room.you}
            isHost={isHost}
            teams={room.table.teams ? teams : null}
            pendingBots={pendingBots}
            canAddBot={isHost && players.length + pendingBots < MAX_PLAYERS}
            onAddBot={() => { botAsked(); conn.send({ t: 'addBot', lang: lang() }); }}
            onKick={id => conn.send({ t: 'kick', id })}
            onTeam={(id, team) => conn.send({ t: 'team', id, team })}
            avatar={avatar}
            setAvatar={setAvatar}
            picking={picking}
            setPicking={setPicking}
          />
        </div>

        <div className="lb-col lb-how">
          <section className="lb-section" aria-labelledby="lb-mode">
            <h2 className="lb-h" id="lb-mode">{t('lobby.mode')}</h2>
            <RulesPanel rules={room.rules} onChange={isHost ? rules => { change('rules', rules); conn.send({ t: 'rules', rules }); } : undefined} />
          </section>
          <section className="lb-section" aria-labelledby="lb-format">
            <h2 className="lb-h" id="lb-format">{t('lobby.format')}</h2>
            <TablePanel table={room.table} teams={teams} onChange={isHost ? table => { change('table', table); conn.send({ t: 'table', table }); } : undefined} />
          </section>
          <section className="lb-section lb-theme" aria-labelledby="lb-theme">
            <h2 className="lb-h" id="lb-theme">
              {t('lobby.table')} {!isHost && <span className="lb-count">{theme?.name}</span>}
            </h2>
            {isHost && <ThemePicker compact value={room.theme} onChange={th => { change('theme', th); conn.send({ t: 'theme', theme: th }); }} />}
          </section>
        </div>

        <PhoneTip />
        {isHost ? <StartBar canStart={canStart} hint={startHint} onStart={() => conn.send({ t: 'start' })} /> : <WaitingForHost hostName={hostName} />}
      </main>
    </div>
  );
}
