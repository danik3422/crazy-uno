import { useT } from '../../../i18n';
import { AUTHOR, PORTFOLIO, REPO } from '../About';
import './HomeFooter.css';

/** Who made it, the code and the trademark note; shown on a computer (a phone has the "About" tab for this). */
export function HomeFooter({ onAbout }: { onAbout: () => void }) {
  const t = useT();
  return (
    <footer className="home-foot">
      <span>{t('foot.by')}: <a href={PORTFOLIO} target="_blank" rel="noopener noreferrer">{AUTHOR}</a></span>
      <span className="hf-sep" aria-hidden>·</span>
      <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a>
      <span className="hf-sep" aria-hidden>·</span>
      <button type="button" onClick={onAbout}>{t('nav.about')}</button>
      <span className="hf-legal">{t('foot.fan')}</span>
    </footer>
  );
}
