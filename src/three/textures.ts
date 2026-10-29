import * as THREE from 'three';
import { HEX, SPECIAL } from '../game/content';
import type { Card, ThemeId } from '../game/types';

const W = 256;
const H = 384;
const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
const BODY = '"Rubik", system-ui, sans-serif';
const EDGE = '#fffdf6';
/** card faces at 2× (512 × 768): sharp on a phone held close, even tilted */
const TEX_SCALE = 2;
const isEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';
/** emoji are drawn once this big; Safari leaves very large colour emoji blank, so a smaller size is the fallback */
const EMOJI_SIZES = [128, 64];
const emojiCache = new Map<string, HTMLCanvasElement>();

function emojiTile(emoji: string, base: number) {
  const tile = document.createElement('canvas');
  tile.width = tile.height = base * 1.25;
  const t = tile.getContext('2d', { willReadFrequently: true })!;
  t.textAlign = 'center';
  t.textBaseline = 'middle';
  t.font = `${base}px ${EMOJI_FONT}`;
  t.fillText(emoji, tile.width / 2, tile.height / 2 + base * 0.06);
  // did anything get drawn? (a sparse sample is enough)
  const px = t.getImageData(0, 0, tile.width, tile.height).data;
  for (let i = 3; i < px.length; i += 4 * 37) if (px[i] > 0) return tile;
  return null;
}

/**
 * Draws an emoji centred at (x, y), `size` px tall.
 * Safari leaves large colour emoji blank on a canvas, so each one is drawn once at a small size it does
 * render and then scaled up.
 */
export function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  let tile = emojiCache.get(emoji);
  if (!tile) {
    for (const base of EMOJI_SIZES) {
      tile = emojiTile(emoji, base) ?? undefined;
      if (tile) break;
    }
    // nothing rendered at any size (no emoji font): keep an empty tile rather than retrying every time
    tile ??= Object.assign(document.createElement('canvas'), { width: 80, height: 80 });
    emojiCache.set(emoji, tile);
  }
  const s = size * 1.25;
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

/**
 * Arrow icons drawn as shapes, not font glyphs: the display font has no ⇄/⇆, so the browser used to borrow
 * thin, uneven arrows from some system font. Each icon is thick shafts (stroked) plus solid arrowheads.
 */
export type ArrowIcon = 'rev' | 'swap';
export const ARROW_ICONS: readonly string[] = ['rev', 'swap'];

/** Each arrow as one closed outline (shaft and head together), so the rim runs round it without seams. */
function arrowOutlines(kind: ArrowIcon, r: number): Path2D[] {
  const out: Path2D[] = [];
  if (kind === 'rev') {
    // two arrows chasing each other round a circle: the classic reverse
    const R = r * 0.6;
    const w = r * 0.14; // half the shaft width
    const half = r * 0.34; // half the head width
    const headA = (r * 0.5) / R; // head length, as an angle
    for (const k of [0, 1]) {
      const a0 = k * Math.PI + 0.3;
      const tipA = k * Math.PI + Math.PI - 0.3;
      const baseA = tipA - headA;
      const p = new Path2D();
      p.arc(0, 0, R + w, a0, baseA);
      p.lineTo(Math.cos(baseA) * (R + half), Math.sin(baseA) * (R + half));
      // the tip sits on the circle, a little ahead of the base
      p.lineTo(Math.cos(tipA) * R, Math.sin(tipA) * R);
      p.lineTo(Math.cos(baseA) * (R - half), Math.sin(baseA) * (R - half));
      p.arc(0, 0, R - w, baseA, a0, true);
      p.closePath();
      out.push(p);
    }
  } else {
    // two straight arrows passing each other: hands swapped
    const y = r * 0.33;
    const w = r * 0.13;
    const half = r * 0.32;
    const tail = r * 0.8;
    const tip = r * 0.88;
    const base = r * 0.36;
    for (const s of [1, -1]) {
      const cy = -y * s;
      const p = new Path2D();
      p.moveTo(-tail * s, cy - w);
      p.lineTo(base * s, cy - w);
      p.lineTo(base * s, cy - half);
      p.lineTo(tip * s, cy);
      p.lineTo(base * s, cy + half);
      p.lineTo(base * s, cy + w);
      p.lineTo(-tail * s, cy + w);
      p.closePath();
      out.push(p);
    }
  }
  return out;
}

/**
 * Draws an arrow icon centred at the origin, `r` its half-size, in layers like the card numbers:
 * an optional dark offset shadow, a dark rim, the colour on top.
 */
export function drawArrowIcon(
  ctx: CanvasRenderingContext2D,
  kind: ArrowIcon,
  r: number,
  o: { fill: string | CanvasGradient; rim: string; rimWidth: number; shadow?: string; shadowOffset?: [number, number] },
) {
  const paths = arrowOutlines(kind, r);
  ctx.save();
  ctx.lineJoin = 'round';
  const solid = (color: string | CanvasGradient, rim: number) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = rim * 2;
    for (const p of paths) {
      if (rim > 0) ctx.stroke(p);
      ctx.fill(p);
    }
  };
  if (o.shadow) {
    ctx.save();
    ctx.translate(...(o.shadowOffset ?? [5, 7]));
    solid(o.shadow, o.rimWidth);
    ctx.restore();
  }
  solid(o.rim, o.rimWidth);
  solid(o.fill, 0);
  ctx.restore();
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

  // the white frame, edge to edge: the 3D card cuts its own smooth outline, so no drawn rim is needed
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = EDGE;
  ctx.fill();

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
  const tag = card.type !== 'num' && !['skip', 'rev', 'draw2', 'wild4', 'draw4', 'wild6', 'wild10'].includes(card.type);
  const ink = shade(wild ? HEX.black : col, -0.45);

  // big centre symbol: a dark extruded shadow, a crisp outline, the colour on top
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  if (ARROW_ICONS.includes(card.type)) {
    ctx.rotate(-0.12);
    drawArrowIcon(ctx, card.type as ArrowIcon, 66, {
      fill: wild ? EDGE : col,
      rim: wild ? HEX.black : ink,
      rimWidth: wild ? 7 : 5,
      shadow: ink,
    });
  } else if (emoji) {
    ctx.shadowColor = 'rgba(0,0,0,.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    drawEmoji(ctx, sym, 0, 0, 106);
  } else {
    ctx.font = `900 ${sym.length > 2 ? 70 : sym.length > 1 ? 92 : 128}px ${DISPLAY}`;
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
    if (ARROW_ICONS.includes(card.type)) drawArrowIcon(ctx, card.type as ArrowIcon, 19, { fill: EDGE, rim: ink, rimWidth: 3.5 });
    else if (emoji) drawEmoji(ctx, sym, 0, 0, 34);
    else {
      ctx.font = `900 ${sym.length > 2 ? 24 : sym.length > 1 ? 30 : 40}px ${DISPLAY}`;
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
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = edge;
  ctx.fill();
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
/** bumped every time the cards are repainted: copies of a card texture (the deck's back) re-upload then */
export const repaint = { version: 0 };

export function repaintCards() {
  for (const [key, t] of texCache) {
    const src = texSource.get(key);
    const cv = t.image as HTMLCanvasElement;
    if (!src || !cv?.getContext) continue;
    const ctx = cv.getContext('2d')!;
    ctx.setTransform(TEX_SCALE, 0, 0, TEX_SCALE, 0, 0);
    drawCard(ctx, src.card, src.theme);
    fillCorners(ctx);
    t.needsUpdate = true;
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

