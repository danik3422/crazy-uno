import { haptics } from '../../../audio/haptics';
import type { GameView } from '../../../game/view';
import { render, useT, type Msg } from '../../../i18n';
import { crashProbe } from '../../../three/fxState';
import type { OnlineCtx } from '../onlineCtx';
import { GameLog } from './GameLog';
import { MyDock } from './MyDock';
import { StatusBar } from './StatusBar';
import { turnHint } from './turnHint';
// the HUD's own sheet, then the plates (shared with the opponents' plates over the table), then the UNO buttons
import './Hud.css';
import '../Plates.css';
import { UnoCall, UnoCatch } from './UnoButtons';
import './UnoButtons.css';

export interface Toast {
  id: number;
  text: Msg;
  big: boolean;
}

interface Props {
  game: GameView;
  version: number;
  toasts: Toast[];
  bombLeft: number;
  online?: OnlineCtx;
  /** round start: the cards are still being dealt */
  locked?: boolean;
  /** seconds left in a timed round */
  roundLeft?: number | null;
}

/**
 * Everything over the table: the status pill (top left), the log, your dock at the bottom (plate, hint, draw / pass),
 * the UNO buttons and the toasts.
 */
export function Hud({ game, toasts, bombLeft, online, locked = false, roundLeft }: Props) {
  crashProbe('hud');
  const t = useT();
  const s = game.s;
  const viewer = game.viewer();
  const cur = game.cp();
  const myTurn = viewer !== null && viewer === s.cur;
  const playing = !locked && myTurn && s.phase === 'play';
  const anyPlay = playing && cur.hand.some(c => game.playable(c));
  // Jump-In: someone else is moving and the viewer holds a card exactly like the top one
  const jumpCard = !locked && viewer !== null && viewer !== s.cur ? s.players[viewer].hand.find(c => game.jumpable(c)) : undefined;
  const hint = turnHint(t, { game, locked, playing, anyPlay, jumpCard, spectator: !!online?.spectator });

  return (
    <div className={`hud th-${s.theme ?? 'classic'}`}>
      <StatusBar game={game} bombLeft={bombLeft} roundLeft={roundLeft} />
      <GameLog game={game} />
      <MyDock game={game} locked={locked} playing={playing} anyPlay={anyPlay} jumpCard={jumpCard} hint={hint} />

      {playing && s.rules.uno && cur.hand.length === 2 && anyPlay && !s.unoCalled && <UnoCall onCall={() => { haptics.play('uno'); game.callUno(); }} />}
      <UnoCatch game={game} online={!!online} />

      <div className="toasts">
        {toasts.map(x => (
          <div key={x.id} className={`toast ${x.big ? 'big' : ''}`}>{render(x.text)}</div>
        ))}
      </div>
    </div>
  );
}
