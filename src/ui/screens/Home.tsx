import { Suspense, useEffect, useRef, useState } from 'react';
import { lazyFile } from '../../lib/lazyFile';
import { CODE_LEN, normalizeCode } from '../../net/protocol';
import { AvatarImg, AvatarPicker } from '../components/AvatarImg';
import { FitLetter } from '../components/FitLetter';
import { LangSwitch } from '../components/LangSwitch';
import { UiIcon } from '../components/UiIcon';
import { useT } from '../../i18n';
import './Home.css';

const MascotStage = lazyFile(() => import('../components/MascotStage'));

interface Props {
  /** null while we check whether a game server is reachable */
  online: boolean | null;
  name: string;
  setName: (n: string) => void;
  avatar: string;
  setAvatar: (id: string) => void;
  invite: string;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLocal: () => void;
}

const FEATURES = [
  { icon: 'events', key: 'home.feat.events' },
  { icon: 'themes', key: 'home.feat.themes' },
  { icon: 'players', key: 'home.feat.players' },
  { icon: 'robot', key: 'home.feat.bots' },
] as const;

export function Home({ online, name, setName, avatar, setAvatar, invite, busy, error, onCreate, onJoin, onLocal }: Props) {
  const t = useT();
  const [code, setCode] = useState(invite);
  const [picking, setPicking] = useState(false);
  const [nudge, setNudge] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const named = name.trim().length > 0;
  const codeOk = code.length === CODE_LEN;
  const offline = online === false;

  // every action needs a name: point at the field instead of a dead button
  const need = (go: () => void) => () => {
    if (named) return go();
    setNudge(true);
    nameRef.current?.focus();
    setTimeout(() => setNudge(false), 700);
  };
  const join = need(() => codeOk && onJoin(code));

  return (
    <div className="home">
      <LangSwitch className="home-lang" />
      <section className="home-hero">
        <div className="home-stage">
          <Suspense fallback={null}>
            <MascotStage />
          </Suspense>
        </div>
        <h1 className="logo home-logo" aria-label={t('app.title')}>
          <span className="logo-top">
            {t('app.top').split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </span>
          <span className="logo-uno">UNO</span>
        </h1>
        <p className="home-tag">
          {t('home.tag')}
        </p>
        <ul className="home-chips">
          {FEATURES.map(f => (
            <li key={f.key}><UiIcon name={f.icon} size={20} />{t(f.key)}</li>
          ))}
        </ul>
      </section>

      <section className="player-card" aria-label={t('home.start')}>
        {invite && online && (
          <div className="pc-invite">
            <span>{t('home.invited')}</span>
            <b>{invite}</b>
          </div>
        )}
        {error && <div className="pc-error" role="alert">{error}</div>}

        <div className="pc-profile">
          <button
            type="button"
            className={`pc-ava ${picking ? 'open' : ''}`}
            onClick={() => setPicking(p => !p)}
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
              ref={nameRef}
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

        {offline ? (
          <p className="pc-note">
            {typeof navigator !== 'undefined' && navigator.onLine === false ? t('home.noInternet') : t('home.offline')}
          </p>
        ) : (
          <>
            {!invite && (
              <button className="btn big pc-main" disabled={busy || !online} onClick={need(onCreate)}>
                <span className="pc-main-icon" aria-hidden>＋</span>
                {online === null ? t('home.checking') : t('home.create')}
              </button>
            )}

            <form
              className="pc-join"
              onSubmit={e => {
                e.preventDefault();
                if (online) join();
              }}
            >
              <span className="pc-label">{invite ? t('home.code') : t('home.orJoin')}</span>
              <CodeTiles value={code} onChange={setCode} />
              <button
                className={`btn ${invite ? 'big pc-main' : 'big blue'}`}
                type="submit"
                disabled={!codeOk || busy || !online}
              >
                {invite ? t('home.joinCode', { code }) : t('home.join')}
              </button>
            </form>

            {invite && (
              <button className="pc-link" onClick={need(onCreate)} disabled={busy || !online}>
                {t('home.orCreate')}
              </button>
            )}
          </>
        )}

        <div className="pc-divider"><span>{t('home.noNet')}</span></div>
        <button className={`btn ${offline ? 'big pc-main' : 'pc-local'}`} onClick={onLocal}>
          <span aria-hidden className="pc-local-ic"><UiIcon name="phone" size={26} /></span> {t('home.local')}
          {!offline && <small>{t('home.localSub')}</small>}
        </button>
      </section>
    </div>
  );
}

/** Four coloured card-tiles over one real input: type, paste or tap to edit. */
function CodeTiles({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (value.length === CODE_LEN) ref.current?.blur();
  }, [value]);
  return (
    <div className={`code-tiles-in ${focused ? 'focus' : ''}`} onClick={() => ref.current?.focus()}>
      {Array.from({ length: CODE_LEN }, (_, i) => (
        <span
          key={i}
          className={`ct t${i} ${value[i] ? 'filled' : ''} ${focused && i === Math.min(value.length, CODE_LEN - 1) ? 'caret' : ''}`}
          aria-hidden
        >
          {value[i] ? <FitLetter ch={value[i]} /> : null}
        </span>
      ))}
      <input
        id="room-code"
        ref={ref}
        className="ct-input"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        aria-label={t('home.codeAria')}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(normalizeCode(e.target.value))}
      />
    </div>
  );
}
