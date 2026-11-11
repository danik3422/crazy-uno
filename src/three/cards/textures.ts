import * as THREE from 'three';
import type { Card, ThemeId } from '../../game/types';
import { H, W } from '../themes/kit';
import { drawCard, faceKey, onCardRepaint } from './cardArt';

/** card faces at 2× (512 × 768): sharp on a phone held close, even tilted */
const TEX_SCALE = 2;
/**
 * At most this many card textures are kept (each is a 1.5 MB canvas plus its copy on the GPU). One table needs at most
 * 95 (every special card on, plus the back), so what goes is left over from other tables or languages; phones
 * (iOS above all) stop drawing canvases once too much memory goes to them. The least recently made go first.
 */
const TEX_LIMIT = 120;

const texCache = new Map<string, THREE.CanvasTexture>();
/** what each cached texture shows, so it can be repainted once the real fonts arrive */
const texSource = new Map<string, { card: Card | null; theme: ThemeId }>();

/** bumped every time the cards are repainted: copies of a card texture (the deck's back) re-upload then */
export const repaint = { version: 0 };

/**
 * Fonts came in late, or the language changed: repaint every card already drawn, in place (the 3D cards keep
 * their textures) and file them under the current key.
 */
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
  repaint.version++;
}
onCardRepaint(repaintCards);

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

/** Drops the least recently used textures until there is room for one more. */
function makeRoom() {
  while (texCache.size >= TEX_LIMIT) {
    const [key, t] = texCache.entries().next().value!;
    texCache.delete(key);
    texSource.delete(key);
    // frees the GPU copy; a card still showing it simply uploads it again (its canvas stays with that card)
    t.dispose();
  }
}

export function cardTexture(card: Card | null, theme: ThemeId = 'classic'): THREE.CanvasTexture {
  const key = faceKey(card, theme);
  let t = texCache.get(key);
  if (t) {
    // used again: it moves to the back of the queue
    texCache.delete(key);
    texCache.set(key, t);
    return t;
  }
  makeRoom();
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
  return t;
}
