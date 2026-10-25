import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { sound } from '../audio/sound';
import { Game } from '../game/engine';
import type { GameView } from '../game/view';
import { DEAL_STEP_MS, SHUFFLE_MS, dealMs } from '../net/protocol';
import { RemoteGame } from '../net/remoteGame';
import { BOMB_FALL, BOMB_RELEASE, METEOR_FALL, SPIN_TIME, fxState, nowSec, shake, summonMascot } from '../three/fxState';
import { lastPlace, spawn } from '../three/layout';
import { GameScene } from '../three/Scene';
import { useGlRecovery } from '../three/useGlRecovery';
import { AvatarImg } from './AvatarImg';
import { CardLoader } from './CardLoader';
import { EventBanner, type Banner } from './EventBanner';
import { Hud, type Toast } from './Hud';
import { useKeyboardPlay } from './useKeyboardPlay';
import { RotateGate } from './RotateGate';
import { Overlays, type OnlineCtx } from './Overlays';

interface Props {
  game: GameView;
  score: Record<string, number>;
  onAgain: () => void;
  onMenu: () => void;
  /** called once per finished round with the winner's name (local games keep their own score) */
  onOver?: (winner: string) => void;
  online?: OnlineCtx;
}

/** The 3D table plus HUD. Plays effects for any game; drives bots and timers only for local games. */
export function GameScreen({ game, score, onAgain, onMenu, onOver, online }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [flash, setFlash] = useState(0);
  // the white flash (lightning, meteor) is shown for half a second and then removed for good
  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setFlashOn(true);
    const t = setTimeout(() => setFlashOn(false), 500);
    return () => clearTimeout(t);
  }, [flash]);
  const version = useSyncExternalStore(game.subscribe, game.getVersion);
  const lastFx = useRef<{ game: GameView | null; id: number }>({ game: null, id: 0 });
  const scored = useRef<GameView | null>(null);
  const local = game instanceof Game ? game : null;
  const { glKey, onCreated } = useGlRecovery();

  const toast = useCallback((text: string, big = false) => {
    const id = Math.random();
    setToasts(t => [...t.slice(-2), { id, text, big }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 1900);
  }, []);

  if (import.meta.env.DEV) (window as unknown as { __uno?: GameView }).__uno = game;

  useEffect(() => () => { fxState.upsideUntil = 0; }, []);

  /*
   * Round start: 'loading' until this screen (and, online, every screen) has drawn the table,
   * then 'dealing' while the cards fly out, then 'play'. Nobody can move before 'play'.
   */
  const [stage, setStage] = useState<'loading' | 'dealing' | 'play'>('loading');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useLayoutEffect(() => {
    fxState.dealAt = Infinity;
    fxState.dealEnd = Infinity;
    // card ids start over every round: forget where last round's cards were
    lastPlace.clear();
    setStage('loading');
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [game]);

  const startDeal = useCallback((at: number, end: number) => {
    if (Number.isFinite(fxState.dealAt)) return;
    fxState.dealAt = at;
    fxState.dealEnd = end;
    const now = nowSec();
    const later = (sec: number, f: () => void) => timers.current.push(setTimeout(f, Math.max(0, sec - now) * 1000));
    if (end <= now) {
      // joined late (reconnect): no show, straight to the table
      setStage('play');
      return;
    }
    // the loading curtain lifts on the shuffle, two riffles with their own sound, then the deal
    const shuffleAt = at - SHUFFLE_MS / 1000;
    later(shuffleAt - 0.55, () => setStage('dealing')); // the curtain is gone before the first cut
    later(shuffleAt + 0.35, () => sound.play('shuffle'));
    later(shuffleAt + 1.25, () => sound.play('shuffle'));
    // a soft flick for every few cards as they leave the deck
    const flicks = Math.floor(((end - at) * 1000 - 900) / (DEAL_STEP_MS * 3));
    for (let i = 1; i <= flicks; i++) later(at + 0.8 + (i * DEAL_STEP_MS * 3) / 1000, () => sound.play('draw'));
    later(end, () => {
      setStage('play');
      summonMascot('fly', 1.2);
    });
  }, []);

  const onSceneReady = useCallback(() => {
    if (game instanceof RemoteGame) return game.ready();
    const ms = dealMs(game.s.players.length, game.s.table.handSize);
    const at = nowSec() + 0.6 + SHUFFLE_MS / 1000;
    local?.holdClock(ms + 600 + SHUFFLE_MS);
    startDeal(at, at + ms / 1000);
  }, [game, local, startDeal]);

  // online: the server says when the deal starts for everybody
  const warm = game instanceof RemoteGame ? game.warmup : null;
  useEffect(() => {
    if (!warm || warm.dealAt === null || warm.dealEnd === null) return;
    // server ms -> this screen's animation clock
    const toPerf = (ms: number) => nowSec() + (ms - game.clockOffset - Date.now()) / 1000;
    startDeal(toPerf(warm.dealAt), toPerf(warm.dealEnd));
  }, [warm, game, startDeal, version]);
  const locked = stage !== 'play';
  // the loading screen fades out over the start of the shuffle instead of vanishing in one frame
  const [curtain, setCurtain] = useState(true);
  useEffect(() => {
    if (stage === 'loading') return setCurtain(true);
    const t = setTimeout(() => setCurtain(false), 450);
    return () => clearTimeout(t);
  }, [stage]);
  const playCard = useCallback(
    (id: number) => {
      if (locked) return;
      if (game.s.phase === 'choose') game.resolveChoice(id);
      else game.play(id);
    },
    [game, locked],
  );
  const kb = useKeyboardPlay(game, locked, playCard);

  // Music follows the table theme; silence when leaving the table.
  const theme = game.s.theme ?? 'classic';
  useEffect(() => {
    sound.music(theme);
  }, [theme]);
  useEffect(() => () => {
    sound.music(null);
    sound.propeller(0);
  }, []);

  // Sounds for what changed on the table since the last update.
  const prev = useRef<{ game: GameView | null; discard: number; hands: number; cur: number; round: number }>({ game: null, discard: 0, hands: 0, cur: -1, round: 0 });
  useEffect(() => {
    const s = game.s;
    const hands = s.players.reduce((a, p) => a + p.hand.length, 0);
    const p = prev.current;
    if (p.game === game && p.round === s.round) {
      if (s.discard.length > p.discard) sound.play('card');
      const drawn = hands - p.hands + (s.discard.length - p.discard);
      if (drawn > 0) sound.play('draw', drawn);
      const v = game.viewer();
      if (s.cur !== p.cur && v !== null && v === s.cur && s.phase !== 'over') sound.play('turn');
    }
    prev.current = { game, discard: s.discard.length, hands, cur: s.cur, round: s.round };
  }, [game, version]);

  // The barrel-plane mascot drops by: after the deal, then now and then.
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.22) summonMascot('fly');
    }, 15_000);
    return () => clearInterval(t);
  }, [game]);

  // Director: plays effects; for local games also runs the bots.
  useEffect(() => {
    const s = game.s;
    if (lastFx.current.game !== game) lastFx.current = { game, id: game.fxBaseline };
    for (const f of s.fx) {
      if (f.id <= lastFx.current.id) continue;
      lastFx.current.id = f.id;
      if (f.kind === 'shake') shake(0.35, 0.45);
      if (f.kind === 'boom') { fxState.boomAt = nowSec(); shake(1.1, 0.8); sound.play('boom'); }
      if (f.kind === 'chaos') { fxState.chaosUntil = nowSec() + 1.7; shake(0.4, 1.2); sound.play('whoosh'); }
      if (f.kind === 'uno') sound.play('uno');
      if (f.kind === 'caught') sound.play('caught');
      if (f.kind === 'challenge') sound.play('challenge');
      if (f.kind === 'timeout') sound.play('penalty');
      if (f.kind === 'win') {
        sound.play('win');
        fxState.winAt = nowSec();
        summonMascot('loop', 0.8);
      }
      if (f.kind === 'event') {
        fxState.eventAt = nowSec();
        sound.play('event');
        if (Math.random() < 0.5 && !s.fx.some(x => x.kind === 'bomber' && x.id > f.id)) summonMascot('fly', 0.3);
        setBanner({ id: f.id, icon: f.icon ?? '', title: f.text ?? '', sub: f.sub ?? '' });
        continue;
      }
      if (f.kind === 'meteor') {
        fxState.meteor = { at: nowSec() + 0.6, target: f.target ?? 0 };
        fxState.holdUntil = nowSec() + 0.6 + METEOR_FALL;
        setTimeout(() => { shake(1.3, 0.9); setFlash(x => x + 1); sound.play('boom'); }, (0.6 + METEOR_FALL) * 1000);
      }
      if (f.kind === 'lightning') {
        fxState.lightning = { at: nowSec() + 0.5, target: f.target ?? 0 };
        setTimeout(() => { shake(0.7, 0.5); setFlash(x => x + 1); sound.play('thunder'); }, 500);
      }
      if (f.kind === 'jackpot') {
        fxState.burst = { at: nowSec() + 0.5, target: f.target ?? 0 };
        fxState.holdUntil = nowSec() + 0.6;
      }
      if (f.kind === 'bomber') {
        // the plane flies in and drops a bomb on the victim; the penalty cards burst out of the blast
        const lead = 0.5;
        const target = f.target ?? 0;
        summonMascot('bomber', lead, target);
        const seat = spawn.seats[target] ?? [0, 0.6, 0];
        fxState.drop.pos = [seat[0], seat[1] + 0.9, seat[2]];
        fxState.drop.at = nowSec() + lead + BOMB_RELEASE + BOMB_FALL;
        fxState.drop.until = fxState.drop.at + 0.4;
      }
      if (f.kind === 'spin') fxState.spinUntil = nowSec() + SPIN_TIME;
      if (f.kind === 'upside') fxState.upsideUntil = nowSec() + 30;
      if (f.kind === 'carousel') fxState.carouselUntil = nowSec() + 1.6;
      if (f.text) toast(f.text, ['uno', 'boom', 'chaos', 'caught', 'challenge'].includes(f.kind));
    }
    if (s.phase === 'over' && scored.current !== game && s.winner !== null) {
      scored.current = game;
      // in teams every member of the winning team scores
      s.players.forEach((p, i) => {
        if (i === s.winner || (s.teams && s.teams[i] === s.teams[s.winner!])) onOver?.(p.name);
      });
    }
    if (!locked && local && local.cp().bot && (s.phase === 'play' || s.phase === 'choose')) {
      // let an event banner and its animation finish before the bot moves
      const eventWait = Math.max(0, fxState.eventAt + 2.8 - nowSec()) * 1000;
      const delay = eventWait + (s.phase === 'choose' ? 700 : s.drawn ? 650 : 950 + Math.random() * 700);
      const t = setTimeout(() => local.botAct(), delay);
      return () => clearTimeout(t);
    }
  }, [game, local, version, toast, onOver, locked]);

  // A bot that noticed a missing UNO speaks up after a pause (the server does this online).
  const catchWin = game.s.unoCatch;
  useEffect(() => {
    if (!local || !catchWin || catchWin.botCatcher === null) return;
    const by = catchWin.botCatcher;
    const t = setTimeout(() => local.catchUno(by), catchWin.botDelay);
    return () => clearTimeout(t);
  }, [local, catchWin]);

  // Countdowns: bomb / blitz and the turn clock. The server times them online; locally we check them here.
  const [now, setNow] = useState(Date.now());
  const deadline = game.s.bombDeadline;
  const turnDeadline = game.s.turnDeadline;
  const endsAt = game.s.phase === 'over' ? null : game.s.endsAt;
  useEffect(() => {
    if (deadline === null && turnDeadline === null && endsAt === null) return;
    let lastTick = -1;
    const t = setInterval(() => {
      setNow(Date.now());
      local?.checkBomb();
      local?.timeoutTurn();
      local?.checkTimeLimit();
      // tick through the last five seconds of my own clock
      const g = game;
      const dl = g.s.bombDeadline ?? g.s.turnDeadline;
      if (dl !== null && g.viewer() !== null && g.viewer() === g.s.cur) {
        const left = Math.ceil((dl - Date.now() - g.clockOffset) / 1000);
        if (left <= 5 && left > 0 && left !== lastTick) {
          lastTick = left;
          sound.play('tick');
        }
      }
    }, 100);
    return () => clearInterval(t);
  }, [game, local, deadline, turnDeadline, endsAt]);
  const roundLeft = endsAt === null ? null : Math.max(0, Math.ceil((endsAt - now - game.clockOffset) / 1000));
  const left = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now - game.clockOffset) / 1000));

  const s = game.s;
  const viewer = game.viewer();
  const myTurn = viewer !== null && viewer === s.cur && s.phase === 'play';
  const canDraw = !locked && myTurn && (!s.drawn || s.pending > 0);

  return (
    <div className="game">
      <Canvas key={glKey} onCreated={onCreated} shadows dpr={[1, 1.5]} camera={{ fov: 42, position: [0, 9, 10] }} gl={{ antialias: true }}>
        <GameScene
          key={s.round}
          game={game}
          version={version}
          canDraw={canDraw}
          onReady={onSceneReady}
          dealing={locked}
          onDeck={() => { if (!locked) game.draw(); }}
          onCard={playCard}
        />
      </Canvas>
      <Hud game={game} version={version} toasts={toasts} bombLeft={left} roundLeft={locked ? null : roundLeft} online={online} locked={locked} />
      {stage === 'dealing' && <div className="deal-banner">Раздаём карты…</div>}
      <p className="sr-only" aria-live="polite">{kb.said}</p>
      {kb.active && (
        <p className="kb-hint" aria-hidden>
          <kbd>←</kbd><kbd>→</kbd> выбрать · <kbd>Enter</kbd> сходить · <kbd>D</kbd> взять · <kbd>U</kbd> UNO · <kbd>P</kbd> пас
        </p>
      )}
      {flashOn && <div key={`flash-${flash}`} className="flash" />}
      {banner && <EventBanner key={`event-${banner.id}`} banner={banner} onDone={() => setBanner(b => (b?.id === banner.id ? null : b))} />}
      <Overlays game={game} version={version} score={score} onAgain={onAgain} onMenu={onMenu} online={online} locked={locked} />
      <RotateGate />
      {curtain && (
        <div className={`loading-screen ${stage === 'loading' ? '' : 'leaving'}`}>
          <CardLoader
            theme={s.theme}
            title="Раскладываем стол"
            sub={warm && warm.waiting.length ? 'Ждём, пока у всех загрузится игра' : 'Ещё секунду…'}
          >
            {warm && (
              <ul className="ready-list">
                {s.players.map((p, i) => {
                  const wait = warm.waiting.includes(i);
                  return (
                    <li key={i} className={wait ? '' : 'ok'}>
                      <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={28} />
                      {p.name}
                      <span className="st">{wait ? <span className="dot-pulse" /> : '✓'}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardLoader>
        </div>
      )}
    </div>
  );
}
