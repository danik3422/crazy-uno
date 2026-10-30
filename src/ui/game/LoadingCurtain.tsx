import type { State } from '../../game/types';
import { useT } from '../../i18n';
import type { Warmup } from '../../net/protocol';
import { AvatarImg } from '../components/AvatarImg';
import { CardLoader, loaderStage } from '../components/CardLoader';
import { UiIcon } from '../components/UiIcon';
import './LoadingCurtain.css';

interface Props {
  s: State;
  /** fading out: the shuffle has started */
  leaving: boolean;
  /** online only: who is still loading */
  warmup: Warmup | null;
  /** online only: who still holds their phone upright */
  turning: number[];
  /** host only: offer to deal without the phones that stay upright */
  onDealNow?: () => void;
}

/** "Setting the table": covers the table while it loads, and online shows who everybody is waiting for. */
export function LoadingCurtain({ s, leaving, warmup, turning, onDealNow }: Props) {
  const t = useT();
  const sub = turning.length
    ? t('load.upright')
    : warmup && warmup.waiting.length
      ? t('load.loading')
      : t('load.second');
  return (
    <div className={`loading-screen ${leaving ? 'leaving' : ''}`} style={{ background: loaderStage(s.theme, s.color) }}>
      <CardLoader theme={s.theme} title={t('load.title')} sub={sub}>
        {warmup && (
          <ul className="ready-list">
            {s.players.map((p, i) => {
              const loading = warmup.waiting.includes(i);
              const upright = turning.includes(i);
              return (
                <li key={i} className={loading ? '' : upright ? 'turn' : 'ok'}>
                  <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={28} />
                  {p.name}
                  <span className="st">
                    {loading ? <span className="dot-pulse" /> : upright ? <span className="turn-ic" title={t('load.turning')}><UiIcon name="phone" size={18} /></span> : '✓'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {onDealNow && (
          <button type="button" className="btn deal-now" onClick={onDealNow}>
            {t('load.force')}
          </button>
        )}
      </CardLoader>
    </div>
  );
}
