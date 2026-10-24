import * as THREE from 'three';
import { HEX, SPECIAL } from '../game/content';
import type { Card, ThemeId } from '../game/types';

const W = 256;
const H = 384;
const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
const BODY = '"Rubik", system-ui, sans-serif';
const EDGE = '#fffdf6';
const TEX_SCALE = 1.5;
const isEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
const EMOJI_BASE = 64;
const emojiCache = new Map<string, HTMLCanvasElement>();

/**
 * Draws an emoji centred at (x, y), `size` px tall.
 * Safari leaves large colour emoji blank on a canvas, so each one is drawn once at a small size it does
 * render and then scaled up.
 */
export function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  let tile = emojiCache.get(emoji);
  if (!tile) {
    tile = document.createElement('canvas');
    tile.width = tile.height = EMOJI_BASE * 1.25;
    const t = tile.getContext('2d')!;
    t.textAlign = 'center';
    t.textBaseline = 'middle';
    t.font = `${EMOJI_BASE}px ${EMOJI_FONT}`;
    t.fillText(emoji, tile.width / 2, tile.height / 2 + EMOJI_BASE * 0.06);
    emojiCache.set(emoji, tile);
  }
  const s = (size * 1.25 * tile.width) / (EMOJI_BASE * 1.25);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tile, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function oval(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.ellipse(0, 0, 84, 150, 0, 0, Math.PI * 2);
}

/** Draws a card face (or the back, in the given theme, when card is null) onto a 256×384 canvas. */
export function drawCard(ctx: CanvasRenderingContext2D, card: Card | null, theme: ThemeId = 'classic') {
  ctx.clearRect(0, 0, W, H);
  if (!card) return drawBack(ctx, theme);
  const wild = card.color === 'wild';
  const col = wild ? HEX.black : HEX[card.color as keyof typeof HEX];

  // white frame with a hairline outline, so the silhouette stays crisp on any background
  rr(ctx, 1, 1, W - 2, H - 2, 30);
  ctx.fillStyle = EDGE;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(40,30,20,.25)';
  ctx.stroke();

  // the colour face: lit from the top-left, a little darker toward the bottom-right
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, W, H);
  const light = ctx.createRadialGradient(W * 0.2, H * 0.12, 10, W * 0.35, H * 0.35, H * 0.85);
  light.addColorStop(0, 'rgba(255,255,255,.28)');
  light.addColorStop(0.45, 'rgba(255,255,255,.04)');
  light.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  // a soft inner shadow along the frame gives the face some depth
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,.16)';
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.stroke();
  ctx.restore();

  // the tilted oval
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  ctx.shadowColor = 'rgba(0,0,0,.28)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  oval(ctx);
  if (wild) {
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.save();
    ctx.clip();
    const quads: (keyof typeof HEX)[] = ['red', 'yellow', 'green', 'blue'];
    quads.forEach((q, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 200, -Math.PI / 2 + (i * Math.PI) / 2, (i * Math.PI) / 2);
      ctx.closePath();
      ctx.fillStyle = HEX[q];
      ctx.fill();
    });
    const gloss = ctx.createLinearGradient(-60, -150, 60, 150);
    gloss.addColorStop(0, 'rgba(255,255,255,.3)');
    gloss.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(-120, -160, 240, 320);
    ctx.restore();
  } else {
    const og = ctx.createLinearGradient(-60, -150, 60, 150);
    og.addColorStop(0, '#ffffff');
    og.addColorStop(1, '#ece6d8');
    ctx.fillStyle = og;
    ctx.fill();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const sym = card.type === 'num' ? String(card.value) : SPECIAL[card.type].sym;
  const emoji = isEmoji(sym);
  const tag = card.type !== 'num' && !['skip', 'rev', 'draw2', 'wild4'].includes(card.type);
  const ink = shade(wild ? HEX.black : col, -0.45);

  // big centre symbol: a dark extruded shadow, a crisp outline, the colour on top
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  if (emoji) {
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    drawEmoji(ctx, sym, 0, 0, 106);
  } else {
    ctx.font = `900 ${sym.length > 1 ? 92 : 128}px ${DISPLAY}`;
    ctx.fillStyle = ink;
    ctx.fillText(sym, 5, 7);
    ctx.lineWidth = wild ? 14 : 9;
    ctx.strokeStyle = wild ? HEX.black : ink;
    ctx.strokeText(sym, 0, 0);
    ctx.fillStyle = wild ? EDGE : col;
    ctx.fillText(sym, 0, 0);
  }
  ctx.restore();

  // corner indices: white with a dark rim, readable when cards overlap in a fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (emoji) drawEmoji(ctx, sym, 0, 0, 34);
    else {
      ctx.font = `900 ${sym.length > 1 ? 30 : 40}px ${DISPLAY}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = ink;
      ctx.strokeText(sym, 0, 0);
      ctx.fillStyle = EDGE;
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
  };
  corner(46, 52, 0);
  if (tag) {
    ctx.font = `800 28px ${BODY}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    const label = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    ctx.strokeText(label, W / 2, H - 44);
    ctx.fillStyle = EDGE;
    ctx.fillText(label, W / 2, H - 44);
  } else corner(W - 46, H - 52, Math.PI);
}

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/* ---------- card backs, one per theme ---------- */

