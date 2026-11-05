import qrcode from 'qrcode-generator';
import { LangMenu } from '../components/LangMenu';
import { useEffect, useMemo, useRef, useState } from 'react';
import { teamName, THEMES_LIST } from '../../game/content';
import { lang, render, useT } from '../../i18n';
import { teamsOf, teamsProblem } from '../../game/teams';
import type { Connection } from '../../net/connection';
import { MAX_PLAYERS, type MemberInfo, type RoomInfo } from '../../net/protocol';
import { AvatarImg, AvatarPicker } from '../components/AvatarImg';
import { FitLetter } from '../components/FitLetter';
import { PhoneTip } from '../components/RotateGate';
import { SwipeBack } from '../components/SwipeBack';
import { enterFullscreen } from '../hooks/phone';
import { RulesPanel } from '../settings/RulesPanel';
import { TablePanel } from '../settings/TablePanel';
import { SwapTeamIcon, TeamBox } from '../components/TeamBox';
import { ThemePicker } from '../settings/ThemePicker';
import { usePageTheme } from '../hooks/pageTheme';
import { UiIcon } from '../components/UiIcon';
import './Lobby.css';

interface Props {
  conn: Connection;
  room: RoomInfo;
  onLeave: () => void;
  avatar: string;
  setAvatar: (id: string) => void;
}

export function inviteLink(code: string) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

/**
 * The room before a round, top to bottom: room code + invite, who is here, game mode, start.
 * Individual rules, the QR code and the avatar picker open on demand.
 * The host changes everything; guests get a short read-only summary and a "waiting" line.
 */
export function Lobby({ conn, room: serverRoom, onLeave, avatar, setAvatar }: Props) {
  const t = useT();
  // The server is a round trip away (about half a second on the hosted server), so the host's own changes show
  // at once and the server's next room update confirms them. Each local change is dropped once the server shows it.
  type Mine = Partial<Pick<RoomInfo, 'rules' | 'table' | 'theme'>>;
  const [mine, setMine] = useState<Mine>({});
  useEffect(() => {
    setMine(m => {
      const left = { ...m };
      for (const k of Object.keys(left) as (keyof Mine)[]) if (JSON.stringify(left[k]) === JSON.stringify(serverRoom[k])) delete left[k];
      return Object.keys(left).length === Object.keys(m).length ? m : left;
    });
  }, [serverRoom]);
  // never hold a local change for long (the server may have refused it)
  useEffect(() => {
    if (!Object.keys(mine).length) return;
    const tm = setTimeout(() => setMine({}), 2500);
    return () => clearTimeout(tm);
  }, [mine]);
  const room: RoomInfo = useMemo(() => ({ ...serverRoom, ...mine }), [serverRoom, mine]);
  const change = <K extends keyof Mine>(k: K, v: NonNullable<Mine[K]>) => setMine(m => ({ ...m, [k]: v }));
  // bots asked for but not seated yet: their seats show at once, waiting for the server
  const botsNow = serverRoom.members.filter(m => m.bot).length;
  const [botsWanted, setBotsWanted] = useState(0);
  const pendingBots = Math.max(0, botsWanted - botsNow);
  useEffect(() => {
    if (!pendingBots) return;
    const tm = setTimeout(() => setBotsWanted(0), 2500);
    return () => clearTimeout(tm);
  }, [pendingBots, botsWanted]);
  const me = room.members.find(m => m.id === room.you);
  const isHost = !!me?.host;
  const host = room.members.find(m => m.host);
  const hostName = host?.name ?? t('lobby.host');
  const players = room.members.filter(m => !m.spectator);
  const watchers = room.members.filter(m => m.spectator);
  const [picking, setPicking] = useState(false);
  const theme = THEMES_LIST.find(x => x.id === room.theme);
  // the whole page takes the room's table look, for the host and every guest
  usePageTheme(room.theme);
  // the server tells everyone's side (their pick, or the side that is short)
  const teams = players.map(m => m.team ?? 0);
  const teamsWrong = room.table.teams ? teamsProblem(teams) : null;
  const canStart = isHost && players.length >= 2 && !teamsWrong;
  const canAddBot = isHost && players.length + pendingBots < MAX_PLAYERS;
  // the side a new player without a pick would join
  const nextTeam = teamsOf([...players, {}])[players.length];
  const tile = (i: number) => {
    const m = players[i];
    return (
      <Player
        key={m.id}
        team={room.table.teams ? teams[i] : null}
        m={m}
        me={m.id === room.you}
        picking={picking}
        canKick={isHost && m.id !== room.you}
        onKick={() => conn.send({ t: 'kick', id: m.id })}
        onAvatar={() => setPicking(p => !p)}
        // the host seats anyone; a guest picks only their own side
        onTeam={isHost || m.id === room.you ? () => conn.send({ t: 'team', id: m.id, team: teams[i] ? 0 : 1 }) : undefined}
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
      <button
        className="pl-add"
        onClick={() => {
          setBotsWanted(w => Math.max(w, botsNow) + 1);
          conn.send({ t: 'addBot', lang: lang() });
        }}
        aria-label={t('lobby.addBot')}
      >
        <span aria-hidden>+</span>
      </button>
      <span className="pl-name muted">{t('lobby.bot')}</span>
    </li>
  );
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

        <section className="lb-section" aria-labelledby="lb-players">
          <h2 className="lb-h" id="lb-players">
            {t('lobby.players')} <span className="lb-count">{t('lobby.of', { a: players.length, b: MAX_PLAYERS })}</span>
          </h2>
          {room.table.teams ? (
            <div className="team-cols two">
              {([0, 1] as const).map(side => {
                const mine = players.map((_, i) => i).filter(i => teams[i] === side);
                return (
                  <TeamBox key={side} team={side} count={mine.length}>
                    <ul className="players">
                      {mine.map(tile)}
                      {/* a new bot joins the side that is short, so its tile waits there */}
                      {nextTeam === side && seating}
                      {canAddBot && nextTeam === side && addBot}
                    </ul>
                  </TeamBox>
                );
              })}
            </div>
          ) : (
            <ul className="players">
              {players.map((_, i) => tile(i))}
              {seating}
              {canAddBot && addBot}
            </ul>
          )}
          {picking && (
            <AvatarPicker
              value={avatar}
              title={t('lobby.yourAvatar')}
              onChange={id => { setAvatar(id); setPicking(false); }}
              onClose={() => setPicking(false)}
            />
          )}
          {watchers.length > 0 && (
            <p className="lb-note">
              {t('lobby.watching', { names: watchers.map(w => w.name).join(', ') })}
            </p>
          )}
        </section>
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
        {isHost ? (
          <StartBar canStart={canStart} hint={startHint} onStart={() => conn.send({ t: 'start' })} />
        ) : (
          <p className="lb-waiting">
            <span className="lb-dot" aria-hidden />
            {t('lobby.waiting', { name: hostName })}
          </p>
        )}
      </main>
    </div>
  );
}

