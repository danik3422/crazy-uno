import type { Card } from '../../../game/types';
import type { GameView } from '../../../game/view';
import { useT } from '../../../i18n';
import { cardImage } from '../../../three/cards/cardArt';
import { AvatarImg } from '../../components/AvatarImg';
import { ReactionBubble } from '../Reactions';
import { TurnTimer } from '../TurnTimer';

interface Props {
  game: GameView;
  locked: boolean;
  playing: boolean;
  anyPlay: boolean;
  jumpCard: Card | undefined;
  /** what to do now, "title|second line" (see turnHint) */
  hint: string;
}

/** The bottom of the screen: your plate (name, face, turn clock, card count), the hint next to it, and draw / pass. */
export function MyDock({ game, locked, playing, anyPlay, jumpCard, hint }: Props) {
  const t = useT();
  const s = game.s;
  const me = s.players[game.seat()];
  const cur = game.cp();
  const theme = s.theme ?? 'classic';
  const myTurn = game.viewer() !== null && game.viewer() === s.cur;
  const [hintTitle, hintSub = ''] = hint.split('|');
  return (
    <div className={`hud-bottom ${playing ? 'my-turn' : ''}`}>
      <div className="me">
        <ReactionBubble seat={game.seat()} mine />
        {/* whose turn, at a glance: your card wears a gold tag while it is yours */}
        {playing && <span className="me-turn-tag">{t('hud.yourTurnTag')}</span>}
        <div className={`plate me-plate ${s.cur === game.seat() && s.phase !== 'over' ? 'cur' : ''}`}>
          <div className="plate-name">{me.name}</div>
          <div className="plate-body">
            <span className="ava-wrap">
              <AvatarImg id={me.avatar} name={me.name} bot={me.bot} size={58} className="plate-ava" />
              {!locked && s.cur === game.seat() && s.turnDeadline !== null && s.phase !== 'over' && (
                <TurnTimer key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
              )}
            </span>
            <span className="plate-count">{me.hand.length}</span>
          </div>
        </div>
        {hint && (
          <span className={`hint ${jumpCard ? 'jump' : ''}`}>
            {jumpCard && <img className="jump-card" src={cardImage(jumpCard, theme, 30)} alt="" aria-hidden />}
            <b>
              {/* someone else is moving: their face next to the words */}
              {!myTurn && !jumpCard && s.phase !== 'over' && s.cur !== game.seat() && (
                <AvatarImg id={cur.avatar} name={cur.name} bot={cur.bot} size={22} className="hint-ava" />
              )}
              {hintTitle}
            </b>
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
              <img src={cardImage(null, theme, 20)} alt="" />
              <img src={cardImage(null, theme, 20)} alt="" />
              {s.pending > 0 && <b>+{s.pending}</b>}
            </span>
            <span className="act-label">{s.pending ? t('hud.take', { n: s.pending }) : t('hud.draw')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
