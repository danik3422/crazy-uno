import { THEMES_LIST } from '../../game/content';
import type { ThemeId } from '../../game/types';
import { cardImage } from '../../three/textures';

interface Props {
  value: ThemeId;
  onChange?: (t: ThemeId) => void;
  /** read-only for everyone but the host */
  disabled?: boolean;
  /** small swatches with just the name (the lobby); default is big tiles with a description */
  compact?: boolean;
}

/** Four tiles, each a tiny preview of the arena floor with that theme's card back on it. */
export function ThemePicker({ value, onChange, disabled, compact }: Props) {
  return (
    <div className={`theme-grid ${compact ? 'compact' : ''}`} role="radiogroup" aria-label="Оформление стола">
      {THEMES_LIST.map(t => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          disabled={disabled && value !== t.id}
          className={`theme-tile th-${t.id} ${value === t.id ? 'on' : ''}`}
          title={compact ? t.desc : undefined}
          onClick={() => !disabled && onChange?.(t.id)}
        >
          <span className="theme-floor" aria-hidden>
            <img src={cardImage(null, t.id)} alt="" />
            {!compact && <img src={cardImage(null, t.id)} alt="" />}
          </span>
          <b>{t.name}</b>
          {!compact && <small>{t.desc}</small>}
        </button>
      ))}
    </div>
  );
}
