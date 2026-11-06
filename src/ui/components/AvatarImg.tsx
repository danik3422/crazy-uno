import { useEffect, useLayoutEffect, useReducer, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { avatarPx, avatarUrl, peekAvatarUrl, requestAvatarUrl } from '../../art/avatarArt';
import { type Avatar, AVATAR_PAGE, avatarOf, BOT_AVATARS, HUMAN_AVATARS } from '../../game/avatars';
import { useT } from '../../i18n';
import './AvatarImg.css';

interface Props {
  id?: string;
  name: string;
  bot: boolean;
  size?: number;
  className?: string;
}

export function AvatarImg({ id, name, bot, size = 64, className = '' }: Props) {
  return <AvatarTile a={avatarOf(id, name, bot)} size={size} className={className} />;
}

/**
 * The drawn portrait on its tile. Painted right away (one picture is cheap), or with `lazy` in idle time
 * (the picker asks for a whole page at once); until then the tile shows its gradient.
 */
function AvatarTile({ a, size = 64, className = '', lazy = false }: { a: Avatar; size?: number; className?: string; lazy?: boolean }) {
  const px = avatarPx(size);
  const [, ready] = useReducer((x: number) => x + 1, 0);
  const cached = peekAvatarUrl(a.id, px);
  const src = cached ?? (lazy ? undefined : avatarUrl(a.id, px));
  useEffect(() => (src ? undefined : requestAvatarUrl(a.id, px, ready)), [a.id, px, src]);
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${a.bg[0]}, ${a.bg[1]})` }}
      role="img"
      aria-label={a.label}
    >
      {src && <img src={src} alt="" draggable={false} className={cached || !lazy ? '' : 'fresh'} />}
    </span>
  );
}

const chunk = <T,>(list: readonly T[], n: number) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/**
 * Avatar picker in a dialog: pages of 24 with arrows, page dots, swipe and keyboard arrows,
 * a sliding change of page and the chosen one highlighted. `pool` picks people (default) or robots.
 */
export function AvatarPicker({
  value, onChange, onClose, pool = 'human', title,
}: { value: string; onChange: (id: string) => void; onClose: () => void; pool?: 'human' | 'bot'; title?: string }) {
  const t = useT();
  const list = pool === 'bot' ? BOT_AVATARS : HUMAN_AVATARS;
  const pages = chunk(list, AVATAR_PAGE);
  const start = Math.max(0, Math.floor(list.findIndex(a => a.id === value) / AVATAR_PAGE));
  const [page, setPage] = useState(start);
  // pages are filled in as they come near, so the first one paints first
  const [seen, setSeen] = useState(() => new Set([start, start + 1, start - 1]));
  const [drag, setDrag] = useState(0);
  const swipe = useRef<{ x: number; y: number; id: number; moved: boolean } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const view = useRef<HTMLDivElement>(null);

  const go = (p: number) => {
    const n = Math.max(0, Math.min(pages.length - 1, p));
    setPage(n);
    setSeen(s => (s.has(n) && s.has(n + 1) && s.has(n - 1) ? s : new Set([...s, n, n + 1, n - 1])));
  };

  // focus the chosen avatar on open; give focus back to whatever opened the picker on close
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const on = panel.current?.querySelector<HTMLElement>('.ava-cell[aria-checked="true"]') ?? panel.current?.querySelector<HTMLElement>('.ava-cell');
    on?.focus({ preventScroll: true });
    return () => before?.focus?.({ preventScroll: true });
  }, []);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
    } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
      e.preventDefault();
      go(page + 1);
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      go(page - 1);
    }
  };

  // keep keyboard focus on the visible page after a page change
  useEffect(() => {
    const cur = panel.current?.querySelectorAll<HTMLElement>('.ava-page')[page];
    if (cur && panel.current?.contains(document.activeElement) && !cur.contains(document.activeElement) && document.activeElement?.classList.contains('ava-cell')) {
      cur.querySelector<HTMLElement>('.ava-cell')?.focus({ preventScroll: true });
    }
  }, [page]);

  const down = (e: RPointerEvent) => {
    if (e.pointerType === 'mouse' || pages.length < 2) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false };
  };
  const move = (e: RPointerEvent) => {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      s.moved = true;
      view.current?.setPointerCapture(e.pointerId);
    }
    if (s.moved) {
      // resist past the first and last page
      const edge = (page === 0 && dx > 0) || (page === pages.length - 1 && dx < 0);
      setDrag(edge ? dx * 0.3 : dx);
    }
  };
  const up = (e: RPointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    setDrag(0);
    if (s.moved) {
      const w = view.current?.clientWidth ?? 300;
      if (dx < -Math.min(60, w * 0.18)) go(page + 1);
      else if (dx > Math.min(60, w * 0.18)) go(page - 1);
      // a swipe is not a tap on the avatar it started on
      const stop = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', stop, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
    }
  };

  const multi = pages.length > 1;
  return createPortal(
    <div className="ava-dlg-back" onPointerDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={panel}
        className="ava-dlg"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? t('avatarPick')}
        onKeyDown={onKey}
      >
        <div className="ava-head">
          <h2>{title ?? t('avatarPick')}</h2>
          {multi && <span className="ava-count" aria-live="polite">{t('avatar.page', { n: page + 1, total: pages.length })}</span>}
          <button type="button" className="ava-close" onClick={onClose} aria-label={t('avatar.close')}>✕</button>
        </div>
        <div className="ava-body">
          {multi && (
            <button type="button" className="ava-arrow prev" onClick={() => go(page - 1)} disabled={page === 0} aria-label={t('avatar.prev')}>
              <Chevron />
            </button>
          )}
          <div
            ref={view}
            className="ava-view"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <div
              className={`ava-track ${drag ? 'dragging' : ''}`}
              style={{ transform: `translateX(calc(${-page * 100}% + ${drag}px))` }}
              role="radiogroup"
              aria-label={title ?? t('avatarPick')}
            >
              {pages.map((items, i) => (
                <div className="ava-page" key={i} aria-hidden={i !== page} {...(i !== page ? { inert: "" } : {})}>
                  {seen.has(i) &&
                    items.map(a => (
                      <button
                        key={a.id}
                        type="button"
                        role="radio"
                        aria-checked={value === a.id}
                        className={`ava-cell ${value === a.id ? 'on' : ''}`}
                        onClick={() => onChange(a.id)}
                        title={a.label}
                      >
                        <AvatarTile a={a} size={72} lazy />
                      </button>
                    ))}
                </div>
              ))}
            </div>
          </div>
          {multi && (
            <button type="button" className="ava-arrow next" onClick={() => go(page + 1)} disabled={page === pages.length - 1} aria-label={t('avatar.next')}>
              <Chevron />
            </button>
          )}
        </div>
        {multi && (
          <div className="ava-dots">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === page ? 'on' : ''}
                onClick={() => go(i)}
                aria-label={t('avatar.page', { n: i + 1, total: pages.length })}
                aria-current={i === page ? 'page' : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const Chevron = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
    <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
