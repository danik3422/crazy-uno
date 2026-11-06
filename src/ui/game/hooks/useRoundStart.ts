import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { sound } from '../../../audio/sound';
import type { Game } from '../../../game/engine';
import type { GameView } from '../../../game/view';
import { DEAL_STEP_MS, dealMs, dealTiming, SHUFFLE_MS, UPRIGHT_GRACE_MS } from '../../../net/protocol';
import { RemoteGame } from '../../../net/remoteGame';
import { fxState, nowSec, summonMascot } from '../../../three/fxState';
import { lastPlace } from '../../../three/layout';
import { usePhone } from '../../hooks/phone';

/**
 * loading — this screen (and, online, every screen) is still drawing the table
 * dealing — the deck is shuffled and the cards fly out
 * play    — anybody may move
 */
export type RoundStage = 'loading' | 'dealing' | 'play';

/** How long the loading screen takes to fade out over the start of the shuffle. */
const CURTAIN_FADE_MS = 450;

/**
 * Round start. Nobody can move before the stage is 'play'.
 * A phone held upright holds the deal: the game only starts once it lies on its side (online: for everybody).
 */
export function useRoundStart(game: GameView, local: Game | null, version: number) {
  const [stage, setStage] = useState<RoundStage>('loading');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useLayoutEffect(() => {
    fxState.dealAt = Infinity;
    fxState.dealEnd = Infinity;
    fxState.revealFrom = Infinity;
    // card ids start over every round: forget where last round's cards were
    lastPlace.clear();
    setStage('loading');
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [game]);

  /** Plays the shuffle and the deal between `at` and `end` (animation clock, seconds). */
  const startDeal = useCallback((at: number, end: number) => {
    if (Number.isFinite(fxState.dealAt)) return;
    fxState.dealAt = at;
    fxState.dealEnd = end;
    const now = nowSec();
    // the cards already in the hands (a reconnect) all fly in at once: they are not draws to show off
    fxState.revealFrom = Math.max(end, now) + 0.8;
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
    // a soft flick with every third card, timed to the moment it leaves the deck (card k leaves at at + k × step),
    // then the pile's first card slapping down
    const { handsMs, pileMs } = dealTiming(game.s.players.length, game.s.table?.handSize ?? 7);
    for (let ms = 0; ms < handsMs; ms += DEAL_STEP_MS * 3) later(at + ms / 1000, () => sound.play('draw'));
    later(at + pileMs / 1000 + 0.4, () => sound.play('card')); // as it lands
    later(end, () => {
      setStage('play');
      summonMascot('fly', 1.2);
    });
  }, [game]);

  const { phone, portrait } = usePhone();
  const upright = phone && portrait;
  const uprightRef = useRef(upright);
  uprightRef.current = upright;
  const [sceneReady, setSceneReady] = useState(false);
  useLayoutEffect(() => setSceneReady(false), [game]);

  /** The 3D table has been drawn a few times (textures uploaded, shaders compiled). */
  const onSceneReady = useCallback(() => {
    if (game instanceof RemoteGame) return game.ready(uprightRef.current);
    setSceneReady(true);
  }, [game]);
  useEffect(() => {
    if (game instanceof RemoteGame) game.orient(upright);
  }, [game, upright]);

  // on one device: deal as soon as the table is drawn and the phone (if it is one) is turned
  useEffect(() => {
    if (game instanceof RemoteGame || !sceneReady || upright || Number.isFinite(fxState.dealAt)) return;
    // a game brought back from a save: no deal to show, the cards are simply where they were
    if (local?.resumed) {
      local.resumeClocks();
      const t = nowSec();
      startDeal(t - 1, t - 0.5);
      return;
    }
    const ms = dealMs(game.s.players.length, game.s.table.handSize);
    const at = nowSec() + 0.6 + SHUFFLE_MS / 1000;
    local?.holdClock(ms + 600 + SHUFFLE_MS);
    startDeal(at, at + ms / 1000);
  }, [game, local, startDeal, sceneReady, upright]);

  // online: the server says when the deal starts for everybody
  const warmup = game instanceof RemoteGame ? game.warmup : null;
  const turning = warmup?.turning ?? [];
  // someone keeps their phone upright for a while: the host may deal without them
  const [turningLong, setTurningLong] = useState(false);
  const anyTurning = turning.length > 0;
  useEffect(() => {
    setTurningLong(false);
    if (!anyTurning) return;
    const t = setTimeout(() => setTurningLong(true), UPRIGHT_GRACE_MS);
    return () => clearTimeout(t);
  }, [anyTurning]);
  useEffect(() => {
    if (!warmup || warmup.dealAt === null || warmup.dealEnd === null) return;
    // server ms -> this screen's animation clock
    const toPerf = (ms: number) => nowSec() + (ms - game.clockOffset - Date.now()) / 1000;
    startDeal(toPerf(warmup.dealAt), toPerf(warmup.dealEnd));
  }, [warmup, game, startDeal, version]);

  // the loading screen fades out over the start of the shuffle instead of vanishing in one frame
  const [curtain, setCurtain] = useState(true);
  useEffect(() => {
    if (stage === 'loading') return setCurtain(true);
    const t = setTimeout(() => setCurtain(false), CURTAIN_FADE_MS);
    return () => clearTimeout(t);
  }, [stage]);

  return {
    stage,
    /** no moves and no prompts until the cards are dealt */
    locked: stage !== 'play',
    /** the loading screen is (still) showing */
    curtain,
    onSceneReady,
    /** online only: who is still loading or turning their phone */
    warmup,
    turning,
    turningLong,
  };
}
