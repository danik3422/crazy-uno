import { useT } from '../../../i18n';
import '../howto/HowTo.css';
import './About.css';

export const AUTHOR = 'Danylo Syloats';
export const PORTFOLIO = 'https://danylodev.com/';
export const REPO = 'https://github.com/danik3422/crazy-uno';
export const PROJECT_PAGE = 'https://danylodev.com/projects/crazy-uno/';
const LICENSE = `${REPO}/blob/main/NOTICE.md`;

/** "About" (a tab of the home screen): who made it, where the code is, and the legal notice about the UNO trademark. */
export function About() {
  const t = useT();
  return (
    <div className="howto about">
      <section className="ht-card">
        <h2>{t('app.title')}</h2>
        <p className="ab-text">{t('about.lead')}</p>
        <div className="ab-links">
          <a className="ab-link" href={PORTFOLIO} target="_blank" rel="noopener noreferrer">
            <small>{t('about.author')}</small>
            <b>{AUTHOR}</b>
            <em>{t('about.portfolio')} ↗</em>
          </a>
          <a className="ab-link" href={PROJECT_PAGE} target="_blank" rel="noopener noreferrer">
            <small>{t('about.project')}</small>
            <b>danylodev.com</b>
            <em>{t('about.projectSub')} ↗</em>
          </a>
          <a className="ab-link" href={REPO} target="_blank" rel="noopener noreferrer">
            <small>GitHub</small>
            <b>danik3422/crazy-uno</b>
            <em>{t('about.repo')} ↗</em>
          </a>
        </div>
      </section>
      <section className="ht-card">
        <h2>{t('about.legal')}</h2>
        <p className="ab-text">{t('about.tm')}</p>
        <p className="ab-text">{t('about.fan')}</p>
        <p className="ab-text">{t('about.nominative')}</p>
        <p className="ab-text">{t('about.free')}</p>
        <p className="ab-text">
          {t('about.license')}{' '}
          <a className="ab-inline" href={LICENSE} target="_blank" rel="noopener noreferrer">{t('about.licenseLink')} ↗</a>
        </p>
        <p className="ab-text muted">{t('about.asis')}</p>
      </section>
      <section className="ht-card">
        <h2>{t('about.privacy')}</h2>
        <p className="ab-text">{t('about.privacyText')}</p>
      </section>
      <section className="ht-card">
        <h2>{t('about.contact')}</h2>
        <p className="ab-text">{t('about.contactText')}</p>
      </section>
      <p className="ab-copy">© {new Date().getFullYear()} {AUTHOR}</p>
    </div>
  );
}
