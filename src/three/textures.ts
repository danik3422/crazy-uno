import * as THREE from 'three';
import type { Card, ThemeId } from '../game/types';
import { lang } from '../i18n/core';
import { H, W } from './themes/kit';
import { THEMES } from './themes';

export { drawArrowIcon, drawEmoji, type ArrowIcon } from './themes/kit';

/** card faces at 2× (512 × 768): sharp on a phone held close, even tilted */
const TEX_SCALE = 2;

/** Draws a card face (or the back, when card is null) in the given table's style onto a 256×384 canvas. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card | null, theme: ThemeId = 'classic') {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  if (card) THEMES[theme].drawFace(ctx, card);
  else THEMES[theme].drawBack(ctx);
  ctx.restore();
}

/** faces print the card's name in the current language, so the language is part of the key (backs have no text) */
const faceKey = (c: Card | null, theme: ThemeId) => `${theme}:` + (c ? `${lang()}:${c.color}-${c.type}-${c.value ?? ''}` : 'back');
const texCache = new Map<string, THREE.CanvasTexture>();
/** what each cached texture shows, so it can be repainted once the real fonts arrive */
const texSource = new Map<string, { card: Card | null; theme: ThemeId }>();

/**
 * Fonts came in late, or the language changed: repaint every card already drawn, in place (the 3D cards keep
 * their textures), file them under the current key, and drop cached images.
 */
/** bumped every time the cards are repainted: copies of a card texture (the deck's back) re-upload then */
export const repaint = { version: 0 };

export function repaintCards() {
  const entries = [...texCache];
  texCache.clear();
  const sources = new Map(texSource);
  texSource.clear();
  for (const [key, t] of entries) {
    const src = sources.get(key);
    const cv = t.image as HTMLCanvasElement;
    if (!src || !cv?.getContext) continue;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    drawCard(ctx, src.card, src.theme);
    fillCorners(ctx);
    t.needsUpdate = true;
    const now = faceKey(src.card, src.theme);
    // two languages' copies of one card: keep one, the other is left to whoever still holds it
    if (!texCache.has(now)) {
      texCache.set(now, t);
      texSource.set(now, src);
    }
  }
  urlCache.clear();
  repaint.version++;
}

/**
 * The see-through corners of a GPU texture get the frame's own colour underneath: the 3D card is cut to
 * its outline anyway, and this way the blurred, smaller copies the GPU uses far away never mix in black.
 */
function fillCorners(ctx: CanvasRenderingContext2D) {
  const [r, g, b] = ctx.getImageData(ctx.canvas.width / 2, 2, 1, 1).data;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = `rgb(${r},${g},${b})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

export function cardTexture(card: Card | null, theme: ThemeId = 'classic'): THREE.CanvasTexture {
  const key = faceKey(card, theme);
  let t = texCache.get(key);
  if (!t) {
    // 1.5× resolution for the 3D table: cards stay sharp up close, memory stays reasonable on phones
    const cv = document.createElement('canvas');
    cv.width = W * TEX_SCALE;
    cv.height = H * TEX_SCALE;
    const ctx = cv.getContext('2d')!;
    ctx.scale(TEX_SCALE, TEX_SCALE);
    drawCard(ctx, card, theme);
    fillCorners(ctx);
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 16; // clamped to what the GPU supports
    texCache.set(key, t);
    texSource.set(key, { card, theme });
  }
  return t;
}

const urlCache = new Map<string, string>();
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

