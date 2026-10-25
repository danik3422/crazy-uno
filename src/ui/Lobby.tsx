import qrcode from 'qrcode-generator';
import { useEffect, useMemo, useRef, useState } from 'react';
import { THEMES_LIST } from '../game/content';
import type { Connection } from '../net/connection';
import { MAX_PLAYERS, type MemberInfo, type RoomInfo } from '../net/protocol';
import { AvatarImg, AvatarPicker } from './AvatarImg';
import { FitLetter } from './FitLetter';
import { TEAM_NAMES, teamsProblem } from '../game/content';
import { RulesPanel } from './RulesPanel';
import { TablePanel } from './TablePanel';
import { ThemePicker } from './ThemePicker';

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
export function Lobby({ conn, room, onLeave, avatar, setAvatar }: Props) {
  const me = room.members.find(m => m.id === room.you);
  const isHost = !!me?.host;
  const host = room.members.find(m => m.host);
  const hostName = host?.name ?? 'хост';
  const players = room.members.filter(m => !m.spectator);
  const watchers = room.members.filter(m => m.spectator);
  const [picking, setPicking] = useState(false);
  const theme = THEMES_LIST.find(t => t.id === room.theme);
  // teams alternate in seat order, so the list shows exactly who plays with whom
  const teamsWrong = room.table.teams ? teamsProblem(players.length) : null;
  const canStart = isHost && players.length >= 2 && !teamsWrong;
  const startHint = players.length < 2 ? 'Нужен ещё хотя бы один игрок: позови друга или добавь бота.' : teamsWrong ? `${teamsWrong}: добавь бота или выключи «2 на 2».` : null;

  return (
    <div className={`lobby page-${room.theme}`}>
      <header className="lobby-top">
        <button className="btn ghost back" onClick={onLeave}>← Выйти</button>
        <ConnBadge conn={conn} />
      </header>

      <main className="lobby-card">
        <Invite code={room.code} />

        <section className="lb-section" aria-labelledby="lb-players">
          <h2 className="lb-h" id="lb-players">
            Игроки <span className="lb-count">{players.length} из {MAX_PLAYERS}</span>
          </h2>
          <ul className="players">
            {players.map((m, i) => (
              <Player
                key={m.id}
                team={room.table.teams ? i % 2 : null}
                m={m}
                me={m.id === room.you}
                picking={picking}
                canKick={isHost && m.id !== room.you}
                onKick={() => conn.send({ t: 'kick', id: m.id })}
                onAvatar={() => setPicking(p => !p)}
              />
            ))}
            {isHost && players.length < MAX_PLAYERS && (
              <li className="pl">
                <button className="pl-add" onClick={() => conn.send({ t: 'addBot' })} aria-label="Добавить бота">
                  <span aria-hidden>+</span>
                </button>
                <span className="pl-name muted">Бот</span>
              </li>
            )}
          </ul>
          {picking && (
            <div className="lb-picker">
              <span className="lb-label">Твой аватар</span>
              <AvatarPicker value={avatar} onChange={id => { setAvatar(id); setPicking(false); }} />
            </div>
          )}
          {watchers.length > 0 && (
            <p className="lb-note">
              Смотрят: {watchers.map(w => w.name).join(', ')}. Сядут за стол в следующем раунде.
            </p>
          )}
        </section>

        <section className="lb-section" aria-labelledby="lb-mode">
          <h2 className="lb-h" id="lb-mode">Режим игры</h2>
          <RulesPanel rules={room.rules} onChange={isHost ? rules => conn.send({ t: 'rules', rules }) : undefined} />
        </section>

        <section className="lb-section" aria-labelledby="lb-format">
          <h2 className="lb-h" id="lb-format">Формат</h2>
          <TablePanel table={room.table} players={players.length} onChange={isHost ? table => conn.send({ t: 'table', table }) : undefined} />
        </section>

        <section className="lb-section lb-theme" aria-labelledby="lb-theme">
          <h2 className="lb-h" id="lb-theme">
            Стол {!isHost && <span className="lb-count">{theme?.name}</span>}
          </h2>
          {isHost && <ThemePicker compact value={room.theme} onChange={t => conn.send({ t: 'theme', theme: t })} />}
        </section>

        {isHost ? (
          <StartBar canStart={canStart} hint={startHint} onStart={() => conn.send({ t: 'start' })} />
        ) : (
          <p className="lb-waiting">
            <span className="lb-dot" aria-hidden />
            Ждём, когда {hostName} начнёт игру
          </p>
        )}
      </main>
    </div>
  );
}

