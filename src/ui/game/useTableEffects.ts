import { useCallback, useEffect, useRef, useState } from 'react';
import { type Sfx, sound } from '../../audio/sound';
import type { FxKind } from '../../game/types';
import type { GameView } from '../../game/view';
import { BOMB_FALL, BOMB_RELEASE, fxState, METEOR_FALL, nowSec, shake, SPIN_TIME, summonMascot } from '../../three/fxState';
import { spawn } from '../../three/layout';
import type { Banner } from './EventBanner';
import type { Toast } from './Hud';

const TOAST_MS = 1900;
const FLASH_MS = 500;
/** effects whose text gets the big toast */
const BIG_TOASTS: FxKind[] = ['uno', 'boom', 'chaos', 'caught', 'challenge', 'knockout'];
/** effects that only need a sound */
const SOUND_OF: Partial<Record<FxKind, Sfx>> = {
  uno: 'uno',
  caught: 'caught',
  challenge: 'challenge',
  timeout: 'penalty',
  knockout: 'boom',
};

/**
 * Turns the game's effect queue (`s.fx`) into what you see and hear: toasts, the event banner,
 * screen shake and flashes, and the 3D effects (meteor, lightning, the bomber plane…).
 * Also keeps the evening's score for local games via `onOver`.
 */
export function useTableEffects(game: GameView, version: number, onOver?: (winner: string) => void) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [banner, setBanner] = useState<Banner | null>(null);
  // the white flash (lightning, meteor) is shown for half a second and then removed for good
  const [flash, setFlash] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  useEffect(() => {
    if (!flash) return;
    setFlashOn(true);
    const t = setTimeout(() => setFlashOn(false), FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);

  const toast = useCallback((text: string, big = false) => {
    const id = Math.random();
    setToasts(t => [...t.slice(-2), { id, text, big }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), TOAST_MS);
  }, []);

  // the table turned upside down by an event is set right again when leaving
  useEffect(() => () => { fxState.upsideUntil = 0; }, []);

  // the barrel-plane mascot drops by now and then
  useEffect(() => {
    const t = setInterval(() => {
      if (Math.random() < 0.22) summonMascot('fly');
    }, 15_000);
    return () => clearInterval(t);
  }, [game]);

  const lastFx = useRef<{ game: GameView | null; id: number }>({ game: null, id: 0 });
  const scored = useRef<GameView | null>(null);
  useEffect(() => {
    const s = game.s;
    if (lastFx.current.game !== game) lastFx.current = { game, id: game.fxBaseline };
    for (const f of s.fx) {
      if (f.id <= lastFx.current.id) continue;
      lastFx.current.id = f.id;
      const sfx = SOUND_OF[f.kind];
      if (sfx) sound.play(sfx);
      switch (f.kind) {
        case 'shake':
          shake(0.35, 0.45);
          break;
        case 'boom':
          fxState.boomAt = nowSec();
          shake(1.1, 0.8);
          sound.play('boom');
          break;
        case 'chaos':
          fxState.chaosUntil = nowSec() + 1.7;
          shake(0.4, 1.2);
          sound.play('whoosh');
          break;
        case 'win':
          sound.play('win');
          fxState.winAt = nowSec();
          summonMascot('loop', 0.8);
          break;
        case 'event':
          fxState.eventAt = nowSec();
          sound.play('event');
          // the mascot sometimes flies by, unless it is about to come as the bomber anyway
          if (Math.random() < 0.5 && !s.fx.some(x => x.kind === 'bomber' && x.id > f.id)) summonMascot('fly', 0.3);
          setBanner({ id: f.id, icon: f.icon ?? '', title: f.text ?? '', sub: f.sub ?? '' });
          continue; // the banner shows the text, no toast
        case 'meteor':
          fxState.meteor = { at: nowSec() + 0.6, target: f.target ?? 0 };
          fxState.holdUntil = nowSec() + 0.6 + METEOR_FALL;
          setTimeout(() => { shake(1.3, 0.9); setFlash(x => x + 1); sound.play('boom'); }, (0.6 + METEOR_FALL) * 1000);
          break;
        case 'lightning':
          fxState.lightning = { at: nowSec() + 0.5, target: f.target ?? 0 };
          setTimeout(() => { shake(0.7, 0.5); setFlash(x => x + 1); sound.play('thunder'); }, 500);
          break;
        case 'jackpot':
          fxState.burst = { at: nowSec() + 0.5, target: f.target ?? 0 };
          fxState.holdUntil = nowSec() + 0.6;
          break;
        case 'bomber': {
          // the plane flies in and drops a bomb on the victim; the penalty cards burst out of the blast
          const lead = 0.5;
          const target = f.target ?? 0;
          summonMascot('bomber', lead, target);
          const seat = spawn.seats[target] ?? [0, 0.6, 0];
          fxState.drop.pos = [seat[0], seat[1] + 0.9, seat[2]];
          fxState.drop.at = nowSec() + lead + BOMB_RELEASE + BOMB_FALL;
          fxState.drop.until = fxState.drop.at + 0.4;
          break;
        }
        case 'spin':
          fxState.spinUntil = nowSec() + SPIN_TIME;
          break;
        case 'upside':
          fxState.upsideUntil = nowSec() + 30;
          break;
        case 'carousel':
          fxState.carouselUntil = nowSec() + 1.6;
          break;
      }
      if (f.text) toast(f.text, BIG_TOASTS.includes(f.kind));
    }
    if (s.phase === 'over' && scored.current !== game && s.winner !== null) {
      scored.current = game;
      // in teams every member of the winning team scores
      s.players.forEach((p, i) => {
        if (i === s.winner || (s.teams && s.teams[i] === s.teams[s.winner!])) onOver?.(p.name);
      });
    }
  }, [game, version, toast, onOver]);

  return {
    toasts,
    banner,
    dismissBanner: (id: number) => setBanner(b => (b?.id === id ? null : b)),
    /** changes every time a white flash should play; null when none is showing */
    flash: flashOn ? flash : null,
  };
}
