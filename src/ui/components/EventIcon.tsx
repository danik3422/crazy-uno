import type { EventId } from '../../game/types';
import { eventIconUrl } from '../../three/themes/eventIcons';
import './EventIcon.css';

/** An event's drawn icon as an image (painted once per size, then cached). */
export function EventIcon({ id, size = 24, className }: { id: EventId; size?: number; className?: string }) {
  // painted at twice the shown size, so it stays crisp on dense screens
  const px = Math.min(512, Math.ceil(size * 2) * 1.25);
  return <img className={className ?? 'ev-ico'} src={eventIconUrl(id, Math.round(px))} alt="" aria-hidden width={size * 1.25} height={size * 1.25} draggable={false} />;
}
