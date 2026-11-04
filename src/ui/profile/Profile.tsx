import { useEffect, useState, useSyncExternalStore } from 'react';
import { CNAME, HEX } from '../../game/content';
import { ACHIEVEMENTS, type Achievement, favouriteColor } from '../../game/stats';
import { useLang, useT } from '../../i18n';
import { AvatarImg } from '../components/AvatarImg';
import { Badge } from './Badge';
import { profile } from './store';
import './Profile.css';

type Filter = 'all' | 'open' | 'progress';

/**
 * The player's profile (a tab of the home screen): who they are, three big numbers and the rest in a compact grid,
 * then the achievements as a grid of medals. Tap a medal for what it takes and how far along you are.
 */
export function Profile({ name, avatar }: { name: string; avatar: string }) {
  const t = useT();
  const lang = useLang();
  useSyncExternalStore(profile.subscribe, profile.getVersion);
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<Achievement | null>(null);
  const s = profile.get();
  const fav = favouriteColor(s);
  const done = ACHIEVEMENTS.filter(a => s.unlocked[a.id]).length;
  const rate = s.games ? Math.round((s.wins / s.games) * 100) : 0;

  const big: [string, string][] = [
    [String(s.games), t('profile.games')],
    [String(s.wins), t('profile.wins')],
    [`${rate}%`, t('profile.rate')],
  ];
  const small: [string, string][] = [
    [String(s.bestStreak), t('profile.streak')],
    [s.fastestWin === null ? t('profile.none') : String(s.fastestWin), t('profile.fastest')],
    [String(s.cardsPlayed), t('profile.played')],
    [String(s.cardsDrawn), t('profile.drawn')],
    [String(s.unoCalls), t('profile.uno')],
    [String(s.biggestHand), t('profile.biggest')],
    [String(s.bigDraws), t('profile.bigDraws')],
    [String(s.catches), t('profile.catches')],
    [String(s.jumpIns), t('profile.jumps')],
  ];

  // the unlocked first, newest on top; then the locked, closest to done first
  const list = [...ACHIEVEMENTS]
    .filter(a => (filter === 'open' ? !!s.unlocked[a.id] : filter === 'progress' ? !s.unlocked[a.id] : true))
    .sort((a, b) => {
      const ua = s.unlocked[a.id] ?? 0, ub = s.unlocked[b.id] ?? 0;
      if (ua || ub) return ub - ua;
      const [na, ga] = a.progress(s), [nb, gb] = b.progress(s);
      return nb / gb - na / ga;
    });

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const date = (ms: number) => new Date(ms).toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="profile">
      <section className="prof-card prof-me">
        <div className="prof-head">
          <AvatarImg id={avatar} name={name} bot={false} size={72} className="prof-ava" />
          <div className="prof-who">
            <h1>{name || t('profile.title')}</h1>
            <div className="prof-sub">
              <span className="prof-pill gold">
                <Badge glyph="trophy" tier="gold" size={18} />
                {t('profile.achCount', { n: done, all: ACHIEVEMENTS.length })}
              </span>
              {fav && (
                <span className="prof-pill" title={t('profile.fav')}>
                  <span className="prof-dot" style={{ background: HEX[fav] }} />{CNAME[fav]}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="prof-big">
          {big.map(([v, k]) => <div key={k}><b>{v}</b><small>{k}</small></div>)}
        </div>
        {s.games === 0 && <p className="prof-empty">{t('profile.empty')}</p>}
        <div className="prof-tiles">
          {small.map(([v, k]) => <div key={k} className="prof-tile"><b>{v}</b><small>{k}</small></div>)}
        </div>
      </section>

      <section className="prof-card prof-ach">
        <div className="ach-top">
          <h2>{t('profile.ach')}</h2>
          <div className="ach-bar" aria-hidden><span style={{ width: `${(done / ACHIEVEMENTS.length) * 100}%` }} /></div>
          <div className="ach-filter" role="tablist">
            {(['all', 'open', 'progress'] as const).map(f => (
              <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                {t(`profile.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="ach-grid">
          {list.map(a => {
            const got = !!s.unlocked[a.id];
            const [now, goal] = a.progress(s);
            return (
              <button key={a.id} type="button" className={`ach ${got ? 'done' : ''}`} onClick={() => setOpen(a)}>
                <Badge glyph={a.glyph} tier={a.tier} locked={!got} size={46} />
                <span className="ach-name">{t(`ach.${a.id}`)}</span>
                {got
                  ? <span className="ach-ok" aria-hidden>✓</span>
                  : <span className="ach-mini" aria-hidden><span style={{ width: `${(now / goal) * 100}%` }} /></span>}
              </button>
            );
          })}
          {!list.length && <p className="prof-empty">{t('profile.noneYet')}</p>}
        </div>
        <p className="prof-note">{t('profile.note')}</p>
      </section>

      {open && (() => {
        const got = s.unlocked[open.id];
        const [now, goal] = open.progress(s);
        return (
          <div className="ach-sheet-back" onClick={() => setOpen(null)}>
            <div className={`ach-sheet ${got ? 'done' : ''}`} role="dialog" aria-label={t(`ach.${open.id}`)} onClick={e => e.stopPropagation()}>
              <Badge glyph={open.glyph} tier={open.tier} locked={!got} size={92} />
              <h3>{t(`ach.${open.id}`)}</h3>
              <p>{t(`achDesc.${open.id}`)}</p>
              {got ? (
                <span className="ach-when">{t('profile.got', { date: date(got) })}</span>
              ) : (
                <span className="ach-prog"><span style={{ width: `${(now / goal) * 100}%` }} /><em>{now} / {goal}</em></span>
              )}
              <span className={`ach-tier tier-${open.tier}`}>{t(`profile.tier.${open.tier}`)}</span>
              <button type="button" className="btn" onClick={() => setOpen(null)}>{t('peek.close')}</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
