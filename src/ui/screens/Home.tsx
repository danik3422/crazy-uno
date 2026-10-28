import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CODE_LEN, normalizeCode } from '../../net/protocol';
import { AvatarImg, AvatarPicker } from '../components/AvatarImg';
import { FitLetter } from '../components/FitLetter';

const MascotStage = lazy(() => import('../components/MascotStage'));

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
  { icon: '🌪', text: '13 безумных событий' },
  { icon: '🎨', text: '4 темы стола' },
  { icon: '👥', text: 'До 8 игроков' },
  { icon: '🤖', text: 'Боты на любой вкус' },
];

export function Home({ online, name, setName, avatar, setAvatar, invite, busy, error, onCreate, onJoin, onLocal }: Props) {
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
      <section className="home-hero">
        <div className="home-stage">
          <Suspense fallback={null}>
            <MascotStage />
          </Suspense>
        </div>
        <h1 className="logo home-logo" aria-label="Безумное UNO">
          <span className="logo-top">
            {'БЕЗУМНОЕ'.split('').map((ch, i) => <span key={i}>{ch}</span>)}
          </span>
          <span className="logo-uno">UNO</span>
        </h1>
        <p className="home-tag">
          Создай комнату, кинь друзьям ссылку и играйте каждый со своего телефона. С бомбами, фантами и метеоритом на +10.
        </p>
        <ul className="home-chips">
          {FEATURES.map(f => (
            <li key={f.text}><span aria-hidden>{f.icon}</span>{f.text}</li>
          ))}
        </ul>
      </section>

      <section className="player-card" aria-label="Начать игру">
        {invite && online && (
          <div className="pc-invite">
            <span>Тебя позвали в комнату</span>
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
            aria-label="Сменить аватар"
          >
            <AvatarImg id={avatar} name={name} bot={false} size={92} />
            <span className="pc-ava-edit" aria-hidden>✎</span>
          </button>
          <div className="pc-who">
            <label htmlFor="player-name" className="pc-label">Твоё имя за столом</label>
            <input
              id="player-name"
              ref={nameRef}
              className={`pc-name ${nudge ? 'nudge' : ''}`}
              maxLength={16}
              placeholder="Например, Саша"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus={!name}
              autoComplete="nickname"
            />
          </div>
        </div>

        {picking && (
          <div className="pc-picker">
            <AvatarPicker value={avatar} onChange={id => { setAvatar(id); setPicking(false); }} />
          </div>
        )}

        {offline ? (
          <p className="pc-note">
            Онлайн-комнатам нужен игровой сервер, а эта страница открыта без него. Здесь можно играть на одном устройстве.
          </p>
        ) : (
          <>
            {!invite && (
              <button className="btn big pc-main" disabled={busy || !online} onClick={need(onCreate)}>
                <span className="pc-main-icon" aria-hidden>＋</span>
                {online === null ? 'Проверяем сервер…' : 'Создать комнату'}
              </button>
            )}

            <form
              className="pc-join"
              onSubmit={e => {
                e.preventDefault();
                if (online) join();
              }}
            >
              <span className="pc-label">{invite ? 'Код комнаты' : 'Или войди по коду друга'}</span>
              <CodeTiles value={code} onChange={setCode} />
              <button
                className={`btn ${invite ? 'big pc-main' : 'big blue'}`}
                type="submit"
                disabled={!codeOk || busy || !online}
              >
                {invite ? `Войти в комнату ${code}` : 'Войти'}
              </button>
            </form>

            {invite && (
              <button className="pc-link" onClick={need(onCreate)} disabled={busy || !online}>
                или создать свою комнату
              </button>
            )}
          </>
        )}

        <div className="pc-divider"><span>без интернета</span></div>
        <button className={`btn ${offline ? 'big pc-main' : 'pc-local'}`} onClick={onLocal}>
          <span aria-hidden>📱</span> Играть на одном устройстве
          {!offline && <small>все рядом, телефон по кругу</small>}
        </button>
      </section>
    </div>
  );
}

/** Four coloured card-tiles over one real input: type, paste or tap to edit. */
function CodeTiles({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        aria-label="Код комнаты из 4 букв"
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => onChange(normalizeCode(e.target.value))}
      />
    </div>
  );
}
