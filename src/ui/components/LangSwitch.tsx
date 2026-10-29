import { LANGS, setLang, tr, useLang, useT } from '../../i18n';
import './LangSwitch.css';

/**
 * A compact RU / EN / PL toggle. Applies at once, on this screen only: everyone at the table keeps their own language.
 * Each option is labelled in its own language, so it can be found whatever is showing now.
 */
export function LangSwitch({ className = '' }: { className?: string }) {
  const cur = useLang();
  const t = useT();
  return (
    <div className={`lang-switch ${className}`} role="radiogroup" aria-label={t('lang.label')}>
      {LANGS.map(l => (
        <button
          key={l}
          type="button"
          role="radio"
          aria-checked={cur === l}
          className={cur === l ? 'on' : ''}
          lang={l}
          title={tr(l, `lang.name.${l}`)}
          aria-label={tr(l, `lang.name.${l}`)}
          onClick={() => setLang(l)}
        >
          {tr(l, `lang.${l}`)}
        </button>
      ))}
    </div>
  );
}
