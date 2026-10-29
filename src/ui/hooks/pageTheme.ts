import { useEffect, useRef } from 'react';
import type { ThemeId } from '../../game/types';
import './pageBackdrop.css';

const BAT = '<svg viewBox="0 0 64 28"><path d="M32 10c-3-6-9-9-17-8 4 2 5 5 4 8-4-3-11-3-17 1 6 0 9 3 10 7 3-3 7-4 11-2 2-3 5-4 9-2 4-2 7-1 9 2 4-2 8-1 11 2 1-4 4-7 10-7-6-4-13-4-17-1-1-3 0-6 4-8-8-1-14 2-17 8z"/></svg>';
const GRAVES =
  '<svg viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 60V44c40-8 80-12 130-10 60 2 110-10 170-8 40 1 70 6 100 10v24z"/>' +
  '<path d="M60 40v-18a10 10 0 0 1 20 0v18zM150 36v-14a8 8 0 0 1 16 0v14zM262 34v-20a11 11 0 0 1 22 0v20zM330 40v-12h-6v-4h6v-6h4v6h6v4h-6v12z"/></svg>';

/** What lives on the page behind the menus, per table (static markup, styled in pageBackdrop.css). */
const SCENES: Record<ThemeId, string> = {
  classic: '<i class="pb-rays"></i><i class="pb-beam b1"></i><i class="pb-beam b2"></i><i class="pb-floor"></i>',
  neon: '<i class="pb-sun"></i><i class="pb-horizon"></i><i class="pb-grid"></i><i class="pb-scan"></i>',
  space:
    '<i class="pb-nebula"></i><i class="pb-stars s1"></i><i class="pb-stars s2"></i><i class="pb-stars s3"></i>' +
    '<i class="pb-planet"><b></b></i><i class="pb-shoot"></i><i class="pb-shoot two"></i>',
  halloween:
    `<i class="pb-moon"></i><i class="pb-web"></i><i class="pb-bat a">${BAT}</i><i class="pb-bat b">${BAT}</i><i class="pb-bat c">${BAT}</i>` +
    `<i class="pb-graves">${GRAVES}</i><i class="pb-fog f1"></i><i class="pb-fog f2"></i>`,
};

/**
 * Dresses the whole page (the fixed backdrop behind every menu) in a table theme while a screen is shown:
 * the colours come from `body.page-<theme>` in base.css, the living scene from SCENES above.
 * A new pick crossfades the whole page into the new look where the browser can.
 */
export function usePageTheme(theme: ThemeId) {
  const shown = useRef<ThemeId | null>(null);
  useEffect(() => {
    const body = document.body;
    const apply = () => {
      if (shown.current) body.classList.remove(`page-${shown.current}`);
      body.classList.add(`page-${theme}`);
      shown.current = theme;
      let el = document.getElementById('page-backdrop');
      if (!el) {
        el = document.createElement('div');
        el.id = 'page-backdrop';
        el.setAttribute('aria-hidden', 'true');
        body.prepend(el);
      }
      el.className = `page-backdrop pb-${theme}`;
      el.innerHTML = SCENES[theme];
    };
    const vt = (document as Document & { startViewTransition?: (f: () => void) => unknown }).startViewTransition;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (shown.current && shown.current !== theme && vt && !calm) vt.call(document, apply);
    else apply();
  }, [theme]);
  // leaving the screen takes the look off the page
  useEffect(
    () => () => {
      if (shown.current) document.body.classList.remove(`page-${shown.current}`);
      shown.current = null;
      document.getElementById('page-backdrop')?.remove();
    },
    [],
  );
}
