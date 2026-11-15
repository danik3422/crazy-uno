import { Suspense, useState, type CSSProperties } from 'react';
import { MASCOT_SKINS, skins, useSkins, VAN_SKINS, type MascotSkin, type VanSkin } from '../../../game/skins';
import { useT } from '../../../i18n';
import { lazyFile } from '../../../lib/lazyFile';
import './Skins.css';

/** the 3D previews load on their own, after the page is up */
const SkinStage = lazyFile(() => import('./SkinStage'));

/** Two or three colours of each look, for the tile's badge (kept in step with the 3D models). */
const MASCOT_SWATCH: Record<MascotSkin, string[]> = {
  barrel: ['#2f6bd8', '#f5c518'],
  goose: ['#f7f5ef', '#ff9a1f', '#5d6338'],
  tractor: ['#d8362c', '#2f8f3a', '#7d8590'],
  dog: ['#f4ead8', '#b9773a', '#4f5a2e'],
  blimp: ['#2f6bd8', '#f5c518', '#fffdf6'],
};
const VAN_SWATCH: Record<VanSkin, string[]> = {
  olive: ['#5d6338', '#f5b800'],
  marshrutka: ['#ffcc1f', '#1d3f8a'],
  bavovna: ['#f6f4ee', '#7b6a4a'],
  ship: ['#2f6bd8', '#f5c518', '#7d8590'],
  eggs: ['#141414', '#e6b422'],
};

type Kind = 'mascot' | 'van';

/**
 * The skins tab: the mascot that flies over the table and the van that comes for a knocked-out player.
 * Each has a live 3D preview and a row of looks; pointing at a look previews it, a click keeps it.
 * The choice is this device's own: every player sees the looks they picked.
 */
export function Skins() {
  const t = useT();
  return (
    <div className="skins">
      <header className="skins-head">
        <h1>{t('skins.title')}</h1>
        <p>{t('skins.sub')}</p>
      </header>
      <div className="skins-cols">
        <SkinBlock kind="mascot" />
        <SkinBlock kind="van" />
      </div>
    </div>
  );
}

function SkinBlock({ kind }: { kind: Kind }) {
  const t = useT();
  const chosen = useSkins()[kind];
  const [hover, setHover] = useState<string | null>(null);
  const shown = (hover ?? chosen) as MascotSkin & VanSkin;
  const list: readonly string[] = kind === 'mascot' ? MASCOT_SKINS : VAN_SKINS;
  const swatch = (id: string) => (kind === 'mascot' ? MASCOT_SWATCH[id as MascotSkin] : VAN_SWATCH[id as VanSkin]);
  const name = (id: string) => t(`skin.${kind}.${id}` as Parameters<typeof t>[0]);
  const desc = (id: string) => t(`skinDesc.${kind}.${id}` as Parameters<typeof t>[0]);

  return (
    <section className={`skin-block skin-${kind}`}>
      <h2>{t(`skins.${kind}`)}</h2>
      <div className="skin-stage">
        <Suspense fallback={<span className="skin-stage-wait" aria-hidden />}>
          <SkinStage kind={kind} skin={shown} />
        </Suspense>
      </div>
      <p className="skin-caption" key={shown} aria-live="polite">
        <b>{name(shown)}</b>
        <span>{desc(shown)}</span>
      </p>
      <div className="skin-grid" role="radiogroup" aria-label={t(`skins.${kind}`)} onMouseLeave={() => setHover(null)}>
        {list.map(id => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={chosen === id}
            className={`skin-tile ${chosen === id ? 'on' : ''}`}
            style={{ '--sw': `linear-gradient(135deg, ${swatch(id).map((c, i, a) => `${c} ${(i / a.length) * 100}% ${((i + 1) / a.length) * 100}%`).join(', ')})` } as CSSProperties}
            onMouseEnter={() => setHover(id)}
            onFocus={() => setHover(id)}
            onBlur={() => setHover(null)}
            onClick={() => skins.set(kind === 'mascot' ? { mascot: id as MascotSkin } : { van: id as VanSkin })}
          >
            <span className="skin-badge" aria-hidden>
              <span className="skin-tick">✓</span>
            </span>
            <span className="skin-name">{name(id)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
