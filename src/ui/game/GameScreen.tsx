import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback, useSyncExternalStore } from 'react';
import { Game } from '../../game/engine';
import { useT } from '../../i18n';
import type { GameView } from '../../game/view';
import type { RemoteGame } from '../../net/remoteGame';
import { GameScene } from '../../three/Scene';
import { tableEvents } from '../../three/tableEvents';
import { PartnerHand } from './PartnerHand';
import { useStatsRecorder } from './useStatsRecorder';
import { AchievementToasts } from '../profile/AchievementToasts';
import { DEBUG } from '../../three/fxState';
import { useAdaptiveDpr } from '../../three/useAdaptiveDpr';
import { useGlRecovery } from '../../three/useGlRecovery';
import { RotateGate } from '../components/phone/RotateGate';
import { EventBanner } from './EventBanner';
import { Hud } from './hud/Hud';
import { LoadingCurtain } from './LoadingCurtain';
import { Overlays } from './Overlays';
import type { OnlineCtx } from './onlineCtx';
import { useCountdowns } from './useCountdowns';
import { useKeyboardPlay } from './useKeyboardPlay';
import { useLocalBots } from './useLocalBots';
import { useRoundStart } from './useRoundStart';
import { useTableEffects } from './useTableEffects';
import { useTableSounds } from './useTableSounds';
import { useBotReactions, useReactionSound } from './Reactions';
import './GameScreen.css';

interface Props {
  game: GameView;
  score: Record<string, number>;
  onAgain: () => void;
  onMenu: () => void;
  /** called once per finished round with the winner's name (local games keep their own score) */
  onOver?: (winner: string) => void;
  online?: OnlineCtx;
}

/**
 * The 3D table plus everything on top of it (HUD, prompts, banners).
 * Plays effects for any game; drives bots and clocks only for a local one (online the server does).
 */
export function GameScreen({ game, score, onAgain, onMenu, onOver, online }: Props) {
  const t = useT();
  const version = useSyncExternalStore(game.subscribe, game.getVersion);
  const local = game instanceof Game ? game : null;
  const { glKey, onCreated } = useGlRecovery();
  const resolution = useAdaptiveDpr();
  if (DEBUG) (window as unknown as { __uno?: GameView }).__uno = game;

  const round = useRoundStart(game, local, version);
  const { locked } = round;

  const playCard = useCallback(
    (id: number) => {
      if (locked) return;
      const s = game.s;
      const v = game.viewer();
      const card = v !== null ? s.players[v].hand.find(c => c.id === id) : undefined;
      if (s.phase === 'choose') game.resolveChoice(id);
      // Jump-In: an identical card laid out of turn (on your own turn it is just a normal play)
      else if (card && v !== s.cur && game.jumpable(card)) game.jump(id);
      else game.play(id);
    },
    [game, locked],
  );
  const kb = useKeyboardPlay(game, locked, playCard);
  useTableSounds(game, version);
  useBotReactions(game, version);
  // your own record: stats and achievements
  useStatsRecorder(game, version);
  useReactionSound();
  const effects = useTableEffects(game, version, onOver);
  useLocalBots(local, version, locked);
  const { bombLeft, roundLeft } = useCountdowns(game, local);

  const s = game.s;
  const banner = effects.banner;
  const viewer = game.viewer();
  const myTurn = viewer !== null && viewer === s.cur && s.phase === 'play';
  const canDraw = !locked && myTurn && (!s.drawn || s.pending > 0);

  return (
    <div className="game">
      <Canvas
        key={glKey}
        onCreated={st => {
          onCreated(st);
          // debug builds: the renderer, to read draw calls and triangles per frame
          if (DEBUG) (window as unknown as { __gl?: unknown }).__gl = st.gl;
        }}
        shadows
        events={tableEvents}
        dpr={resolution.dpr}
        camera={{ fov: 42, position: [0, 9, 10] }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        {/* a device that can't keep up renders at a lower resolution; watched only once the cards
            are dealt, so loading hiccups (shaders, textures) don't count against it */}
        {!locked && (
          <PerformanceMonitor
            bounds={hz => [hz * 0.7, hz * 0.92]}
            onDecline={resolution.lower}
            onIncline={resolution.raise}
            flipflops={3}
            onFallback={resolution.fallback}
          />
        )}
        <GameScene
          key={s.round}
          game={game}
          version={version}
          canDraw={canDraw}
          onReady={round.onSceneReady}
          dealing={locked}
          onDeck={() => { if (!locked) game.draw(); }}
          onCard={playCard}
        />
      </Canvas>
      <PartnerHand game={game} version={version} />
      <AchievementToasts />
      <Hud game={game} version={version} toasts={effects.toasts} bombLeft={bombLeft} roundLeft={locked ? null : roundLeft} online={online} locked={locked} />
      {round.stage === 'dealing' && <div className="deal-banner">{t('hud.dealing')}</div>}
      <p className="sr-only" aria-live="polite">{kb.said}</p>
      {kb.active && (
        <p className="kb-hint" aria-hidden dangerouslySetInnerHTML={{ __html: t('hud.keys') }} />
      )}
      {effects.flash !== null && <div key={`flash-${effects.flash}`} className={`flash th-${s.theme ?? 'classic'}`} />}
      {banner && <EventBanner key={`event-${banner.id}`} banner={banner} theme={s.theme ?? 'classic'} onDone={() => effects.dismissBanner(banner.id)} />}
      <Overlays game={game} version={version} score={score} onAgain={onAgain} onMenu={onMenu} online={online} locked={locked} />
      <RotateGate waiting={round.stage === 'loading'} />
      {round.curtain && (
        <LoadingCurtain
          s={s}
          leaving={round.stage !== 'loading'}
          warmup={round.warmup}
          turning={round.turning}
          onDealNow={online?.isHost && round.turningLong ? () => (game as RemoteGame).dealNow() : undefined}
        />
      )}
    </div>
  );
}
