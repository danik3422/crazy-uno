import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { randomHumanAvatar } from '../game/avatars';
import { render, t, useLang, type Msg } from '../i18n';
import { Game, type LocalSetup } from '../game/engine/Game';
import { Connection, errorLeavesRoom, savedAvatar, savedName } from '../net/connection';
import { CardLoader } from '../ui/components/CardLoader';
import { ErrorBoundary } from '../ui/components/ErrorBoundary';
import { Home } from '../ui/screens/home/Home';
import { ConnBadge } from '../ui/components/ConnBadge';
import { Lobby } from '../ui/screens/lobby/Lobby';
import { Setup } from '../ui/screens/setup/Setup';
import { loadLocalSetup, localGameConfig, saveLocalSetup } from './storage/localSetup';
import { inviteFromUrl, setUrlRoom } from './roomUrl';
import { clearLocalSave, describeSave, readLocalSave, resumeLocal, writeLocalSave } from './storage/localSave';
import { useRemoteGame } from './hooks/useRemoteGame';
import { useServerCheck } from './hooks/useServerCheck';
import { tutorialSetup, type TutorialMode } from '../ui/tutorial/tutorial';
import { exposeDebug } from '../lib/debug';
import { lazyFile } from '../lib/lazyFile';
import './App.css';

type Screen = 'home' | 'local-setup' | 'local-game' | 'online';

/** The 3D table and everything on it (three.js): loaded apart from the menus, so they open faster. */
const loadGameScreen = () => import('../ui/game/GameScreen').then(m => ({ default: m.GameScreen }));
const GameScreen = lazyFile(loadGameScreen);

/** While the table's files are still coming in. */
function TableLoading() {
  return (
    <div className="loading-screen">
      <CardLoader title={t('load.title')} sub={t('home.shuffling')} />
    </div>
  );
}

/**
 * The app shell: which screen is showing, the player's name and avatar,
 * the local (one device) game, and the connection to an online room.
 */
