import { useEffect, useRef } from 'react';
import { render, useT, type Msg } from '../../i18n';
import './EventBanner.css';

export interface Banner {
  id: number;
  icon: string;
  title: Msg | null;
  sub: Msg | null;
}

/** Big flip-in announcement for a random event. Not modal: the game keeps animating behind it. */
export function EventBanner({ banner, onDone }: { banner: Banner; onDone: () => void }) {
  const t = useT();
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="event" role="status">
      <div className="event-rays" aria-hidden />
      <div className="event-card">
        <span className="event-icon">{banner.icon}</span>
        <span className="event-tag">{t('event.tag')}</span>
        <strong className="event-title">{render(banner.title)}</strong>
        <span className="event-sub">{render(banner.sub)}</span>
      </div>
    </div>
  );
}
