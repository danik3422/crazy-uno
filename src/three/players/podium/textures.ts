import * as THREE from 'three';
import { drawAvatar } from '../../../art/avatarArt';
import { drawUiIcon } from '../../../art/uiIcons';
import type { Avatar } from '../../../game/avatars';
import { lang, t as tr } from '../../../i18n/index';

/*
 * The podium's painted pictures, each drawn once and cached: an avatar's portrait, the place number,
 * the name plate, the spotlight cone and the winner's sun rays.
 */

const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, onLater?: (redraw: () => void) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  onLater?.(() => { tex.needsUpdate = true; });
  return tex;
}

const avatarCache = new Map<string, THREE.CanvasTexture>();

/** An avatar's drawn portrait painted onto a canvas. */
export function avatarTexture(a: Avatar): THREE.CanvasTexture {
  const hit = avatarCache.get(a.id);
  if (hit) return hit;
  const S = 256;
  const tex = canvasTexture(S, S, ctx => drawAvatar(ctx, a, S));
  avatarCache.set(a.id, tex);
  return tex;
}

const numberCache = new Map<number, THREE.CanvasTexture>();

/** The big place number on the front of a step. */
export function numberTexture(n: number) {
  let t = numberCache.get(n);
  if (!t) {
    t = canvasTexture(256, 256, ctx => {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `900 190px ${DISPLAY}`;
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.strokeText(String(n), 128, 140);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(String(n), 128, 136);
    });
    numberCache.set(n, t);
  }
  return t;
}

export const LABEL_W = 512;
export const LABEL_H = 176;
const PILL: Record<number, [string, string, string]> = {
  1: ['#fff09a', '#ffc61a', '#3a1d00'],
  2: ['#ffffff', '#c3c8d2', '#222222'],
  3: ['#ffcf9a', '#cd7f32', '#2a1200'],
};
/** A fully rounded rectangle (ctx.roundRect is missing on older iPhones). */
function pillPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (Math.PI * 3) / 2);
  ctx.closePath();
}

const labelCache = new Map<string, THREE.CanvasTexture>();

/** "(trophy) Winner" / "2nd place" in a pill (in the current language), the name underneath. */
export function labelTexture(place: number, name: string) {
  const key = `${lang()}|${place}|${name}`;
  let t = labelCache.get(key);
  if (t) return t;
  t = canvasTexture(LABEL_W, LABEL_H, ctx => {
    const text = place === 1 ? tr('podium.winner') : tr('podium.place', { n: place });
    const [top, bottom, ink] = PILL[place];
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pad = place === 1 ? 96 : 56;
    let fs = 34;
    ctx.font = `900 ${fs}px ${DISPLAY}`;
    // a longer word in some languages: shrink it to fit the pill
    while (fs > 18 && ctx.measureText(text).width + pad > LABEL_W - 20) ctx.font = `900 ${--fs}px ${DISPLAY}`;
    const pw = Math.min(LABEL_W - 20, ctx.measureText(text).width + pad);
    const px = (LABEL_W - pw) / 2;
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    const g = ctx.createLinearGradient(0, 10, 0, 74);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    pillPath(ctx, px, 10, pw, 64);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = ink;
    if (place === 1) {
      ctx.save();
      ctx.translate(px + 40 - 21, 43 - 21);
      drawUiIcon(ctx, 'trophy', 42);
      ctx.restore();
      ctx.fillText(text, LABEL_W / 2 + 18, 44);
    } else ctx.fillText(text, LABEL_W / 2, 44);
    // the name, shrunk to fit
    let size = 46;
    ctx.font = `700 ${size}px ${DISPLAY}`;
    while (ctx.measureText(name).width > LABEL_W - 24 && size > 24) ctx.font = `700 ${(size -= 2)}px ${DISPLAY}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(0,0,0,.65)';
    ctx.strokeText(name, LABEL_W / 2, 128);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, LABEL_W / 2, 128);
  });
  labelCache.set(key, t);
  return t;
}

let beamTex: THREE.CanvasTexture | null = null;
/** Vertical fade for the light cone: bright at the lamp, gone at the floor. */
export function beamTexture() {
  beamTex ??= canvasTexture(4, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.55, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,.9)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 128);
  });
  return beamTex;
}

let raysTex: THREE.CanvasTexture | null = null;
/** Sun rays fanning out behind the winner. */
export function raysTexture() {
  raysTex ??= canvasTexture(256, 256, ctx => {
    ctx.translate(128, 128);
    const n = 14;
    for (let i = 0; i < n; i++) {
      ctx.rotate((Math.PI * 2) / n);
      const g = ctx.createLinearGradient(0, 0, 0, -128);
      g.addColorStop(0, 'rgba(255,240,170,.9)');
      g.addColorStop(1, 'rgba(255,240,170,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-14, -128);
      ctx.lineTo(14, -128);
      ctx.closePath();
      ctx.fill();
    }
  });
  return raysTex;
}
