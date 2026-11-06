import { useCallback, useEffect, useRef, useState } from 'react';
import { haptics } from '../../../audio/haptics';
import { speech } from '../../../audio/speech';
import { shoutState } from '../../../audio/voice';
import { type Sfx, sound } from '../../../audio/sound';
import type { EventId, FxKind, State } from '../../../game/types';
import type { GameView } from '../../../game/view';
import { BOMB_FALL, BOMB_RELEASE, fxState, METEOR_FALL, nowSec, shake, SPIN_TIME, summonMascot } from '../../../three/effects/fxState';
import { spawn } from '../../../three/layout';
import type { Banner } from '../EventBanner';
import type { Toast } from '../hud/Hud';
import type { Msg } from '../../../i18n/msg';

const TOAST_MS = 1900;
const FLASH_MS = 500;
/** effects whose text gets the big toast */
const BIG_TOASTS: FxKind[] = ['uno', 'boom', 'chaos', 'caught', 'challenge', 'knockout', 'jump'];
/** effects that only need a sound */
const SOUND_OF: Partial<Record<FxKind, Sfx>> = {
  uno: 'uno',
  caught: 'caught',
  challenge: 'challenge',
  timeout: 'penalty',
  knockout: 'boom',
  // Jump-In: a card thrown in out of turn
  jump: 'whoosh',
};

/** A buzz on the phone for the loud moments of the table. */
const HAPTIC_OF: Partial<Record<FxKind, 'medium' | 'heavy' | 'uno'>> = { uno: 'uno', caught: 'heavy', boom: 'heavy', knockout: 'heavy', meteor: 'medium', lightning: 'medium', jump: 'medium' };

/** Events with a stinger of their own (the rest get the table's general one). */
const EVENT_SOUND: Partial<Record<EventId, Sfx>> = { recolor: 'recolor', mono: 'recolor', jackpot: 'jackpot', carousel: 'carousel', robin: 'carousel' };

/** Whether the person at this screen won (a teammate's win counts); with nobody watching, a human's win does. */
function viewerWon(s: State, viewer: number | null): boolean {
  const w = s.winner;
  if (w === null) return false;
  if (viewer === null) return !s.players[w]?.bot;
  return w === viewer || (!!s.teams && s.teams[w] === s.teams[viewer]);
}

/**
 * Turns the game's effect queue (`s.fx`) into what you see and hear: toasts, the event banner,
 * screen shake and flashes, and the 3D effects (meteor, lightning, the bomber plane…).
 * Also keeps the evening's score for local games via `onOver`.
 */
export function useTableEffects(game: GameView, version: number, finale: boolean, onOver?: (winner: string) => void) {
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

  const toast = useCallback((text: Msg, big = false) => {
    const id = Math.random();
    setToasts(t => [...t.slice(-2), { id, text, big }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), TOAST_MS);
  }, []);

  // the table turned upside down by an event is set right again when leaving
  useEffect(() => () => { fxState.upsideUntil = 0; }, []);

  const lastFx = useRef<{ game: GameView | null; id: number }>({ game: null, id: 0 });
  const scored = useRef<GameView | null>(null);
  // the round's end, held back while a knock-out van is still on screen (see useFinale)
  const won = useRef<{ text: Msg | undefined } | null>(null);
  useEffect(() => {
    const s = game.s;
    if (lastFx.current.game !== game) lastFx.current = { game, id: game.fxBaseline };
    for (const f of s.fx) {
      if (f.id <= lastFx.current.id) continue;
      lastFx.current.id = f.id;
      const sfx = SOUND_OF[f.kind];
      if (f.kind === 'uno') {
        // a human voice shouts it (each player in their own pitch); the table's sound adds only its sparkle.
        // Calling UNO and then laying the card is one shout, not two.
        const said = speech.uno(f.target ?? s.cur);
        if (said !== 'repeat') {
          shoutState.muted = said === 'spoken';
          sound.play('uno');
          shoutState.muted = false;
        }
      } else if (sfx) sound.play(sfx);
      const buzz = HAPTIC_OF[f.kind];
      if (buzz) haptics.play(buzz);
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
          won.current = { text: f.text };
          continue; // played with the finale (below)
        case 'event':
          fxState.eventAt = nowSec();
          fxState.event = { at: nowSec(), id: f.event ?? null, target: f.target ?? s.cur, seq: fxState.event.seq + 1 };
          sound.play((f.event && EVENT_SOUND[f.event]) || 'event');
          setBanner({ id: f.id, event: f.event ?? null, title: f.text ?? null, sub: f.sub ?? null, top: s.phase !== 'play' });
          continue; // the banner shows the text, no toast
        case 'meteor':
          fxState.meteor = { at: nowSec() + 0.6, target: f.target ?? 0 };
          fxState.holdUntil = nowSec() + 0.6 + METEOR_FALL;
          setTimeout(() => sound.play('meteor'), Math.max(0, (0.6 + METEOR_FALL - 0.9) * 1000));
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
        case 'flyby':
          // the game decides when and which route, so it is the same flight for everyone at the table.
          // Right after an event it waits a moment for the banner; never over the bomber's run
          if (nowSec() - fxState.mascot.at < 6) break; // the plane is already up (a fly-by, the bomber, the victory laps)
          summonMascot('fly', s.fx.some(x => x.kind === 'event' && x.id === f.id - 1) ? 0.3 : 0, 0, (f.seed ?? 0) / 1000);
          break;
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

  // the finale: fanfare, the mascot's victory loop and the winner's toast
  useEffect(() => {
    if (!finale || !won.current) return;
    const text = won.current.text;
    won.current = null;
    const s = game.s;
    sound.play(viewerWon(s, game.viewer()) ? 'win' : 'lose');
    if (viewerWon(s, game.viewer())) haptics.play('win');
    fxState.winAt = nowSec();
    summonMascot('loop', 0.8);
    if (text) toast(text);
  }, [finale, game, toast]);

  return {
    toasts,
    banner,
    dismissBanner: (id: number) => setBanner(b => (b?.id === id ? null : b)),
    /** changes every time a white flash should play; null when none is showing */
    flash: flashOn ? flash : null,
  };
}
