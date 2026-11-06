import { useEffect, useLayoutEffect, useRef } from 'react';
import type { EventId, ThemeId } from '../../game/types';
import { render, useT, type Msg } from '../../i18n';
import { eventIconUrl } from '../../three/themes/eventIcons';
import './EventBanner.css';

export interface Banner {
  id: number;
  event: EventId | null;
  title: Msg | null;
  sub: Msg | null;
  /** a dialog is up with the event (group dare, coin toss…): the card keeps to the top edge, out of its way */
  top: boolean;
}

/** how long the card stays (its exit animation ends right then; see EventBanner.css) */
const BANNER_MS = 3000;

/**
 * The event card: a ticket that drops in over the middle of the table (clear of the hand, the plates and
 * the buttons) with the event's drawn icon, its name and what it did, dressed in the table's own style
 * (gold game show, neon tubes, hologram, parchment). Not modal: the game keeps animating behind it.
 */
export function EventBanner({ banner, theme, onDone }: { banner: Banner; theme: ThemeId; onDone: () => void }) {
  const t = useT();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), BANNER_MS);
    return () => clearTimeout(t);
  }, []);
  // a long one-word name ("Бомбардировщик!") shrinks to fit rather than break mid-word
  const title = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = title.current;
    if (!el) return;
    el.style.fontSize = '';
    let size = parseFloat(getComputedStyle(el).fontSize);
    while (el.scrollWidth > el.clientWidth + 1 && size > 12) {
      size -= 1;
      el.style.fontSize = `${size}px`;
    }
  }, [banner.title]);
  const ev = banner.event;
  return (
    <div className={`event th-${theme} ${ev ? `ev-${ev}` : ''} ${banner.top ? 'top' : 'mid'}`} role="status">
      <div className="event-fly">
        <div className="event-aura" aria-hidden />
        <div className="event-frame">
          <div className="event-card">
            <div className="event-stub" aria-hidden>
              <span className="event-halo" />
              {ev && <img className="event-icon" src={eventIconUrl(ev, 192)} alt="" draggable={false} />}
            </div>
            <div className="event-body">
              <span className="event-tag">{t('event.tag')}</span>
              <strong className="event-title" ref={title}>{render(banner.title)}</strong>
              <span className="event-sub">{render(banner.sub)}</span>
            </div>
            <span className="event-shine" aria-hidden />
            <span className="event-deco" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
