import { uiIconUrl, type UiIconName } from '../../art/uiIcons';
import './UiIcon.css';

/** A small drawn icon (see src/art/uiIcons.ts), crisp on dense screens. Decorative: hidden from screen readers. */
export function UiIcon({ name, size = 20, className = '' }: { name: UiIconName; size?: number; className?: string }) {
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(3, Math.max(2, devicePixelRatio)) : 2;
  const px = Math.ceil((size * dpr) / 8) * 8;
  return (
    <img
      className={`ui-ico ${className}`}
      src={uiIconUrl(name, px)}
      alt=""
      aria-hidden
      width={size}
      height={size}
      draggable={false}
    />
  );
}
