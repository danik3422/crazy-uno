import { useEffect, useState } from 'react';

/**
 * Phones play the game strictly in landscape, ideally full screen.
 * Tablets and computers are left alone: they have room either way.
 */

type FsDoc = Document & { webkitFullscreenElement?: Element | null; webkitFullscreenEnabled?: boolean; webkitExitFullscreen?: () => void };
type FsEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

const isPhoneSized = () => typeof screen !== 'undefined' && Math.min(screen.width, screen.height) <= 600;

/** a touch screen whose short side is phone-sized */
export function isPhone() {
  if (typeof window === 'undefined') return false;
  return matchMedia('(pointer: coarse)').matches && isPhoneSized();
}

export const isIOS = () =>
  typeof navigator !== 'undefined' && (/iPhone|iPod|iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/** opened from the home screen (no browser bars at all) */
export const isStandalone = () =>
  typeof window !== 'undefined' &&
  (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

/**
 * The browser can take the page full screen (Android Chrome, Samsung, Firefox). Never the iPhone: Safari there has no
 * Fullscreen API for pages (only for <video>) and no orientation lock, so no button may promise either on iOS.
 */
export function canFullscreen() {
  if (typeof document === 'undefined') return false;
  if (isIOS() && isPhoneSized()) return false;
  const d = document as FsDoc;
  const el = document.documentElement as FsEl;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !!(el.requestFullscreen || el.webkitRequestFullscreen);
}

const isFullscreen = () => {
  if (typeof document === 'undefined') return false;
  const d = document as FsDoc;
  return !!(d.fullscreenElement || d.webkitFullscreenElement);
};

/**
 * Full screen, then hold the screen in landscape (Android turns the picture by itself).
 * Must be called from a tap. Never throws: on a phone that can't, nothing happens.
 */
export async function enterFullscreen() {
  if (!isPhone()) return;
  try {
    if (!isFullscreen() && canFullscreen()) {
      const el = document.documentElement as FsEl;
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    /* the browser said no: the rotate screen still explains what to do */
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
  } catch {
    /* orientation lock needs full screen and is missing on some phones */
  }
}

export interface PhoneState {
  phone: boolean;
  portrait: boolean;
  fullscreen: boolean;
}

const read = (): PhoneState => ({
  phone: isPhone(),
  portrait: typeof window !== 'undefined' && window.innerHeight > window.innerWidth,
  fullscreen: isFullscreen() || isStandalone(),
});

/** Live phone / orientation / full screen state. */
export function usePhone(): PhoneState {
  const [st, setSt] = useState(read);
  useEffect(() => {
    const upd = () => setSt(prev => {
      const n = read();
      return n.phone === prev.phone && n.portrait === prev.portrait && n.fullscreen === prev.fullscreen ? prev : n;
    });
    // iOS can fire `resize` before the new size is readable (home-screen app, turning over 180°, coming back from
    // the lock screen turned): the orientation query and a late re-read on pageshow / becoming visible catch it
    const mq = matchMedia('(orientation: portrait)');
    const late = () => { upd(); setTimeout(upd, 250); };
    const onVisible = () => { if (document.visibilityState === 'visible') late(); };
    window.addEventListener('resize', upd);
    window.addEventListener('orientationchange', late);
    window.addEventListener('pageshow', late);
    document.addEventListener('visibilitychange', onVisible);
    mq.addEventListener('change', upd);
    document.addEventListener('fullscreenchange', upd);
    document.addEventListener('webkitfullscreenchange', upd);
    return () => {
      window.removeEventListener('resize', upd);
      window.removeEventListener('orientationchange', late);
      window.removeEventListener('pageshow', late);
      document.removeEventListener('visibilitychange', onVisible);
      mq.removeEventListener('change', upd);
      document.removeEventListener('fullscreenchange', upd);
      document.removeEventListener('webkitfullscreenchange', upd);
    };
  }, []);
  return st;
}

/** a narrow or very short screen: menus get compact (phones either way round) */
export const SMALL_SCREEN = '(max-width: 760px), (orientation: landscape) and (max-height: 520px)';

export function useMedia(query: string) {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const upd = () => setOn(m.matches);
    upd();
    m.addEventListener('change', upd);
    return () => m.removeEventListener('change', upd);
  }, [query]);
  return on;
}
