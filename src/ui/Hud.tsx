import { CNAME, HEX } from '../game/content';
import type { GameView } from '../game/view';
import { standIn } from '../game/avatars';
import { AvatarImg } from './AvatarImg';
import { TurnRing } from './TurnRing';
import type { OnlineCtx } from './Overlays';

export interface Toast {
  id: number;
  text: string;
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
}

export function Hud({ game, toasts, bombLeft, online, locked }: Props) {
  const s = game.s;
  const viewer = game.viewer();
  const seatP = s.players[game.seat()];
  const cur = game.cp();
  const myTurn = viewer !== null && viewer === s.cur;
  const playing = !locked && myTurn && s.phase === 'play';
  const anyPlay = playing && cur.hand.some(c => game.playable(c));

  let hint = '';
  if (locked) hint = 'Раздаём карты…';
  else if (s.phase === 'over') hint = '';
  else if (myTurn && s.phase === 'choose' && s.choice?.kind === 'card') hint = '🎁 Нажми на карту, которую подаришь';
  else if (playing && s.blindTurns > 0) hint = '🕶️ Вслепую! Светятся карты, которыми можно сходить';
  else if (playing && s.pending > 0) hint = anyPlay ? `Отбейся или возьми +${s.pending}` : `Отбиться нечем. Бери +${s.pending}`;
  else if (playing && s.drawn) hint = 'Можно сыграть вытянутую карту или спасовать';
  else if (playing) hint = anyPlay ? 'Твой ход: перетащи карту в центр или нажми на неё' : 'Нечем ходить, тяни из колоды';
  else if (online?.spectator) hint = `Ты зритель, сыграешь со следующего раунда. Ходит ${cur.name}`;
  else if (s.phase === 'dare') hint = `🎭 ${cur.name} выполняет фант: «${s.dare}»`;
  else if (s.phase === 'coin') hint = `🪙 ${cur.name} подбрасывает монетку…`;
  else if (s.phase === 'choose') hint = `${cur.name} думает…`;
  else if (s.phase !== 'handover') hint = cur.offline ? `Ходит ${standIn(cur.name).name} (за ${cur.name})…` : `Ходит ${cur.name}…`;

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="status">
          <span className="swatch" style={{ background: HEX[s.color] }} />
          <span className="cname">{CNAME[s.color]}</span>
          <span className={`dirIcon ${s.dir < 0 ? 'ccw' : ''}`} title="Направление игры">↻</span>
          {s.pending > 0 && <span className="pen">+{s.pending}</span>}
          {s.blindTurns > 0 && <span title="Игра вслепую">🕶️</span>}
          {s.blitzTurns > 0 && !bombLeft && <span title="Блиц-круг">⚡</span>}
          {bombLeft > 0 && (
            <span className={`bombTimer ${bombLeft <= 3 ? 'hot' : ''}`}>{s.timerKind === 'blitz' ? '⚡' : '💣'} {bombLeft}</span>
          )}
        </div>
      </div>

      <div className="log" aria-live="polite">
        {s.log.slice(-3).map((l, i) => (
          <div key={s.log.length - 3 + i}>{l}</div>
        ))}
      </div>

      <div className="hud-bottom">
        <div className="me">
          <div className={`plate me-plate ${s.cur === game.seat() && s.phase !== 'over' ? 'cur' : ''}`}>
            <div className="plate-name">{seatP.name}</div>
            <div className="plate-body">
              <span className="ava-wrap">
                <AvatarImg id={seatP.avatar} name={seatP.name} bot={seatP.bot} size={58} className="plate-ava" />
                {s.cur === game.seat() && s.turnDeadline !== null && s.phase !== 'over' && (
                  <TurnRing key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="plate-count">{seatP.hand.length}</span>
            </div>
          </div>
          {hint && <span className="hint">{hint}</span>}
        </div>
        <div className="actions">
          {playing && s.rules.uno && cur.hand.length === 2 && anyPlay && (
            <button className={`btn unobtn ${s.unoCalled ? 'done' : ''}`} onClick={() => game.callUno()}>
              {s.unoCalled ? 'UNO! ✓' : 'Крикнуть UNO!'}
            </button>
          )}
          {playing && s.drawn && s.pending === 0 && anyPlay && (
            <button className="btn" onClick={() => game.pass()}>Пас</button>
          )}
          {playing && (s.pending > 0 || !s.drawn) && (
            <button className={`btn ${s.pending ? 'danger' : ''}`} onClick={() => game.draw()}>
              {s.pending ? `Взять +${s.pending}` : 'Взять карту'}
            </button>
          )}
        </div>
      </div>

      <UnoCatch game={game} online={!!online} />

      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.big ? 'big' : ''}`}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * Someone is down to one card and nobody heard "UNO!":
 * everyone else gets a big "Caught you!" button, the victim gets one last chance to shout it.
 */
function UnoCatch({ game, online }: { game: GameView; online: boolean }) {
  if (!game.catchable() || !game.s.unoCatch) return null;
  const s = game.s;
  const victim = s.unoCatch!.victim;
  const v = game.viewer();
  const name = s.players[victim].name;
  if (v === victim) {
    return (
      <div className="catch-zone">
        <button className="btn catch-btn save" onClick={() => game.lateUno()}>
          Крикнуть UNO! <small>пока не поймали</small>
        </button>
      </div>
    );
  }
  // online spectators have no seat to catch from; on a shared screen anyone at the table may press it
  if (online && v === null) return null;
  return (
    <div className="catch-zone">
      <button className="btn catch-btn" onClick={() => game.catchUno()}>
        🫵 Поймал! <small>{name} не крикнул(а) UNO</small>
      </button>
    </div>
  );
}
