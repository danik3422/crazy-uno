import type { Card, ThemeId } from '../../game/types';
import { lang } from '../../i18n/core';
import { H, W } from '../themes/kit';
import { THEMES } from '../themes/index';

/*
 * Card pictures on 2D canvases: what a card looks like on each table. No three.js here, so the menus can show
 * cards without loading the 3D engine; the GPU textures of the 3D table are made from this in textures.ts.
 */

/** Draws a card face (or the back, when card is null) in the given table's style onto a 256×384 canvas. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card | null, theme: ThemeId = 'classic') {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (card) THEMES[theme].drawFace(ctx, card);
  else THEMES[theme].drawBack(ctx);
  ctx.restore();
}

/** faces print the card's name in the current language, so the language is part of the key (backs have no text) */
export const faceKey = (c: Card | null, theme: ThemeId) => `${theme}:` + (c ? `${lang()}:${c.color}-${c.type}-${c.value ?? ''}` : 'back');

const urlCache = new Map<string, string>();
const repainters = new Set<() => void>();

/** Called on every repaint of the cards (see repaintCardArt); returns a function that stops it. */
export function onCardRepaint(fn: () => void) {
  repainters.add(fn);
  return () => repainters.delete(fn);
}

/**
 * Fonts came in late, or the language changed: card pictures drawn so far are out of date. Menu images are
 * dropped (painted again when asked for); whoever keeps other copies (the 3D table's textures) repaints them.
 */
export function repaintCardArt() {
  urlCache.clear();
  for (const fn of repainters) fn();
}

/** PNG data URL of a card face, for the DOM (legend, setup screen). */
export function cardImage(card: Card | null, theme: ThemeId = 'classic', cssWidth = 64): string {
  // painted at the size it is shown (sharp on a 2× screen), not at the full 256 px: painting and encoding a
  // full-size face took tens of milliseconds each, and a menu change could ask for a dozen at once
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, devicePixelRatio) : 2;
  const w = Math.min(W, Math.max(48, Math.round((cssWidth * Math.max(dpr, 1.5)) / 16) * 16));
  const key = `${faceKey(card, theme)}@${w}`;
  let u = urlCache.get(key);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = Math.round((w * H) / W);
    const ctx = cv.getContext('2d')!;
    ctx.scale(w / W, w / W);
    drawCard(ctx, card, theme);
    // the 3D card is cut to its rounded outline by its shape; a flat picture has to cut its own corners
    // (some tables paint the face edge to edge)
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 30);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    u = cv.toDataURL('image/png');
    urlCache.set(key, u);
  }
  return u;
}

/**
 * Paints menu card images ahead of time, one per idle moment, so they are ready before anyone asks
 * (e.g. the card reference for another mode). Returns a cancel function.
 */
export function warmCardImages(jobs: { card: Card | null; theme: ThemeId; cssWidth?: number }[]) {
  let i = 0;
  let handle = 0;
  const idle: (f: () => void) => number =
    typeof requestIdleCallback === 'function' ? f => requestIdleCallback(f, { timeout: 1500 }) : f => window.setTimeout(f, 50);
  const cancel = typeof cancelIdleCallback === 'function' ? cancelIdleCallback : window.clearTimeout;
  const step = () => {
    const j = jobs[i++];
    if (!j) return;
    cardImage(j.card, j.theme, j.cssWidth);
    handle = idle(step);
  };
  handle = idle(step);
  return () => cancel(handle);
}
