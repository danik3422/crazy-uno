import { useEffect, useState } from 'react';
import { useT } from '../../i18n';
import type { MemberInfo, Rematch } from '../../net/protocol';
import { AvatarImg } from '../components/AvatarImg';
import './RematchVote.css';

interface Props {
  me: string;
  members: MemberInfo[];
  rematch: Rematch | null;
  /** when the last room message arrived (local clock), to run the countdown */
  receivedAt: number;
  isHost: boolean;
  onVote: (ready: boolean) => void;
  onForce: () => void;
  onLobby: () => void;
  onLeave: () => void;
}

/** After a round: everybody presses "Play again"; when all have, a 5-second countdown starts the next round. */
export function RematchVote({ me, members, rematch, receivedAt, isHost, onVote, onForce, onLobby, onLeave }: Props) {
  const t = useT();
  const ready = new Set(rematch?.ready ?? []);
  const iAmReady = ready.has(me);
  const people = members.filter(m => !m.bot);
  const waitingNames = members.filter(m => rematch?.waiting.includes(m.id)).map(m => m.name);
  const startAt = rematch?.startsIn != null ? receivedAt + rematch.startsIn : null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (startAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [startAt]);
  const left = startAt === null ? null : Math.max(0, Math.ceil((startAt - now) / 1000));

  return (
    <div className="rematch">
      <ul className="rematch-list" aria-label={t('rm.list')}>
        {people.map(m => {
          const ok = ready.has(m.id);
          const away = !m.connected;
          return (
            <li key={m.id} className={ok ? 'ok' : away ? 'away' : ''}>
              <AvatarImg id={m.avatar} name={m.name} bot={false} size={30} />
              <span className="rm-name">{m.name}{m.id === me ? t('rm.you') : ''}</span>
              <span className="rm-st">{ok ? t('rm.ready') : away ? t('rm.away') : <><span className="dot-pulse" /> {t('rm.thinking')}</>}</span>
            </li>
          );
        })}
      </ul>

      {left !== null ? (
        <div className="rematch-count" aria-live="polite">
          <span>{t('rm.startsIn')}</span>
          <b key={left}>{left}</b>
        </div>
      ) : (
        <p className="muted small rematch-hint" aria-live="polite">
          {iAmReady
            ? waitingNames.length ? t('rm.waitFor', { names: waitingNames.join(', ') }) : t('rm.allReady')
            : t('rm.whenAll')}
        </p>
      )}

      <div className="row center">
        {iAmReady ? (
          <button className="btn" onClick={() => onVote(false)}>{t('rm.cancel')}</button>
        ) : (
          <button className="btn big" autoFocus onClick={() => onVote(true)}>{t('ov.again')}</button>
        )}
        {isHost && left === null && iAmReady && waitingNames.length > 0 && (
          <button className="btn big blue" onClick={onForce}>{t('rm.force')}</button>
        )}
      </div>
      <div className="row center rematch-sub">
        {isHost && <button className="btn" onClick={onLobby}>{t('rm.lobby')}</button>}
        <button className="btn" onClick={onLeave}>{t('rm.leave')}</button>
      </div>
    </div>
  );
}