/** The host's start button. Sticks to the bottom of the screen when the page is long (rules open, phones). */
function StartBar({ canStart, hint, onStart }: { canStart: boolean; hint: string | null; onStart: () => void }) {
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
      <button className="btn big start-btn" disabled={!canStart} onClick={onStart}>Начать игру</button>
    </div>
  );
}

/** One player: avatar card, name under it. Host has a crown; the host can remove anyone else. */
function Player({ m, me, picking, canKick, onKick, onAvatar, team }: {
  m: MemberInfo; me: boolean; picking: boolean; canKick: boolean; onKick: () => void; onAvatar: () => void; team: number | null;
}) {
  const ava = <AvatarImg id={m.avatar} name={m.name} bot={m.bot} size={56} />;
  const sub = !m.bot && !m.connected ? 'нет связи' : me ? 'это ты' : m.bot ? 'бот' : m.host ? 'хост' : '';
  return (
    <li className={`pl ${me ? 'me' : ''} ${!m.bot && !m.connected ? 'away' : ''} ${team !== null ? `team-${team}` : ''}`}>
      <span className="pl-ava-wrap">
        {me ? (
          <button className="pl-ava" onClick={onAvatar} aria-expanded={picking} aria-label="Сменить аватар" title="Сменить аватар">
            {ava}
            <span className="pl-edit" aria-hidden>✎</span>
          </button>
        ) : (
          <span className="pl-ava">{ava}</span>
        )}
        {m.host && <span className="pl-crown" title="Хост" aria-label="хост">👑</span>}
        {canKick && (
          <button className="pl-kick" onClick={onKick} aria-label={`Убрать ${m.name}`} title="Убрать из комнаты">
            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
          </button>
        )}
      </span>
      {team !== null && <span className={`pl-team t${team}`}>{TEAM_NAMES[team]}</span>}
      <span className="pl-name" title={m.name}>{m.name}</span>
      {sub && <span className={`pl-sub ${sub === 'нет связи' ? 'warn' : ''}`}>{sub}</span>}
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
  const link = inviteLink(code);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
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
    navigator.share?.({ title: 'Безумное UNO', text: `Залетай в UNO! Код комнаты: ${code}`, url: link }).catch(() => {});
  };

  return (
    <section className="lb-invite" aria-label="Комната">
      <div className="lb-code">
        <span className="lb-label">{copied === 'code' ? 'Код скопирован ✓' : 'Код комнаты'}</span>
        <button className="code-tiles small" onClick={() => copy(code, 'code')} aria-label={`Код комнаты ${code}, скопировать`} title="Скопировать код">
          {code.split('').map((ch, i) => <span key={i} className={`tile t${i}`}><FitLetter ch={ch} /></span>)}
        </button>
      </div>
      <div className="lb-invite-btns">
        <button className="btn soft invite-copy" onClick={() => copy(link, 'link')}>
          <IconLink /> {copied === 'link' ? 'Ссылка скопирована' : 'Скопировать ссылку'}
        </button>
        <button className={`btn soft ${qrOpen ? 'on' : ''}`} onClick={() => setQrOpen(o => !o)} aria-expanded={qrOpen} aria-label="QR-код">QR</button>
        {'share' in navigator && <button className="btn soft" onClick={share} aria-label="Поделиться" title="Поделиться"><IconShare /></button>}
      </div>
      {qrOpen && (
        <div className="qr-box">
          <div className="qr" aria-label="QR-код со ссылкой на комнату" dangerouslySetInnerHTML={{ __html: qr }} />
          <div className="qr-text">
            <p>Наведи камеру телефона, и откроется комната.</p>
            <input id="invite-link" className="text-in" readOnly value={link} onFocus={e => e.target.select()} aria-label="Ссылка-приглашение" />
          </div>
        </div>
      )}
    </section>
  );
}

export function ConnBadge({ conn }: { conn: Connection }) {
  const label = conn.status === 'open' ? 'В сети' : conn.status === 'reconnecting' ? 'Переподключаемся…' : 'Подключаемся…';
  return <span className={`conn ${conn.status}`}>{label}</span>;
}
