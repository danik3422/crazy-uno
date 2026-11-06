import { useSyncExternalStore } from 'react';
import { ACHIEVEMENTS } from '../../../game/stats';
import { useT } from '../../../i18n';
import { LangMenu } from '../../components/LangMenu';
import { profile } from '../../profile/store';
import './HomeNav.css';

export type HomeTab = 'play' | 'profile' | 'howto' | 'about';
const TABS: HomeTab[] = ['play', 'profile', 'howto', 'about'];

const TAB_ICON: Record<HomeTab, JSX.Element> = {
  play: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><rect x="8.5" y="3" width="10" height="14" rx="2" transform="rotate(12 13.5 10)" fill="none" stroke="currentColor" strokeWidth="2.2" /><rect x="4.5" y="6" width="10" height="14" rx="2" transform="rotate(-8 9.5 13)" fill="currentColor" /></svg>,
  profile: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M7 4h10v4a5 5 0 0 1-10 0z" fill="currentColor" /><path d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3M17 6h2.5a2.5 2.5 0 0 1-2.6 3M10.5 13h3l.6 4h-4.2zM8 18h8v2.5H8z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>,
  howto: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d="M4 5.5C6.5 4 9.5 4 12 5.8 14.5 4 17.5 4 20 5.5V19c-2.5-1.4-5.5-1.4-8 .4-2.5-1.8-5.5-1.8-8-.4z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" /><path d="M12 5.8v13.6" stroke="currentColor" strokeWidth="2" /></svg>,
  about: <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.2" /><path d="M12 10.5v6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="12" cy="7.4" r="1.5" fill="currentColor" /></svg>,
};

/**
 * The home screen's tabs (play, profile, how to play, about) and the language: at the top on a computer,
 * at the bottom of a phone held upright, down the left side of a phone on its side.
 */
export function HomeNav({ tab, onTab }: { tab: HomeTab; onTab: (tab: HomeTab) => void }) {
  const t = useT();
  useSyncExternalStore(profile.subscribe, profile.getVersion);
  const unlocked = ACHIEVEMENTS.filter(a => profile.get().unlocked[a.id]).length;
  return (
    <nav className="home-nav" aria-label={t('nav.aria')}>
      {TABS.map(k => (
        <button key={k} type="button" data-nav={k} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined} onClick={() => onTab(k)}>
          <span className="hn-ico">{TAB_ICON[k]}</span>
          <span className="hn-label">{t(`nav.${k}`)}</span>
          {k === 'profile' && <em className="hn-count">{unlocked}/{ACHIEVEMENTS.length}</em>}
        </button>
      ))}
      <LangMenu nav />
    </nav>
  );
}
