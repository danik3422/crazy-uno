import type { CSSProperties } from 'react';
import { CNAME, COLORS, HEX } from '../../game/content';
import type { Color } from '../../game/types';
import { useT } from '../../i18n';
import { UiIcon } from '../components/UiIcon';
import { GamePanel } from './GamePanel';
import './ColorPick.css';

interface Props {
  title: string;
  /** how many cards of each colour are in your hand */
  counts: Record<Color, number>;
  onPick: (c: Color) => void;
}

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

  return (
    <GamePanel
      className="cpick"
      title={title}
      keys={Object.fromEntries(COLORS.map((c, i) => [String(i + 1), () => onPick(c)]))}
    >
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
    </GamePanel>
  );
}
