import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { randomHumanAvatar } from '../game/avatars';
import { Game, type LocalSetup } from '../game/engine';
import { Connection, errorLeavesRoom, savedAvatar, savedName } from '../net/connection';
import { CardLoader } from '../ui/components/CardLoader';
import { GameScreen } from '../ui/game/GameScreen';
import { Home } from '../ui/screens/Home';
import { ConnBadge, Lobby } from '../ui/screens/Lobby';
import { Setup } from '../ui/screens/Setup';
import { loadLocalSetup, saveLocalSetup } from './localSetup';
import { inviteFromUrl, setUrlRoom } from './roomUrl';
import { useRemoteGame } from './useRemoteGame';
import { useServerCheck } from './useServerCheck';

type Screen = 'home' | 'local-setup' | 'local-game' | 'online';

/**
 * The app shell: which screen is showing, the player's name and avatar,
 * the local (one device) game, and the connection to an online room.
 */
export default function App() {
  const serverUp = useServerCheck();
  const conn = useMemo(() => new Connection(), []);
  useSyncExternalStore(conn.subscribe, conn.getVersion);
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setNameState] = useState(savedName);
  const [avatar, setAvatarState] = useState(() => savedAvatar() ?? randomHumanAvatar());
  const [invite] = useState(inviteFromUrl);
  const [notice, setNotice] = useState<string | null>(null);

  // local game
  const [setup, setSetup] = useState<LocalSetup>(loadLocalSetup);
  const [local, setLocal] = useState<Game | null>(null);
  const [localScore, setLocalScore] = useState<Record<string, number>>({});
  useEffect(() => saveLocalSetup(setup), [setup]);

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
    if (!serverUp || !conn.session) return;
    if (invite && invite !== conn.session.code) return; // the link points somewhere else
    setScreen('online');
    conn.open();
  }, [serverUp, conn, invite]);

  // Keep the address bar pointing at the room, so a reload or a copied URL works.
  const code = conn.room?.code ?? null;
  useEffect(() => {
    if (screen === 'online' && code) setUrlRoom(code);
  }, [screen, code]);

  // Server errors: shown on screen; the ones that cost us our seat take us back to the start.
  const err = conn.error;
  useEffect(() => {
    if (!err) return;
    setNotice(err.msg);
    if (errorLeavesRoom(err.code, !!conn.room)) {
      setScreen('home');
      setUrlRoom(null);
    }
    conn.clearError();
  }, [err, conn]);

  const remote = useRemoteGame(conn);

  const leaveRoom = useCallback(() => {
    conn.leave();
    remote.current = null;
    setUrlRoom(null);
    setScreen('home');
  }, [conn, remote]);

  const onLocalOver = useCallback((winner: string) => setLocalScore(sc => ({ ...sc, [winner]: (sc[winner] ?? 0) + 1 })), []);

  const goOnline = (enter: () => void) => {
    setNotice(null);
    conn.setName(name.trim());
    conn.open();
    enter();
    setScreen('online');
  };

  if (screen === 'local-setup') {
    return (
      <Setup
        cfg={setup}
        setCfg={setSetup}
        onBack={() => setScreen('home')}
        onStart={() => {
          setLocal(new Game({ ...setup, round: 1 }));
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
        onAgain={() => setLocal(new Game({ ...setup, round: local.s.round + 1 }))}
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
      online={serverUp}
      name={name}
      setName={setName}
      avatar={avatar}
      setAvatar={setAvatar}
      invite={invite}
      busy={conn.status === 'connecting'}
      error={notice}
      onLocal={() => setScreen('local-setup')}
      onCreate={() => goOnline(() => conn.create())}
      onJoin={c => goOnline(() => conn.join(c))}
    />
  );
}
