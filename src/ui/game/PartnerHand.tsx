import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { COLORS } from '../../game/content';
import type { Card } from '../../game/types';
import type { GameView } from '../../game/view';
import { useT } from '../../i18n';
import { cardImage } from '../../three/cards/cardArt';
import { AvatarImg } from '../components/AvatarImg';
import { peek } from './peek';
import './PartnerHand.css';

const ORDER = [...COLORS, 'wild'];
/** by colour, then number, then the action cards: easy to scan */
const sorted = (hand: Card[]) =>
  [...hand].sort((a, b) => ORDER.indexOf(a.color) - ORDER.indexOf(b.color) || (a.value ?? 99) - (b.value ?? 99) || a.type.localeCompare(b.type));

/** how many cards fit on one page of the view, from its width and the screen's height */
function usePageSize(el: React.RefObject<HTMLDivElement | null>, open: boolean) {
  const [size, setSize] = useState({ perRow: 8, rows: 2 });
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const measure = () => {
      const css = getComputedStyle(node);
      const card = parseFloat(css.getPropertyValue('--card-w')) || 76;
      const gap = parseFloat(css.getPropertyValue('--gap')) || 8;
      const perRow = Math.max(3, Math.floor((node.clientWidth + gap) / (card + gap)));
      // a short screen (a phone on its side) has room for one row only
      const rows = window.innerHeight < 520 ? 1 : 2;
      setSize(s => (s.perRow === perRow && s.rows === rows ? s : { perRow, rows }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [el, open]);
  return size;
}

/**
 * The partner's hand, big and in order, over the table (2 on 2 and up). Opened by tapping the partner's plate;
 * it follows the game live and closes with a tap anywhere, Escape, or when the round ends.
 * A big hand (20, 30 cards) is split into pages instead of squeezing the cards together.
 */
export function PartnerHand({ game }: { game: GameView; version: number }) {
  const t = useT();
  const i = useSyncExternalStore(peek.subscribe, peek.get);
  const s = game.s;
  const p = i === null ? null : s.players[i];
  const visible = !!p && p.hand.length > 0 && p.hand.every(c => !c.hidden);
  const grid = useRef<HTMLDivElement>(null);
  const { perRow, rows } = usePageSize(grid, visible);
  const [page, setPage] = useState(0);
  const swipe = useRef<number | null>(null);

  useEffect(() => {
    if (i === null) return;
    setPage(0);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && peek.open(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [i]);
  // the round ended or the hand is no longer ours to see: close
  useEffect(() => {
    if (i !== null && (!visible || s.phase === 'over')) peek.open(null);
  });

  const cards = p && visible ? sorted(p.hand) : [];
  const perPage = perRow * rows;
  const pages = Math.max(1, Math.ceil(cards.length / perPage));
  // the hand shrank (cards were played): stay on a page that still exists
  const at = Math.min(page, pages - 1);
  useEffect(() => {
    if (page !== at) setPage(at);
  }, [page, at]);

  if (!p || !visible) return null;
  const theme = s.theme ?? 'classic';
  const cur = s.cur === i && s.phase !== 'over';
  const shown = cards.slice(at * perPage, (at + 1) * perPage);
  const go = (d: number) => setPage(Math.max(0, Math.min(pages - 1, at + d)));

  return (
    <div className="peek-back" onClick={() => peek.open(null)}>
      <div className="peek" role="dialog" aria-label={t('peek.title', { who: p.name })} onClick={e => e.stopPropagation()}>
        <div className="peek-head">
          <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={40} />
          <div className="peek-who">
            <b>{p.name}</b>
            <small>{cur ? t('peek.moving') : t('peek.cards', { n: p.hand.length })}</small>
          </div>
          <button type="button" className="peek-close" aria-label={t('peek.close')} onClick={() => peek.open(null)}>✕</button>
        </div>
        <div className="peek-body">
          {pages > 1 && (
            <button type="button" className="peek-arrow prev" aria-label={t('peek.prev')} disabled={at === 0} onClick={() => go(-1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
          <div
            ref={grid}
            className="peek-cards"
            style={{ ['--per-row' as string]: perRow }}
            onPointerDown={e => { swipe.current = e.clientX; }}
            onPointerUp={e => {
              if (swipe.current === null) return;
              const dx = e.clientX - swipe.current;
              swipe.current = null;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            }}
          >
            {shown.map((c, k) => (
              <img key={c.id} src={cardImage(c, theme, 80)} alt="" draggable={false} style={{ animationDelay: `${k * 18}ms` }} />
            ))}
          </div>
          {pages > 1 && (
            <button type="button" className="peek-arrow next" aria-label={t('peek.next')} disabled={at === pages - 1} onClick={() => go(1)}>
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          )}
        </div>
        {pages > 1 && (
          <div className="peek-dots">
            {Array.from({ length: pages }, (_, k) => (
              <button key={k} type="button" className={k === at ? 'on' : ''} aria-label={t('peek.page', { n: k + 1, of: pages })} onClick={() => setPage(k)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
