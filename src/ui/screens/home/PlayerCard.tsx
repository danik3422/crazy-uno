import { useRef, useState, type RefObject } from 'react';
import type { ServerStatus } from '../../../app/useServerCheck';
import { useT } from '../../../i18n';
import { CODE_LEN } from '../../../net/protocol';
import { AvatarImg, AvatarPicker } from '../../components/AvatarImg';
import { UiIcon } from '../../components/UiIcon';
import { CodeTiles } from './CodeTiles';
import { WakePanel } from './WakePanel';
import './PlayerCard.css';

/** a local game left mid-round on this device */
export interface ResumeInfo {
  round: number;
  players: number;
  cards: number | null;
}

export interface PlayerCardProps {
  /** is the game server there and awake (it may be waking up: the free host puts it to sleep) */
  server: ServerStatus;
  name: string;
  setName: (name: string) => void;
  avatar: string;
  setAvatar: (id: string) => void;
  /** the room code from an invite link, or '' */
  invite: string;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLocal: () => void;
  resume: ResumeInfo | null;
  onResume: () => void;
  /** kept by the home screen, so they survive a look at another tab: the code typed so far, the avatar picker open */
  code: string;
  setCode: (code: string) => void;
  picking: boolean;
  setPicking: (open: boolean) => void;
}

/** how long the empty name field shakes when an action needs a name */
const NUDGE_MS = 700;

/**
 * The player's card on the play tab: who you are (avatar and name), then the ways in: carry on a saved game,
 * create or join an online room, or play on one device.
 */
export function PlayerCard(props: PlayerCardProps) {
  const { server, name, invite, error, resume, onResume, onLocal } = props;
  const t = useT();
  const [nudge, setNudge] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  // no game server behind this page at all, or no internet: only the one-device game
  const offline = server.state === 'none' || server.state === 'offline';

  // every online action needs a name: point at the field instead of a dead button
  const withName = (go: () => void) => () => {
    if (name.trim()) return go();
    setNudge(true);
    nameInput.current?.focus();
    setTimeout(() => setNudge(false), NUDGE_MS);
  };

  return (
    <section className="player-card" aria-label={t('home.start')}>
      {invite && server.state === 'up' && (
        <div className="pc-invite">
          <span>{t('home.invited')}</span>
          <b>{invite}</b>
        </div>
      )}
      {error && <div className="pc-error" role="alert">{error}</div>}

      <WhoAmI {...props} nudge={nudge} nameInput={nameInput} />

      {resume && <ResumeButton resume={resume} onResume={onResume} />}

      {offline ? (
        <p className="pc-note">{server.state === 'offline' ? t('home.noInternet') : t('home.offline')}</p>
      ) : (
        <OnlinePanel {...props} withName={withName} />
      )}

      <div className="pc-divider"><span>{t('home.noNet')}</span></div>
      <button className={`btn ${offline ? 'big pc-main' : 'pc-local'}`} onClick={onLocal}>
        <span aria-hidden className="pc-local-ic"><UiIcon name="phone" size={26} /></span> {t('home.local')}
        {!offline && <small>{t('home.localSub')}</small>}
      </button>
    </section>
  );
}

/** The avatar (tap to pick another) and the name field. */
function WhoAmI({ name, setName, avatar, setAvatar, picking, setPicking, nudge, nameInput }: PlayerCardProps & { nudge: boolean; nameInput: RefObject<HTMLInputElement> }) {
  const t = useT();
  return (
    <>
      <div className="pc-profile">
        <button
          type="button"
          className={`pc-ava ${picking ? 'open' : ''}`}
          onClick={() => setPicking(!picking)}
          aria-expanded={picking}
          aria-label={t('home.changeAvatar')}
        >
          <AvatarImg id={avatar} name={name} bot={false} size={92} />
          <span className="pc-ava-edit" aria-hidden>✎</span>
        </button>
        <div className="pc-who">
          <label htmlFor="player-name" className="pc-label">{t('home.nameLabel')}</label>
          <input
            id="player-name"
            ref={nameInput}
            className={`pc-name ${nudge ? 'nudge' : ''}`}
            maxLength={16}
            placeholder={t('home.namePh')}
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus={!name}
            autoComplete="nickname"
          />
        </div>
      </div>
      {picking && (
        <AvatarPicker value={avatar} onChange={id => { setAvatar(id); setPicking(false); }} onClose={() => setPicking(false)} />
      )}
    </>
  );
}

/** A game left mid-round on this device: one tap back to the table. */
function ResumeButton({ resume, onResume }: { resume: ResumeInfo; onResume: () => void }) {
  const t = useT();
  return (
    <button type="button" className="pc-resume" onClick={onResume}>
      <span className="pc-resume-ic" aria-hidden>▶</span>
      <span className="pc-resume-txt">
        <b>{t('resume.title')}</b>
        <small>{resume.cards === null ? t('resume.round', { n: resume.round }) : t('resume.sub', { n: resume.round, cards: resume.cards })}</small>
      </span>
    </button>
  );
}

/**
 * Playing online: create a room, or join one by its code. Invited by a link, the code is filled in and joining
 * comes first, with "create your own" as a small link under it.
 */
function OnlinePanel({ server, invite, busy, onCreate, onJoin, code, setCode, withName }: PlayerCardProps & { withName: (go: () => void) => () => void }) {
  const t = useT();
  const up = server.state === 'up';
  const codeOk = code.length === CODE_LEN;
  const join = withName(() => codeOk && onJoin(code));
  const createLabel = server.state === 'checking' ? t('home.checking') : up ? t('home.create') : t('wake.wait');
  return (
    <div className="pc-online">
      {/* invited: the yellow banner above already says where to; no heading needed */}
      {!invite && (
        <div className="pc-online-head">
          <UiIcon name="players" size={20} />
          <b>{t('home.online')}</b>
          {up && <span className="pc-up"><i aria-hidden />{t('home.serverUp')}</span>}
        </div>
      )}
      <WakePanel server={server} />
      {!invite && (
        <button className="btn big pc-main" disabled={busy || !up} onClick={withName(onCreate)}>
          <span className="pc-main-icon" aria-hidden>＋</span>
          {createLabel}
        </button>
      )}

      <form
        className="pc-join"
        onSubmit={e => {
          e.preventDefault();
          if (up) join();
        }}
      >
        <span className="pc-label">{invite ? t('home.code') : t('home.orJoin')}</span>
        {/* the code and the button side by side (one row on a computer), the button under it when invited */}
        <div className={`pc-join-row ${invite ? 'invited' : ''}`}>
          <CodeTiles value={code} onChange={setCode} />
          <button className={`btn ${invite ? 'big pc-main' : 'big blue pc-join-btn'}`} type="submit" disabled={!codeOk || busy || !up}>
            {invite ? t('home.joinCode', { code }) : t('home.join')}
          </button>
        </div>
      </form>

      {invite && (
        <button className="pc-link" onClick={withName(onCreate)} disabled={busy || !up}>
          {t('home.orCreate')}
        </button>
      )}
    </div>
  );
}
