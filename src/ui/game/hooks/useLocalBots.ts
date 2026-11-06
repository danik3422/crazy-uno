import { useEffect } from 'react';
import { botThinkMs, EVENT_PAUSE_MS } from '../../../game/bot';
import type { Game } from '../../../game/engine';
import { fxState, nowSec } from '../../../three/fxState';

/**
 * A local game has no server to move it along: this runs its bots
 * and lets a bot catch a missing UNO. Does nothing for an online game (local is null).
 */
export function useLocalBots(local: Game | null, version: number, locked: boolean) {
  useEffect(() => {
    if (locked || !local || !local.cp().bot) return;
    const s = local.s;
    if (s.phase !== 'play' && s.phase !== 'choose') return;
    // let an event banner and its animation finish before the bot moves
    const eventWait = Math.max(0, fxState.eventAt + EVENT_PAUSE_MS / 1000 - nowSec()) * 1000;
    const t = setTimeout(() => local.botAct(), eventWait + botThinkMs(s));
    return () => clearTimeout(t);
  }, [local, version, locked]);

  // Jump-In: a bot holding the same card as the top one throws it in out of turn (the server does this online).
  // The plan is rolled once per top card, so re-running this on every change only re-aims the same timer.
  const jump = !locked && local ? local.botJumpPlan() : null;
  const jumpKey = jump ? `${jump.top}:${jump.seat}:${jump.cardId}` : '';
  useEffect(() => {
    if (!local || !jump) return;
    const t = setTimeout(() => local.jumpIn(jump.seat, jump.cardId, jump.top, jump.uno), Math.max(0, jump.at - Date.now()));
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, jumpKey]);

  // a bot that noticed a missing UNO speaks up after a pause (the server does this online)
  const catchWindow = local?.s.unoCatch ?? null;
  useEffect(() => {
    if (!local || !catchWindow || catchWindow.botCatcher === null) return;
    const by = catchWindow.botCatcher;
    const t = setTimeout(() => local.catchUno(by), catchWindow.botDelay);
    return () => clearTimeout(t);
  }, [local, catchWindow]);
}
