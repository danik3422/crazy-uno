import type { ReactNode } from 'react';
import { teamName } from '../../../game/content';
import { teamsOf, type TeamId } from '../../../game/teams';
import { useT } from '../../../i18n';
import { MAX_PLAYERS, type MemberInfo } from '../../../net/protocol';
import { AvatarImg, AvatarPicker } from '../../components/AvatarImg';
import { SwapTeamIcon, TeamBox } from '../../components/TeamBox';
import { UiIcon } from '../../components/UiIcon';
import './PlayerList.css';

interface Props {
  players: MemberInfo[];
  watchers: MemberInfo[];
  /** this viewer's member id */
  you: string | null;
  isHost: boolean;
  /** 2 vs 2: each player's side (null: no teams) */
  teams: number[] | null;
  /** bots asked for, not seated yet: their seats show already */
  pendingBots: number;
  canAddBot: boolean;
  onAddBot: () => void;
  onKick: (id: string) => void;
  onTeam: (id: string, team: TeamId) => void;
  avatar: string;
  setAvatar: (id: string) => void;
  picking: boolean;
  setPicking: (open: boolean) => void;
}

/** Who is at the table: an avatar card per player, the bots on their way, "+ bot"; in two team boxes for 2 vs 2. */
export function PlayerList(props: Props) {
  const { players, watchers, you, isHost, teams, pendingBots, canAddBot, onAddBot, onKick, onTeam, avatar, setAvatar, picking, setPicking } = props;
  const t = useT();
  const tile = (i: number) => {
    const m = players[i];
    return (
      <PlayerTile
        key={m.id}
        team={teams ? teams[i] : null}
        m={m}
        me={m.id === you}
        picking={picking}
        canKick={isHost && m.id !== you}
        onKick={() => onKick(m.id)}
        onAvatar={() => setPicking(!picking)}
        // the host seats anyone; a guest picks only their own side
        onTeam={isHost || m.id === you ? () => onTeam(m.id, teams?.[i] ? 0 : 1) : undefined}
      />
    );
  };
  const seating = Array.from({ length: pendingBots }, (_, i) => (
    <li className="pl seating" key={`seating-${i}`} aria-hidden>
      <span className="pl-ghost" />
      <span className="pl-name muted">{t('lobby.bot')}</span>
    </li>
  ));
  const addBot = (
    <li className="pl" key="add">
      <button className="pl-add" onClick={onAddBot} aria-label={t('lobby.addBot')}>
        <span aria-hidden>+</span>
      </button>
      <span className="pl-name muted">{t('lobby.bot')}</span>
    </li>
  );
  // the side a new player without a pick would join
  const nextTeam = teamsOf([...players, {}])[players.length];
  const list = (children: ReactNode) => <ul className="players">{children}</ul>;

  return (
    <section className="lb-section" aria-labelledby="lb-players">
      <h2 className="lb-h" id="lb-players">
        {t('lobby.players')} <span className="lb-count">{t('lobby.of', { a: players.length, b: MAX_PLAYERS })}</span>
      </h2>
      {teams ? (
        <div className="team-cols two">
          {([0, 1] as const).map(side => {
            const mine = players.map((_, i) => i).filter(i => teams[i] === side);
            return (
              <TeamBox key={side} team={side} count={mine.length}>
                {/* a new bot joins the side that is short, so its tile waits there */}
                {list(<>{mine.map(tile)}{nextTeam === side && seating}{canAddBot && nextTeam === side && addBot}</>)}
              </TeamBox>
            );
          })}
        </div>
      ) : (
        list(<>{players.map((_, i) => tile(i))}{seating}{canAddBot && addBot}</>)
      )}
      {picking && (
        <AvatarPicker
          value={avatar}
          title={t('lobby.yourAvatar')}
          onChange={id => { setAvatar(id); setPicking(false); }}
          onClose={() => setPicking(false)}
        />
      )}
      {watchers.length > 0 && <p className="lb-note">{t('lobby.watching', { names: watchers.map(w => w.name).join(', ') })}</p>}
    </section>
  );
}

/** One player: avatar card, name under it. The host has a crown; the host can remove anyone else. */
function PlayerTile({ m, me, picking, canKick, onKick, onAvatar, team, onTeam }: {
  m: MemberInfo;
  me: boolean;
  picking: boolean;
  canKick: boolean;
  onKick: () => void;
  onAvatar: () => void;
  team: number | null;
  /** switch to the other team (only when this viewer may) */
  onTeam?: () => void;
}) {
  const t = useT();
  const ava = <AvatarImg id={m.avatar} name={m.name} bot={m.bot} size={56} />;
  const away = !m.bot && !m.connected;
  const sub = away ? t('lobby.offline') : me ? t('lobby.you') : m.bot ? t('lobby.botSub') : m.host ? t('lobby.hostSub') : '';
  return (
    <li className={`pl ${me ? 'me' : ''} ${away ? 'away' : ''}`}>
      <span className="pl-ava-wrap">
        {me ? (
          <button className="pl-ava" onClick={onAvatar} aria-expanded={picking} aria-label={t('home.changeAvatar')} title={t('home.changeAvatar')}>
            {ava}
            <span className="pl-edit" aria-hidden>✎</span>
          </button>
        ) : (
          <span className="pl-ava">{ava}</span>
        )}
        {m.host && <span className="pl-crown" title={t('lobby.hostTitle')} aria-label={t('lobby.hostSub')}><UiIcon name="crown" size={24} /></span>}
        {team !== null && onTeam && (
          <button
            className={`pl-swap to${1 - team}`}
            onClick={onTeam}
            title={t('team.moveTo', { team: teamName(1 - team) })}
            aria-label={t('team.moveAria', { name: m.name, team: teamName(1 - team) })}
          >
            <SwapTeamIcon size={13} />
          </button>
        )}
        {canKick && (
          <button className="pl-kick" onClick={onKick} aria-label={t('lobby.kick', { name: m.name })} title={t('lobby.kickTitle')}>
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
        )}
      </span>
      <span className="pl-name" title={m.name}>{m.name}</span>
      {sub && <span className={`pl-sub ${away ? 'warn' : ''}`}>{sub}</span>}
    </li>
  );
}
