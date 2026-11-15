import { useEffect, type CSSProperties } from 'react';
import { CNAME, COLORS, HEX } from '../../game/content';
import type { Color } from '../../game/types';
import { useT } from '../../i18n';
import { UiIcon } from '../components/UiIcon';
import './ColorPick.css';

interface Props {
  title: string;
  /** how many cards of each colour are in your hand */
  counts: Record<Color, number>;
  onPick: (c: Color) => void;
}

const KEYS: Record<string, Color> = { 1: 'red', 2: 'yellow', 3: 'green', 4: 'blue' };

/**
 * Choosing the colour after a wild: four small cards in the table's colours, each showing how many of that colour
 * you hold (the same little card glyph as on the player plates). The colour you hold most of wears a crown and
 * has the focus, so the usual best answer is one glance (or one Enter) away. Keys 1–4 pick too.
 */
export function ColorPick({ title, counts, onPick }: Props) {
  const t = useT();
  const most = Math.max(...COLORS.map(c => counts[c]));
  // the first colour you hold most of: crowned and focused
  const best = most > 0 ? COLORS.find(c => counts[c] === most) : undefined;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const c = KEYS[e.key];
      if (!c) return;
      e.preventDefault();
      onPick(c);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onPick]);

  return (
    <div className="cpick">
      <h2 className="cpick-title">{title}</h2>
      <div className="cpick-row">
        {COLORS.map((c, i) => (
          <button
            key={c}
            className={`cpick-card${c === best ? ' best' : ''}${counts[c] ? '' : ' none'}`}
            data-color={c}
            style={{ '--c': HEX[c], '--i': i } as CSSProperties}
            autoFocus={c === best}
            aria-label={`${CNAME[c]}: ${t('ov.inHand', { n: counts[c] })}`}
            onClick={() => onPick(c)}
          >
            <span className="cpick-face" aria-hidden>
              <span className="cpick-oval">
                <span className="cpick-n">{counts[c]}</span>
              </span>
              {c === best && <UiIcon name="crown" size={22} className="cpick-crown" />}
              <kbd className="cpick-key">{i + 1}</kbd>
            </span>
            <span className="cpick-name" aria-hidden>{CNAME[c]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
