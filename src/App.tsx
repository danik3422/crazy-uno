import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_RULES } from './game/content';
import { Game } from './game/engine';
import type { Rules, Table, ThemeId } from './game/types';
import { randomHumanAvatar } from './game/avatars';
import { Connection, savedAvatar, savedName } from './net/connection';
import { normalizeCode } from './net/protocol';
import { RemoteGame } from './net/remoteGame';
import { GameScreen } from './ui/GameScreen';
import { Home } from './ui/Home';
import { CardLoader } from './ui/CardLoader';
import { ConnBadge, Lobby } from './ui/Lobby';
import { Setup } from './ui/Setup';

export interface Config {
  players: { name: string; bot: boolean; avatar?: string }[];
  rules: Rules;
  theme?: ThemeId;
  table?: Table;
}

const CFG_KEY = 'crazy-uno-cfg-v2';
function loadCfg(): Config {
  try {
    const c = JSON.parse(localStorage.getItem(CFG_KEY) ?? 'null');
    if (c && Array.isArray(c.players)) return { players: c.players, rules: { ...DEFAULT_RULES, ...c.rules } };
  } catch { /* storage unavailable */ }
  return {
    players: [{ name: 'Я', bot: false }, { name: 'Бот Валера', bot: true }, { name: 'Бот Зинаида', bot: true }],
    rules: { ...DEFAULT_RULES },
  };
}

type Screen = 'home' | 'local-setup' | 'local-game' | 'online';

const inviteFromUrl = () => normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
function setUrlRoom(code: string | null) {
  try {
    const u = new URL(location.href);
    if (code) u.searchParams.set('room', code);
    else u.searchParams.delete('room');
    history.replaceState(null, '', u);
  } catch { /* sandboxed frames may refuse; the code is still on screen */ }
}

/** Is there a game server behind this page? (Not when opened as a file or a static artifact.) */
function useServerCheck() {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!/^https?:$/.test(location.protocol)) return setOk(false);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2500);
    fetch('/api/health', { signal: ctrl.signal, cache: 'no-store' })
      .then(r => r.json())
      .then(j => setOk(!!j?.ok))
      .catch(() => setOk(false))
      .finally(() => clearTimeout(t));
    return () => ctrl.abort();
  }, []);
  return ok;
}

