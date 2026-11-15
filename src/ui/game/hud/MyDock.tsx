import { useLayoutEffect, useRef, type RefObject } from 'react';
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
  const textRef = useRef<HTMLSpanElement>(null);
  useFitHint(textRef, hint);
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
            {/* someone else is moving: their face beside the words (its own column, the text never wraps under it) */}
            {!locked && !myTurn && !jumpCard && s.phase !== 'over' && s.cur !== game.seat() && (
              <AvatarImg id={cur.avatar} name={cur.name} bot={cur.bot} size={22} className="hint-ava" />
            )}
            <span className="hint-text" ref={textRef}>
              <b>{hintTitle}</b>
              {hintSub && <small>{hintSub}</small>}
            </span>
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

/** The smallest the title may get before it is cut with "…" (CSS pixels). */
const MIN_TITLE_PX = 10.5;

/**
 * Where the hint has to keep to one line (a phone on its side: the panel beside your hand is narrow), the title
 * steps its font down until it fits the column, and only then is cut with "…"; the second line shows only when it
 * fits its (at most two) lines. Elsewhere the text wraps as usual and nothing here changes it.
 */
function useFitHint(ref: RefObject<HTMLSpanElement | null>, text: string) {
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    const hint = box.parentElement;
    // fractional widths: scrollWidth rounds, and a text 0.4 px too wide already gets its "…"
    const range = document.createRange();
    const over = (title: HTMLElement) => {
      range.selectNodeContents(title);
      return range.getBoundingClientRect().width > title.getBoundingClientRect().width + 0.1;
    };
    const fitTitle = (title: HTMLElement) => {
      title.style.fontSize = '';
      let size = parseFloat(getComputedStyle(title).fontSize);
      while (over(title) && size > MIN_TITLE_PX) {
        size = Math.max(MIN_TITLE_PX, size - 0.5);
        title.style.fontSize = `${size}px`;
      }
      return !over(title);
    };
    const fit = () => {
      const title = box.querySelector('b');
      const sub = box.querySelector('small');
      if (!title) return;
      hint?.classList.remove('hint-narrow');
      sub?.classList.remove('hint-cut');
      if (getComputedStyle(title).whiteSpace === 'nowrap' && !fitTitle(title) && hint?.querySelector('.hint-ava')) {
        // still too long: the mover's small face gives its room to the words (their plate shows whose turn it is)
        hint.classList.add('hint-narrow');
        fitTitle(title);
      }
      // a second line that would be cut short says nothing: leave it out
      if (sub && sub.scrollHeight > sub.clientHeight + 1) sub.classList.add('hint-cut');
    };
    fit();
    // refit on the next frame, not inside the observer's callback: the refit itself resizes the panel it watches
    let frame = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    // the screen turning, and the panel's own width (--dock-side, set by the table layout once it has measured)
    ro.observe(box.closest('.hud-bottom') ?? box);
    if (hint?.parentElement) ro.observe(hint.parentElement);
    // the display font may still be loading: measure again once it is in
    void document.fonts?.ready.then(fit);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [ref, text]);
}
