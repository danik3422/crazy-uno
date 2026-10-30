import type { CSSProperties } from 'react';
import { THEMES_LIST } from '../../game/content';
import { t } from '../../i18n';
import type { Card, ThemeId } from '../../game/types';
import { cardImage } from '../../three/textures';
import { THEMES } from '../../three/themes';
import './ThemePicker.css';

interface Props {
  value: ThemeId;
  onChange?: (t: ThemeId) => void;
  /** read-only for everyone but the host */
  disabled?: boolean;
  /** small swatches with just the name (the lobby); default is big tiles with a description */
  compact?: boolean;
}

/** two faces shown fanned out over each theme's back, so the tile previews that table's cards */
const PREVIEW: Card[] = [
  { id: 1, color: 'red', type: 'num', value: 7 },
  { id: 2, color: 'wild', type: 'wild' },
];

/** The tile's backdrop in the theme's own colours (kept in step with its palette). */
function tileStyle(id: ThemeId): CSSProperties {
  const p = THEMES[id].palette.red;
  const glow = THEMES[id].glow;
  return {
    '--th-in': p.inner,
    '--th-mid': p.mid,
    '--th-out': p.outer,
    '--th-glow': glow,
  } as CSSProperties;
}

/**
 * The table looks as tiles: each a little arena in that theme's colours with its back and two of its faces fanned out.
 * Hovering spreads the fan; the chosen one lifts, glows in its own colour and gets a tick.
 */
export function ThemePicker({ value, onChange, disabled, compact }: Props) {
  const chosen = THEMES_LIST.find(t => t.id === value);
  return (
    <div className={`theme-picker ${compact ? 'compact' : ''}`}>
      <div className="theme-grid" role="radiogroup" aria-label={t('theme.aria')}>
        {THEMES_LIST.map(t => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={value === t.id}
            disabled={disabled && value !== t.id}
            className={`theme-tile th-${t.id} ${value === t.id ? 'on' : ''}`}
            style={tileStyle(t.id)}
            title={compact ? t.desc : undefined}
            onClick={() => !disabled && onChange?.(t.id)}
          >
            <span className="theme-floor" aria-hidden>
              <span className="theme-fan">
                <img src={cardImage(PREVIEW[0], t.id, 50)} alt="" />
                <img src={cardImage(null, t.id, 50)} alt="" />
                <img src={cardImage(PREVIEW[1], t.id, 50)} alt="" />
              </span>
              <span className="theme-tick">✓</span>
            </span>
            <b>{t.name}</b>
            {!compact && <small>{t.desc}</small>}
          </button>
        ))}
      </div>
      {/* the lobby's small swatches have no room for descriptions: the chosen one is spelled out under them */}
      {compact && chosen && (
        <p className="theme-now" key={chosen.id}>
          <b>{chosen.name}</b> · {chosen.desc}
        </p>
      )}
    </div>
  );
}