export default function App() {
  const server = useServerCheck();
  const serverUp = server.state === 'up';
  const conn = useMemo(() => new Connection(), []);
  useSyncExternalStore(conn.subscribe, conn.getVersion);
  const [screen, setScreen] = useState<Screen>('home');
  const [name, setNameState] = useState(savedName);
  const [avatar, setAvatarState] = useState(() => savedAvatar() ?? randomHumanAvatar());
  const [invite] = useState(inviteFromUrl);
  useLang(); // the whole app re-renders in a new language
  const [notice, setNotice] = useState<Msg | null>(null);

  // local game
  const [setup, setSetup] = useState<LocalSetup>(loadLocalSetup);
  const [local, setLocal] = useState<Game | null>(null);
  const [localScore, setLocalScore] = useState<Record<string, number>>({});
  // the tutorial: its own setup, hints on for the first round, never saved to resume
  const [tutorial, setTutorial] = useState<{ setup: LocalSetup; coach: boolean } | null>(null);
  useEffect(() => saveLocalSetup(setup), [setup]);
  // the table's files come in once the menu is up and the browser is idle, so starting a game is instant
  useEffect(() => {
    const preload = () => void loadGameScreen().catch(() => undefined);
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(preload, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(preload, 1500);
    return () => window.clearTimeout(id);
  }, []);

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

  // a local game is written to the device as it goes (a reload, a phone that drops the tab), and forgotten
  // when the round ends or the player leaves it
  const [saved, setSaved] = useState(readLocalSave);
  useEffect(() => {
    if (!local || tutorial) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const write = () => {
      timer = null;
      if (local.s.phase === 'over') clearLocalSave();
      else writeLocalSave(local, localScore);
    };
    const off = local.subscribe(() => { if (!timer) timer = setTimeout(write, 400); });
    write();
    const flush = () => { if (document.visibilityState === 'hidden') write(); };
    document.addEventListener('visibilitychange', flush);
    return () => {
      off();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', flush);
    };
  }, [local, localScore, tutorial]);
  // back on the home screen: what is saved now (a game just left, or a new one started)
  useEffect(() => {
    if (screen === 'home') setSaved(readLocalSave());
  }, [screen]);
  const resume = () => {
    const f = saved && resumeLocal(saved);
    if (!f || !saved) return setSaved(null);
    setTutorial(null);
    setLocalScore(saved.score);
    setLocal(f);
    setScreen('local-game');
  };

  const startTutorial = (mode: TutorialMode) => {
    const tut = tutorialSetup(mode, name, avatar);
    setTutorial({ setup: tut, coach: true });
    setLocalScore({});
    setLocal(new Game(localGameConfig(tut, 1)));
    setScreen('local-game');
  };

  // debug: window.__knock('all' | 'one') knocks bots out, here or (on the dev server) in the online room
  useEffect(() => {
    exposeDebug('__knock', (which: 'one' | 'all' = 'all') => {
      if (screen === 'online') conn.send({ t: 'debug', knockout: which });
      else local?.debugKnockOut(which);
    });
  }, [screen, conn, local]);

  const onLocalOver = useCallback((winner: string) => setLocalScore(sc => ({ ...sc, [winner]: (sc[winner] ?? 0) + 1 })), []);

  const goOnline = (enter: () => void) => {
    setNotice(null);
    conn.setName(name.trim());
    conn.open();
    enter();
    setScreen('online');
  };

  /** "Menu" on the crash card: out of whatever broke, back to the start (an online seat is given up) */
  const toMenu = () => {
    if (screen === 'online') return leaveRoom();
    setLocal(null);
    setTutorial(null);
    setScreen('home');
  };

  const view = (): ReactNode => {
    if (screen === 'local-setup') {
      return (
        <Setup
          cfg={setup}
          setCfg={setSetup}
          onBack={() => setScreen('home')}
          onTutorial={startTutorial}
          onStart={() => {
            setTutorial(null);
            setLocal(new Game(localGameConfig(setup, 1)));
            setScreen('local-game');
          }}
        />
      );
    }

    if (screen === 'local-game' && local && tutorial) {
      return (
        <GameScreen
          game={local}
          score={localScore}
          onOver={onLocalOver}
          coach={tutorial.coach}
          onAgain={() => {
            // the next round is an ordinary one: no more hints
            setTutorial({ ...tutorial, coach: false });
            setLocal(new Game(localGameConfig(tutorial.setup, local.s.round + 1)));
          }}
          onMenu={() => { setLocal(null); setTutorial(null); setLocalScore({}); setScreen('home'); }}
        />
      );
    }

    if (screen === 'local-game' && local) {
      return (
        <GameScreen
          game={local}
          score={localScore}
          onOver={onLocalOver}
          onAgain={() => setLocal(new Game(localGameConfig(setup, local.s.round + 1)))}
          onMenu={() => { clearLocalSave(); setSaved(null); setLocal(null); setScreen('local-setup'); }}
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
              title={code ? t('home.joining', { code }) : t('home.creating')}
              sub={conn.status === 'reconnecting' ? t('home.reconnecting') : t('home.shuffling')}
            >
              <button className="btn" onClick={leaveRoom}>{t('cancel')}</button>
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
        server={server}
        name={name}
        setName={setName}
        avatar={avatar}
        setAvatar={setAvatar}
        invite={invite}
        busy={conn.status === 'connecting'}
        error={notice ? render(notice) : null}
        onLocal={() => setScreen('local-setup')}
        onTutorial={startTutorial}
        resume={saved ? describeSave(saved) : null}
        onResume={resume}
        onCreate={() => goOnline(() => conn.create())}
        onJoin={c => goOnline(() => conn.join(c))}
      />
    );
  };

  // a crash anywhere in the screen shows a calm card instead of a blank page (see ErrorBoundary)
  return (
    <ErrorBoundary key={screen} onMenu={toMenu}>
      <Suspense fallback={<TableLoading />}>{view()}</Suspense>
    </ErrorBoundary>
  );
}