export default function App() {
  const online = useServerCheck();
  const conn = useMemo(() => new Connection(), []);
  useSyncExternalStore(conn.subscribe, conn.getVersion);
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setNameState] = useState(savedName);
  const [avatar, setAvatarState] = useState(() => savedAvatar() ?? randomHumanAvatar());
  const [invite] = useState(inviteFromUrl);
  const [notice, setNotice] = useState<string | null>(null);

  // local game
  const [cfg, setCfg] = useState<Config>(loadCfg);
  const [local, setLocal] = useState<Game | null>(null);
  const [localScore, setLocalScore] = useState<Record<string, number>>({});
  useEffect(() => {
    try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, [cfg]);

  const setName = (n: string) => {
    setNameState(n);
    conn.setName(n.trim());
  };
  const setAvatar = (id: string) => {
    setAvatarState(id);
    conn.setAvatar(id);
  };
  useEffect(() => {
    if (!conn.avatar) conn.setAvatar(avatar);
  }, [conn, avatar]);

  // Back into the room after a reload: we still hold a seat token.
  useEffect(() => {
    if (!online || !conn.session) return;
    if (invite && invite !== conn.session.code) return; // the link points somewhere else
    setScreen('online');
    conn.open();
  }, [online, conn, invite]);

  // Keep the address bar pointing at the room, so a reload or a copied URL works.
  const code = conn.room?.code ?? null;
  useEffect(() => {
    if (screen === 'online' && code) setUrlRoom(code);
  }, [screen, code]);

  // Errors that throw us out of the room.
  const err = conn.error;
  useEffect(() => {
    if (!err) return;
    // errors that leave us without a room take us back to the start screen
    if (err.code === 'no-room' || err.code === 'kicked' || err.code === 'replaced' || ((err.code === 'slow-down' || err.code === 'full') && !conn.room)) {
      setNotice(err.msg);
      setScreen('home');
      setUrlRoom(null);
    } else setNotice(err.msg);
    conn.clearError();
  }, [err, conn]);

  // One RemoteGame per round; updates in between keep its identity (and its effects queue).
  const remote = useRef<RemoteGame | null>(null);
  const view = conn.view;
  if (!view) remote.current = null;
  else if (!remote.current || remote.current.s.round !== view.state.round) {
    const fresh = !!remote.current || view.state.turn <= 1;
    remote.current = new RemoteGame(conn, view, conn.viewNow, fresh);
  } else if (remote.current.src !== view) remote.current.apply(view, conn.viewNow);

  const leaveRoom = useCallback(() => {
    conn.leave();
    remote.current = null;
    setUrlRoom(null);
    setScreen('home');
  }, [conn]);

  const onLocalOver = useCallback((w: string) => setLocalScore(sc => ({ ...sc, [w]: (sc[w] ?? 0) + 1 })), []);

  if (screen === 'local-setup') {
    return (
      <Setup
        cfg={cfg}
        setCfg={setCfg}
        onBack={() => setScreen('home')}
        onStart={() => {
          setLocal(new Game({ ...cfg, round: 1 }));
          setScreen('local-game');
        }}
      />
    );
  }

  if (screen === 'local-game' && local) {
    return (
      <GameScreen
        game={local}
        score={localScore}
        onOver={onLocalOver}
        onAgain={() => setLocal(new Game({ ...cfg, round: local.s.round + 1 }))}
        onMenu={() => { setLocal(null); setScreen('local-setup'); }}
      />
    );
  }

  if (screen === 'online') {
    const room = conn.room;
    if (!room) {
      const code = conn.session?.code ?? invite;
      return (
        <div className="loading-screen">
          <CardLoader
            title={code ? `Заходим в комнату ${code}` : 'Создаём комнату'}
            sub={conn.status === 'reconnecting' ? 'Связь пропала, пробуем ещё раз…' : 'Тасуем колоду и ставим стулья'}
          >
            <button className="btn" onClick={leaveRoom}>Отмена</button>
          </CardLoader>
        </div>
      );
    }
    const me = room.members.find(m => m.id === room.you);
    if (room.started && remote.current) {
      return (
        <>
          <GameScreen
            game={remote.current}
            score={room.score}
            onAgain={() => conn.send({ t: 'again' })}
            onMenu={leaveRoom}
            online={{
              code: room.code,
              isHost: !!me?.host,
              spectator: remote.current.you === null,
              onLobby: () => conn.send({ t: 'toLobby' }),
              me: room.you,
              members: room.members,
              rematch: room.rematch,
              roomAt: conn.roomAt,
              onVote: ready => conn.send({ t: 'again', off: !ready }),
              onForce: () => conn.send({ t: 'again', force: true }),
            }}
          />
          {conn.status !== 'open' && <div className="net-banner"><ConnBadge conn={conn} /></div>}
        </>
      );
    }
    return <Lobby conn={conn} room={room} onLeave={leaveRoom} avatar={avatar} setAvatar={setAvatar} />;
  }

  return (
    <Home
      online={online}
      name={name}
      setName={setName}
      avatar={avatar}
      setAvatar={setAvatar}
      invite={invite}
      busy={conn.status === 'connecting'}
      error={notice}
      onLocal={() => setScreen('local-setup')}
      onCreate={() => {
        setNotice(null);
        conn.setName(name.trim());
        conn.open();
        conn.create();
        setScreen('online');
      }}
      onJoin={c => {
        setNotice(null);
        conn.setName(name.trim());
        conn.open();
        conn.join(c);
        setScreen('online');
      }}
    />
  );
}
