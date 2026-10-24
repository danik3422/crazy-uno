import { useEffect, useRef } from 'react';

export interface Banner {
  id: number;
  icon: string;
  title: string;
  sub: string;
}

/** Big flip-in announcement for a random event. Not modal: the game keeps animating behind it. */
export function EventBanner({ banner, onDone }: { banner: Banner; onDone: () => void }) {
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
        <span className="event-tag">Безумное событие</span>
        <strong className="event-title">{banner.title}</strong>
        <span className="event-sub">{banner.sub}</span>
      </div>
    </div>
  );
}