/** The host's start button. Sticks to the bottom of the screen when the page is long (rules open, phones). */
function StartBar({ canStart, hint, onStart }: { canStart: boolean; hint: string | null; onStart: () => void }) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    // the bar sits at bottom: -1px, so while it is stuck one pixel of it is out of view
    const io = new IntersectionObserver(([e]) => setStuck(e.intersectionRatio < 1), { threshold: [1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`lb-start ${stuck ? 'stuck' : ''}`}>
      {!canStart && hint && <p className="lb-start-hint">{hint}</p>}
      <button className="btn big start-btn" disabled={!canStart} onClick={() => { void enterFullscreen(); onStart(); }}>{t('lobby.start')}</button>
    </div>
  );
}

/** One player: avatar card, name under it. Host has a crown; the host can remove anyone else. */
function Player({ m, me, picking, canKick, onKick, onAvatar, team, onTeam }: {
  m: MemberInfo; me: boolean; picking: boolean; canKick: boolean; onKick: () => void; onAvatar: () => void; team: number | null;
  /** switch to the other team (only when this viewer may) */
  onTeam?: () => void;
}) {
  const t = useT();
  const ava = <AvatarImg id={m.avatar} name={m.name} bot={m.bot} size={56} />;
  const away = !m.bot && !m.connected;
  const sub = away ? t('lobby.offline') : me ? t('lobby.you') : m.bot ? t('lobby.botSub') : m.host ? t('lobby.hostSub') : '';
  return (
    <li className={`pl ${me ? 'me' : ''} ${!m.bot && !m.connected ? 'away' : ''}`}>
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

const IconLink = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
);
const IconShare = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M6 12v6.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

/** Room code as cards (tap to copy), copy-link / QR / share buttons; the QR code opens on demand. */
function Invite({ code }: { code: string }) {
  const t = useT();
  const link = inviteLink(code);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  // a computer: the QR is out from the start (friends scan it with their phones); a phone: on request
  const [qrOpen, setQrOpen] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 1000px) and (min-height: 521px)').matches);
  const qr = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(link);
    q.make();
    return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  }, [link]);

  const copy = async (text: string, what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard blocked: show the link so it can be copied by hand
      setQrOpen(true);
    }
  };
  const share = () => {
    navigator.share?.({ title: t('app.title'), text: t('lobby.shareText', { code }), url: link }).catch(() => {});
  };

  return (
    <section className="lb-invite" aria-label={t('lobby.room')}>
      <div className="lb-code">
        <span className="lb-label">{copied === 'code' ? t('lobby.codeCopied') : t('lobby.code')}</span>
        <button className="code-tiles small" onClick={() => copy(code, 'code')} aria-label={t('lobby.copyCodeAria', { code })} title={t('lobby.copyCode')}>
          {code.split('').map((ch, i) => <span key={i} className={`tile t${i}`}><FitLetter ch={ch} /></span>)}
        </button>
      </div>
      <div className="lb-invite-btns">
        <button className="btn soft invite-copy" onClick={() => copy(link, 'link')}>
          <IconLink /> {copied === 'link' ? t('lobby.linkCopied') : t('lobby.copyLink')}
        </button>
        <button className={`btn soft ${qrOpen ? 'on' : ''}`} onClick={() => setQrOpen(o => !o)} aria-expanded={qrOpen} aria-label={t('lobby.qr')}>QR</button>
        {'share' in navigator && <button className="btn soft" onClick={share} aria-label={t('lobby.share')} title={t('lobby.share')}><IconShare /></button>}
      </div>
      {qrOpen && (
        <div className="qr-box">
          <div className="qr" aria-label={t('lobby.qrAria')} dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="qr-text">
            <p>{t('lobby.qrHint')}</p>
            <input id="invite-link" className="text-in" readOnly value={link} onFocus={e => e.target.select()} aria-label={t('lobby.linkAria')} />
          </div>
        </div>
      )}
    </section>
  );
}

export function ConnBadge({ conn }: { conn: Connection }) {
  const t = useT();
  const label = conn.status === 'open' ? t('conn.open') : conn.status === 'reconnecting' ? t('conn.reconnecting') : t('conn.connecting');
  return <span className={`conn ${conn.status}`}>{label}</span>;
}
