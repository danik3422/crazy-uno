import { standIn } from '../../game/avatars';
import { CNAME, HEX, teamName } from '../../game/content';
import { render, useT, type Msg } from '../../i18n';
import type { GameView } from '../../game/view';
import { AvatarImg } from '../components/AvatarImg';
import { cardImage } from '../../three/textures';
import { TurnTimer } from './TurnTimer';
import type { OnlineCtx } from './onlineCtx';
import './Hud.css';
import './Plates.css';
import './UnoCall.css';

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

export function Hud({ game, toasts, bombLeft, online, locked, roundLeft }: Props) {
  const t = useT();
  const s = game.s;
  const viewer = game.viewer();
  const seatP = s.players[game.seat()];
  const cur = game.cp();
  const myTurn = viewer !== null && viewer === s.cur;
  const playing = !locked && myTurn && s.phase === 'play';
  const anyPlay = playing && cur.hand.some(c => game.playable(c));

  let hint = '';
  if (locked) hint = t('hud.dealing');
  else if (s.phase === 'over') hint = '';
  else if (myTurn && s.phase === 'choose' && s.choice?.kind === 'card') hint = t('hud.giftPick');
  else if (playing && s.blindTurns > 0) hint = t('hud.blind');
  else if (seatP.out) hint = t('hud.out');
  else if (playing && s.pending > 0 && s.rules.noMercy) hint = anyPlay ? t('hud.nmStack', { last: s.pendingLast, n: s.pending }) : t('hud.nmNoStack', { n: s.pending });
  else if (playing && s.pending > 0) hint = anyPlay ? t('hud.stack', { n: s.pending }) : t('hud.noStack', { n: s.pending });
  else if (playing && s.drawn) hint = s.rules.noMercy ? t('hud.drawnNm') : t('hud.drawn');
  else if (playing) hint = anyPlay ? t('hud.yourTurn') : t('hud.nothing');
  else if (online?.spectator) hint = t('hud.spectator', { who: cur.name });
  else if (s.phase === 'dare') hint = t('hud.dare', { who: cur.name, dare: render(s.dare) });
  else if (s.phase === 'coin') hint = t('hud.coin', { who: cur.name });
  else if (s.phase === 'choose') hint = t('hud.thinking', { who: cur.name });
  else if (s.phase !== 'handover') hint = cur.offline ? t('hud.standIn', { bot: standIn(cur.name).name, who: cur.name }) : t('hud.turnOf', { who: cur.name });

  // "Your turn|Drag a card…" -> a big title and a quiet second line
  const [hintTitle, hintSub = ''] = hint.split('|');

  return (
    <div className={`hud th-${s.theme ?? 'classic'}`}>
      <div className="hud-top">
        <div className="status">
          {/* the round opened with a Wild and the first player has not named the colour yet */}
          {s.discard.length === 1 && s.discard[0].color === 'wild' && s.phase === 'choose' ? (
            <>
              <span className="swatch" style={{ background: `conic-gradient(${HEX.red} 0 25%, ${HEX.yellow} 0 50%, ${HEX.green} 0 75%, ${HEX.blue} 0)` }} />
              <span className="cname">{t('hud.picking')}</span>
            </>
          ) : (
            <>
              <span className="swatch" style={{ background: HEX[s.color] }} />
              <span className="cname">{CNAME[s.color]}</span>
            </>
          )}
          <span className={`dirIcon ${s.dir < 0 ? 'ccw' : ''}`} title={s.dir < 0 ? t('hud.ccw') : t('hud.cw')}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
              <path d="M19.5 3.5v4.6h-4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          {s.pending > 0 && <span className="pen">+{s.pending}</span>}
          {roundLeft != null && (
            <span className={`round-clock ${roundLeft <= 30 ? 'hot' : ''}`} title={t('hud.roundLeft')}>
              ⏱ {Math.floor(roundLeft / 60)}:{String(roundLeft % 60).padStart(2, '0')}
            </span>
          )}
          {s.teams && game.viewer() !== null && (
            <span className={`team-pill t${s.teams[game.viewer()!]}`} title={t('hud.yourTeam')}>{teamName(s.teams[game.viewer()!])}</span>
          )}
          {s.blindTurns > 0 && <span title={t('hud.blindTitle')}>🕶️</span>}
          {s.blitzTurns > 0 && !bombLeft && <span title={t('hud.blitzTitle')}>⚡</span>}
          {bombLeft > 0 && (
            <span className={`bombTimer ${bombLeft <= 3 ? 'hot' : ''}`}>{s.timerKind === 'blitz' ? '⚡' : '💣'} {bombLeft}</span>
          )}
        </div>
      </div>

      <div className="log" aria-live="polite">
        {s.log.slice(-3).map((l, i, arr) => (
          <div key={s.log.length - 3 + i} className={i === arr.length - 1 ? 'new' : ''}>{render(l)}</div>
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
                  <TurnTimer key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="plate-count">{seatP.hand.length}</span>
            </div>
          </div>
          {hint && (
            <span className="hint">
              <b>{hintTitle}</b>
              {hintSub && <small>{hintSub}</small>}
            </span>
          )}
        </div>
        <div className="actions">
          {playing && s.drawn && s.pending === 0 && anyPlay && !s.rules.noMercy && (
            <button className="btn act" onClick={() => game.pass()}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><path d="M5 12h12M13 7l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="act-label">{t('hud.pass')}</span>
            </button>
          )}
          {playing && (s.pending > 0 || !s.drawn) && (
            <button className={`btn act draw ${s.pending ? 'danger' : !anyPlay ? 'primary' : ''}`} onClick={() => game.draw()}>
              {/* a little deck in this table's own card back */}
              <span className="act-deck" aria-hidden>
                <img src={cardImage(null, s.theme ?? 'classic')} alt="" />
                <img src={cardImage(null, s.theme ?? 'classic')} alt="" />
                {s.pending > 0 && <b>+{s.pending}</b>}
              </span>
              <span className="act-label">{s.pending ? t('hud.take', { n: s.pending }) : t('hud.draw')}</span>
            </button>
          )}
        </div>
      </div>

      {playing && s.rules.uno && cur.hand.length === 2 && anyPlay && !s.unoCalled && <UnoCall onCall={() => game.callUno()} />}

      <UnoCatch game={game} online={!!online} />

      <div className="toasts">
        {toasts.map(x => (
          <div key={x.id} className={`toast ${x.big ? 'big' : ''}`}>{render(x.text)}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * The round "UNO!" badges in the game's logo style: an oval with big letters, rings rippling out
 * and a short line under it. `wide`: a longer word ("Caught!") gets a wider oval.
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
  const t = useT();
  return (
    <div className="uno-call-zone">
      <UnoBadge word="UNO!" caption={t('hud.unoCap')} label={t('hud.unoAria')} onClick={onCall} />
    </div>
  );
}

/**
 * Someone is down to one card and nobody heard "UNO!":
 * everyone else gets a big "Caught you!" over the table, the victim gets one last chance to shout it.
 */
function UnoCatch({ game, online }: { game: GameView; online: boolean }) {
  const t = useT();
  if (!game.catchable() || !game.s.unoCatch) return null;
  const s = game.s;
  const victim = s.unoCatch!.victim;
  const v = game.viewer();
  const p = s.players[victim];
  if (v === victim) {
    return (
      <div className="catch-zone">
        <UnoBadge word="UNO!" caption={t('hud.lateCap')} label={t('hud.lateAria')} onClick={() => game.lateUno()} />
      </div>
    );
  }
  // online spectators have no seat to catch from; on a shared screen anyone at the table may press it
  if (online && v === null) return null;
  return (
    <div className="catch-zone">
      <UnoBadge
        wide
        word={t('hud.caught')}
        caption={t('hud.catchCap', { who: p.name })}
        label={t('hud.catchAria', { who: p.name })}
        onClick={() => game.catchUno()}
        avatar={{ id: p.avatar, name: p.name, bot: p.bot }}
      />
    </div>
  );
}