/** Tiny seeded random so a theme's stars and webs look the same on every card. */
function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

function backFrame(ctx: CanvasRenderingContext2D, edge: string, fill: CanvasGradient | string) {
  rr(ctx, 1, 1, W - 2, H - 2, 30);
  ctx.fillStyle = edge;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(40,30,20,.25)';
  ctx.stroke();
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, W, H);
  // the same top-left light as the faces, so a fan of backs looks like one set
  const light = ctx.createRadialGradient(W * 0.2, H * 0.12, 10, W * 0.35, H * 0.35, H * 0.85);
  light.addColorStop(0, 'rgba(255,255,255,.18)');
  light.addColorStop(1, 'rgba(0,0,0,.2)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,.2)';
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.stroke();
  ctx.restore();
}

function backLogo(ctx: CanvasRenderingContext2D, fill: string, stroke: string, glow?: string) {
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 64px ${DISPLAY}`;
  ctx.lineJoin = 'round';
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
  }
  ctx.lineWidth = 10;
  ctx.strokeStyle = stroke;
  ctx.strokeText('UNO', 0, 4);
  ctx.fillStyle = fill;
  ctx.fillText('UNO', 0, 4);
  if (glow) ctx.fillText('UNO', 0, 4);
  ctx.restore();
}

function drawBack(ctx: CanvasRenderingContext2D, theme: ThemeId) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (theme === 'neon') {
    backFrame(ctx, '#1a1033', '#0b0618');
    // light tubes: a pink outer frame and a cyan oval, both glowing
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff2e88';
    ctx.strokeStyle = '#ff5fa8';
    ctx.lineWidth = 5;
    rr(ctx, 26, 26, W - 52, H - 52, 16);
    ctx.stroke();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(0.42);
    ctx.shadowColor = '#2ee6ff';
    ctx.strokeStyle = '#7ff3ff';
    ctx.lineWidth = 7;
    oval(ctx);
    ctx.stroke();
    ctx.restore();
    backLogo(ctx, '#ffffff', '#ff2e88', '#ff2e88');
    return;
  }
  if (theme === 'space') {
    const bg = ctx.createRadialGradient(W * 0.35, H * 0.3, 10, W / 2, H / 2, H * 0.7);
    bg.addColorStop(0, '#3a2a8a');
    bg.addColorStop(0.55, '#140c3c');
    bg.addColorStop(1, '#05030f');
    backFrame(ctx, '#e8e6ff', bg);
    const rnd = seeded(7);
    ctx.save();
    rr(ctx, 13, 13, W - 26, H - 26, 20);
    ctx.clip();
    for (let i = 0; i < 70; i++) {
      ctx.globalAlpha = 0.4 + rnd() * 0.6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(13 + rnd() * (W - 26), 13 + rnd() * (H - 26), rnd() * 1.8 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // a ringed planet where the oval usually is
    ctx.translate(W / 2, H / 2);
    const pl = ctx.createRadialGradient(-28, -34, 8, 0, 0, 92);
    pl.addColorStop(0, '#ffd2a0');
    pl.addColorStop(0.5, '#e8603a');
    pl.addColorStop(1, '#5a1a4a');
    ctx.fillStyle = pl;
    ctx.beginPath();
    ctx.arc(0, 0, 86, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(-0.42);
    ctx.strokeStyle = 'rgba(255,240,220,.85)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, 122, 30, 0, Math.PI * 1.02, Math.PI * 1.98, true);
    ctx.stroke();
    ctx.restore();
    backLogo(ctx, '#ffffff', '#140c3c', '#9fb4ff');
    return;
  }
  if (theme === 'halloween') {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2b0f3a');
    bg.addColorStop(1, '#120616');
    backFrame(ctx, '#f3e9d2', bg);
    ctx.save();
    rr(ctx, 13, 13, W - 26, H - 26, 20);
    ctx.clip();
    // spider web in the top-left corner
    ctx.strokeStyle = 'rgba(243,233,210,.45)';
    ctx.lineWidth = 1.6;
    for (let a = 0; a <= 6; a++) {
      const ang = (a / 6) * (Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(13, 13);
      ctx.lineTo(13 + Math.cos(ang) * 150, 13 + Math.sin(ang) * 150);
      ctx.stroke();
    }
    for (let r = 30; r <= 140; r += 28) {
      ctx.beginPath();
      for (let a = 0; a <= 6; a++) {
        const ang = (a / 6) * (Math.PI / 2);
        const x = 13 + Math.cos(ang) * r;
        const y = 13 + Math.sin(ang) * r;
        if (a === 0) ctx.moveTo(x, y);
        else ctx.quadraticCurveTo(13 + Math.cos(ang - 0.13) * r * 0.86, 13 + Math.sin(ang - 0.13) * r * 0.86, x, y);
      }
      ctx.stroke();
    }
    // a pumpkin instead of the oval
    ctx.translate(W / 2, H / 2 + 8);
    for (const [dx, sx] of [[-46, 0.62], [46, 0.62], [-22, 0.8], [22, 0.8], [0, 0.92]] as const) {
      const g = ctx.createRadialGradient(dx - 10, -20, 6, dx, 0, 80);
      g.addColorStop(0, '#ffb04a');
      g.addColorStop(1, '#d8520a');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(dx, 0, 58 * sx, 70, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,40,0,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#3a6b1a';
    rr(ctx, -8, -86, 16, 22, 4);
    ctx.fill();
    ctx.restore();
    backLogo(ctx, '#9dff3a', '#1a0b24', '#5aff1a');
    // a little bat, top right
    ctx.save();
    ctx.translate(W - 58, 50);
    ctx.fillStyle = '#0d0410';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-14, -14, -30, -4);
    ctx.quadraticCurveTo(-22, 0, -20, 8);
    ctx.quadraticCurveTo(-10, 2, 0, 8);
    ctx.quadraticCurveTo(10, 2, 20, 8);
    ctx.quadraticCurveTo(22, 0, 30, -4);
    ctx.quadraticCurveTo(14, -14, 0, 0);
    ctx.fill();
    ctx.restore();
    return;
  }
  // classic: black with a glossy red tilted oval
  backFrame(ctx, EDGE, '#16161a');
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  ctx.shadowColor = 'rgba(0,0,0,.5)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  oval(ctx);
  const red = ctx.createLinearGradient(-80, -150, 80, 150);
  red.addColorStop(0, '#ff5a4a');
  red.addColorStop(1, '#c4231a');
  ctx.fillStyle = red;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.clip();
  const gloss = ctx.createLinearGradient(-60, -150, 40, 40);
  gloss.addColorStop(0, 'rgba(255,255,255,.35)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(-12, -40, 64, 105, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  backLogo(ctx, HEX.yellow, HEX.black);
}

const faceKey = (c: Card | null, theme: ThemeId) => (c ? `${c.color}-${c.type}-${c.value ?? ''}` : `back-${theme}`);
const texCache = new Map<string, THREE.CanvasTexture>();
/** what each cached texture shows, so it can be repainted once the real fonts arrive */
const texSource = new Map<string, { card: Card | null; theme: ThemeId }>();

/** Fonts came in late: repaint every card already drawn with a fallback font (and drop cached images). */
export function repaintCards() {
  for (const [key, t] of texCache) {
    const src = texSource.get(key);
    const cv = t.image as HTMLCanvasElement;
    if (!src || !cv?.getContext) continue;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    drawCard(ctx, src.card, src.theme);
    t.needsUpdate = true;
  }
  urlCache.clear();
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
    t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    texCache.set(key, t);
    texSource.set(key, { card, theme });
  }
  return t;
}

const urlCache = new Map<string, string>();
/** PNG data URL of a card face, for the DOM (legend, setup screen). */
export function cardImage(card: Card | null, theme: ThemeId = 'classic'): string {
  const key = faceKey(card, theme);
  let u = urlCache.get(key);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    drawCard(cv.getContext('2d')!, card, theme);
    u = cv.toDataURL('image/png');
    urlCache.set(key, u);
  }
  return u;
}

