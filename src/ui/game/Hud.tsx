import { standIn } from '../../game/avatars';
import { CNAME, HEX, TEAM_NAMES } from '../../game/content';
import type { GameView } from '../../game/view';
import { AvatarImg } from '../components/AvatarImg';
import { TurnRing } from './TurnRing';
import type { OnlineCtx } from './onlineCtx';

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
  /** seconds left in a timed round */
  roundLeft?: number | null;
}

export function Hud({ game, toasts, bombLeft, online, locked, roundLeft }: Props) {
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
  else if (seatP.out) hint = 'Ты выбыл(а): 25 карт. Смотри, кто победит';
  else if (playing && s.pending > 0 && s.rules.noMercy) hint = anyPlay ? `Перебей картой не меньше +${s.pendingLast} или возьми +${s.pending}` : `Перебить нечем. Бери +${s.pending}`;
  else if (playing && s.pending > 0) hint = anyPlay ? `Отбейся или возьми +${s.pending}` : `Отбиться нечем. Бери +${s.pending}`;
  else if (playing && s.drawn) hint = s.rules.noMercy ? 'Вытянул подходящую карту: ходи ей' : 'Можно сыграть вытянутую карту или спасовать';
  else if (playing) hint = anyPlay ? 'Твой ход: перетащи карту в центр или нажми на неё' : 'Нечем ходить, тяни из колоды';
  else if (online?.spectator) hint = `Ты зритель, сыграешь со следующего раунда. Ходит ${cur.name}`;
  else if (s.phase === 'dare') hint = `🎭 ${cur.name} выполняет фант: «${s.dare}»`;
  else if (s.phase === 'coin') hint = `🪙 ${cur.name} подбрасывает монетку…`;
  else if (s.phase === 'choose') hint = `${cur.name} думает…`;
  else if (s.phase !== 'handover') hint = cur.offline ? `Ходит ${standIn(cur.name).name} (за ${cur.name})…` : `Ходит ${cur.name}…`;

  // "Твой ход: перетащи…" -> a big title and a quiet second line
  const [hintTitle, hintSub] = hint.includes(': ') ? [hint.slice(0, hint.indexOf(': ')), hint.slice(hint.indexOf(': ') + 2)] : [hint, ''];
  const cap = (t: string) => (t ? t[0].toUpperCase() + t.slice(1) : t);

  return (
    <div className="hud">
      <div className="hud-top">
        <div className="status">
          {/* the round opened with a Wild and the first player has not named the colour yet */}
          {s.discard.length === 1 && s.discard[0].color === 'wild' && s.phase === 'choose' ? (
            <>
              <span className="swatch" style={{ background: `conic-gradient(${HEX.red} 0 25%, ${HEX.yellow} 0 50%, ${HEX.green} 0 75%, ${HEX.blue} 0)` }} />
              <span className="cname">Цвет выбирают</span>
            </>
          ) : (
            <>
              <span className="swatch" style={{ background: HEX[s.color] }} />
              <span className="cname">{CNAME[s.color]}</span>
            </>
          )}
          <span className={`dirIcon ${s.dir < 0 ? 'ccw' : ''}`} title={s.dir < 0 ? 'Против часовой' : 'По часовой'}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M19.5 3.5v4.6h-4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {s.pending > 0 && <span className="pen">+{s.pending}</span>}
          {roundLeft != null && (
            <span className={`round-clock ${roundLeft <= 30 ? 'hot' : ''}`} title="До конца раунда">
              ⏱ {Math.floor(roundLeft / 60)}:{String(roundLeft % 60).padStart(2, '0')}
            </span>
          )}
          {s.teams && game.viewer() !== null && (
            <span className={`team-pill t${s.teams[game.viewer()!]}`} title="Твоя команда">{TEAM_NAMES[s.teams[game.viewer()!]]}</span>
          )}
          {s.blindTurns > 0 && <span title="Игра вслепую">🕶️</span>}
          {s.blitzTurns > 0 && !bombLeft && <span title="Блиц-круг">⚡</span>}
          {bombLeft > 0 && (
            <span className={`bombTimer ${bombLeft <= 3 ? 'hot' : ''}`}>{s.timerKind === 'blitz' ? '⚡' : '💣'} {bombLeft}</span>
          )}
        </div>
      </div>

      <div className="log" aria-live="polite">
        {s.log.slice(-3).map((l, i, arr) => (
          <div key={s.log.length - 3 + i} className={i === arr.length - 1 ? 'new' : ''}>{l}</div>
        ))}
      </div>

      <div className={`hud-bottom ${playing ? 'my-turn' : ''}`}>
        <div className="me">
          <div className={`plate me-plate ${s.cur === game.seat() && s.phase !== 'over' ? 'cur' : ''}`}>
            <div className="plate-name">{seatP.name}</div>
            <div className="plate-body">
              <span className="ava-wrap">
                <AvatarImg id={seatP.avatar} name={seatP.name} bot={seatP.bot} size={58} className="plate-ava" />
                {!locked && s.cur === game.seat() && s.turnDeadline !== null && s.phase !== 'over' && (
                  <TurnRing key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="plate-count">{seatP.hand.length}</span>
            </div>
          </div>
          {hint && (
            <span className="hint">
              <b>{hintTitle}</b>
              {hintSub && <small>{cap(hintSub)}</small>}
            </span>
          )}
        </div>
        <div className="actions">
          {playing && s.drawn && s.pending === 0 && anyPlay && !s.rules.noMercy && (
            <button className="btn act" onClick={() => game.pass()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M5 12h12M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              Пас
            </button>
          )}
          {playing && (s.pending > 0 || !s.drawn) && (
            <button className={`btn act draw ${s.pending ? 'danger' : !anyPlay ? 'primary' : ''}`} onClick={() => game.draw()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <rect x="7" y="3" width="11" height="15" rx="2.2" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.55" />
                <rect x="4" y="6" width="11" height="15" rx="2.2" fill="currentColor" opacity="0.9" />
              </svg>
              {s.pending ? `Взять +${s.pending}` : 'Взять карту'}
            </button>
          )}
        </div>
      </div>

      {playing && s.rules.uno && cur.hand.length === 2 && anyPlay && !s.unoCalled && <UnoCall onCall={() => game.callUno()} />}

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
 * The round "UNO!" badges in the game's logo style: an oval with big letters, rings rippling out
 * and a short line under it. `wide`: a longer word ("Поймал!") gets a wider oval.
 */
function UnoBadge({ wide, word, caption, label, onClick, avatar }: {
  wide?: boolean; word: string; caption: string; label: string; onClick: () => void;
  /** a little portrait stuck to the oval (whoever is being caught) */
  avatar?: { id?: string; name: string; bot: boolean };
}) {
  return (
    <button className={`uno-call ${wide ? 'wide' : ''}`} onClick={onClick} aria-label={label}>
      <span className="uno-rings" aria-hidden><i /><i /></span>
      <span className="uno-oval" aria-hidden>
        <span className="uno-word">{word}</span>
      </span>
      {avatar && (
        <span className="uno-who" aria-hidden>
          <AvatarImg id={avatar.id} name={avatar.name} bot={avatar.bot} size={44} />
        </span>
      )}
      <span className="uno-cap" aria-hidden>{caption}</span>
    </button>
  );
}

/** Two cards left: a big "UNO!" floats above the dock until it is pressed, then it goes (the table shows the shout). */
function UnoCall({ onCall }: { onCall: () => void }) {
  return (
    <div className="uno-call-zone">
      <UnoBadge word="UNO!" caption="Жми, пока не поймали" label="Крикнуть UNO! (клавиша U)" onClick={onCall} />
    </div>
  );
}

/**
 * Someone is down to one card and nobody heard "UNO!":
 * everyone else gets a big "Caught you!" over the table, the victim gets one last chance to shout it.
 */
function UnoCatch({ game, online }: { game: GameView; online: boolean }) {
  if (!game.catchable() || !game.s.unoCatch) return null;
  const s = game.s;
  const victim = s.unoCatch!.victim;
  const v = game.viewer();
  const p = s.players[victim];
  if (v === victim) {
    return (
      <div className="catch-zone">
        <UnoBadge word="UNO!" caption="Ты забыл(а)! Успей, пока не поймали" label="Крикнуть UNO, пока не поймали" onClick={() => game.lateUno()} />
      </div>
    );
  }
  // online spectators have no seat to catch from; on a shared screen anyone at the table may press it
  if (online && v === null) return null;
  return (
    <div className="catch-zone">
      <UnoBadge
        wide
        word="Поймал!"
        caption={`${p.name} не крикнул(а) «UNO!»`}
        label={`Поймать: ${p.name} не крикнул(а) UNO`}
        onClick={() => game.catchUno()}
        avatar={{ id: p.avatar, name: p.name, bot: p.bot }}
      />
    </div>
  );
}
