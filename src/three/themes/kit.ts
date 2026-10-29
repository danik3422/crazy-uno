/**
 * Shared canvas tools for painting cards (256 × 384 units; the texture is drawn at 2×).
 * Every theme draws its faces and backs with these.
 */
import { HEX, SPECIAL } from '../../game/content';
import type { Card } from '../../game/types';
import { drawIcon } from './icons';

export const W = 256;
export const H = 384;
export const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
export const BODY = '"Rubik", system-ui, sans-serif';
export const EDGE = '#fffdf6';
export const isEmoji = (s: string) => /\p{Extended_Pictographic}/u.test(s);

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
  // card symbols have hand-drawn icons (themes/icons.ts); anything else is a real emoji
  if (drawIcon(ctx, emoji, x, y, size)) return;
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

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

export function oval(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.ellipse(0, 0, 84, 150, 0, 0, Math.PI * 2);
}

/** The classic face: white frame, colour field, tilted white oval, big outlined symbol and corner indices. */
export function classicFace(ctx: CanvasRenderingContext2D, card: Card) {
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
    const label = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    let fs = 28;
    ctx.font = `800 ${fs}px ${BODY}`;
    // names differ in length between languages: shrink a long one to fit the card
    while (fs > 12 && ctx.measureText(label).width > W - 56) ctx.font = `800 ${--fs}px ${BODY}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    ctx.strokeText(label, W / 2, H - 44);
    ctx.fillStyle = EDGE;
    ctx.fillText(label, W / 2, H - 44);
  } else corner(W - 46, H - 52, Math.PI);
}

/** Lighten (amount > 0) or darken (amount < 0) a #rrggbb colour. */
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Tiny seeded random so a theme's stars and webs look the same on every card. */
export function seeded(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

export function backFrame(ctx: CanvasRenderingContext2D, edge: string, fill: CanvasGradient | string) {
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

export function backLogo(ctx: CanvasRenderingContext2D, fill: string, stroke: string, glow?: string) {
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

/** The text on a card's centre: its number, or its special symbol (which may be an emoji). */
export function symbolOf(card: Card) {
  return card.type === 'num' ? String(card.value) : SPECIAL[card.type].sym;
}
/** Action cards with a name strip at the bottom instead of a second corner index. */
export function hasLabel(card: Card) {
  return card.type !== 'num' && !['skip', 'rev', 'draw2', 'wild4', 'draw4', 'wild6', 'wild10'].includes(card.type);
}
/** The card's main colour (#rrggbb); wild cards are black. */
export function colorOf(card: Card) {
  return card.color === 'wild' ? HEX.black : HEX[card.color as keyof typeof HEX];
}
