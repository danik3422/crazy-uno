import type { Insets } from './types';

/*
 * The screen's safe area (a phone's notch, its rounded corners, the home bar), in CSS pixels. CSS knows it as
 * env(safe-area-inset-*); the layout needs numbers, so a hidden probe element is padded with it and measured.
 */

let probe: HTMLDivElement | null = null;

/** The current safe-area insets, rounded to whole pixels (all zero outside a browser or on a plain screen). */
export function readSafeArea(): Insets {
  if (typeof document === 'undefined' || !document.body) return { t: 0, r: 0, b: 0, l: 0 };
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.appendChild(probe);
  }
  const cs = getComputedStyle(probe);
  const px = (s: string) => Math.round(parseFloat(s) || 0);
  return { t: px(cs.paddingTop), r: px(cs.paddingRight), b: px(cs.paddingBottom), l: px(cs.paddingLeft) };
}
