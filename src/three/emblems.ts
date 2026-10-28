import * as THREE from 'three';
import { HEX, SPECIAL } from '../game/content';
import type { Card, Color } from '../game/types';
import { drawArrowIcon, drawEmoji } from './textures';

/**
 * The big emblems that pop up over the pile: a glossy round badge in the card's colour
 * (split into the four colours for wild cards) with a white symbol or penalty total on it.
 * Drawn once per symbol and colour, then cached.
 */

const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
const S = 512;
const C = S / 2;
/** outer radius of the badge (the white rim); the rest of the canvas is room for the shadow and sparkles */
const R = 196;
const RIM = 15;

/* ---------- colour helpers ---------- */

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mix a colour towards white (k > 0) or black (k < 0). */
function shade(hex: string, k: number, alpha = 1): string {
  const [r, g, b] = rgb(hex).map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ---------- the badge ---------- */

const WILD_ORDER: Color[] = ['red', 'blue', 'green', 'yellow'];

/** The badge without its symbol. Returns the colour to tint the symbol's shadow with. */
function drawBadge(ctx: CanvasRenderingContext2D, color: Card['color']): string {
  const inner = R - RIM;
  // soft shadow under the whole badge, then the white rim
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  const rim = ctx.createLinearGradient(0, C - R, 0, C + R);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(1, '#e4e2ea');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(C, C, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // the coloured face
  ctx.save();
  ctx.beginPath();
  ctx.arc(C, C, inner, 0, Math.PI * 2);
  ctx.clip();
  if (color === 'wild') {
    // a deep night-purple face ringed by the four colours of the game
    const night = ctx.createRadialGradient(C, C - inner * 0.3, inner * 0.1, C, C, inner);
    night.addColorStop(0, '#4a2f7a');
    night.addColorStop(1, '#1d1233');
    ctx.fillStyle = night;
    ctx.fillRect(0, 0, S, S);
    ctx.lineWidth = 30;
    WILD_ORDER.forEach((col, i) => {
      const a0 = -Math.PI * 0.75 + (i * Math.PI) / 2;
      ctx.strokeStyle = HEX[col];
      ctx.beginPath();
      ctx.arc(C, C, inner - 15, a0 + 0.05, a0 + Math.PI / 2 - 0.05);
      ctx.stroke();
    });
  } else {
    ctx.fillStyle = HEX[color];
    ctx.fillRect(0, 0, S, S);
  }
  // round, lit from the top left
  const light = ctx.createRadialGradient(C - inner * 0.35, C - inner * 0.45, inner * 0.1, C, C, inner * 1.05);
  light.addColorStop(0, 'rgba(255,255,255,.38)');
  light.addColorStop(0.55, 'rgba(255,255,255,0)');
  light.addColorStop(1, 'rgba(0,0,0,.28)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, S, S);
  // a glossy highlight across the top
  const gloss = ctx.createLinearGradient(0, C - inner, 0, C - inner * 0.1);
  gloss.addColorStop(0, 'rgba(255,255,255,.5)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(C, C - inner * 0.5, inner * 0.82, inner * 0.46, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // a thin bright ring just inside the rim
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(C, C, inner - 9, 0, Math.PI * 2);
  ctx.stroke();

  sparkle(ctx, C + R * 0.86, C - R * 0.84, 30);
  sparkle(ctx, C - R * 0.98, C + R * 0.58, 18);
  return color === 'wild' ? 'rgba(8,2,20,.75)' : shade(HEX[color], -0.55, 0.85);
}

/** A little four-pointed twinkle. */
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(255,255,255,.9)';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const d = i % 2 ? r * 0.22 : r;
    ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** White text with a soft drop shadow in the badge's own colour; shrinks to fit the face. */
function drawLabel(ctx: CanvasRenderingContext2D, text: string, shadow: string) {
  const inner = R - RIM;
  let size = text.length > 2 ? 140 : 176;
  ctx.font = `900 ${size}px ${DISPLAY}`;
  // narrower on the wild badge: its coloured ring takes the outer edge
  while (ctx.measureText(text).width > inner * 1.42 && size > 80) ctx.font = `900 ${(size -= 6)}px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // the digits sit a touch high in the font: nudge them to the optical centre
  const y = C + size * 0.06;
  ctx.fillStyle = shadow;
  ctx.fillText(text, C + 4, y + 12);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 10;
  ctx.strokeStyle = shadow;
  ctx.strokeText(text, C, y);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, C, y);
}

function paint(draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------- public ---------- */

const symbolCache = new Map<string, THREE.CanvasTexture>();

/** The emblem of an action card: its symbol on a badge in its colour. */
export function symbolTexture(card: Card): THREE.CanvasTexture {
  const key = `${card.type}-${card.color}`;
  let t = symbolCache.get(key);
  if (t) return t;
  t = paint(ctx => {
    const shadow = drawBadge(ctx, card.color);
    if (card.type === 'skip') {
      // the "no entry" ring, in white
      ctx.lineCap = 'round';
      for (const [w, c, dy] of [[34, shadow, 10], [34, '#ffffff', 0]] as const) {
        ctx.strokeStyle = c;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(C, C + dy, 92, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(C - 64, C + 64 + dy);
        ctx.lineTo(C + 64, C - 64 + dy);
        ctx.stroke();
      }
    } else if (card.type === 'rev' || card.type === 'swap') {
      ctx.save();
      ctx.translate(C, C);
      drawArrowIcon(ctx, card.type, 118, { fill: '#ffffff', rim: '#ffffff', rimWidth: 2, shadow, shadowOffset: [4, 11] });
      ctx.restore();
    } else {
      const sym = card.type === 'num' ? String(card.value) : SPECIAL[card.type].sym;
      if (/\p{Extended_Pictographic}/u.test(sym)) {
        ctx.save();
        ctx.shadowColor = shadow;
        ctx.shadowOffsetY = 10;
        ctx.shadowBlur = 6;
        drawEmoji(ctx, sym, C, C + 6, 205);
        ctx.restore();
      } else drawLabel(ctx, sym, shadow);
    }
  });
  symbolCache.set(key, t);
  return t;
}

const totalCache = new Map<string, THREE.CanvasTexture>();

/** The penalty total ("+2", "+6", "+12") on a badge: the +2's colour, or the four colours for a +4. */
export function penaltyTexture(n: number, color: Card['color']): THREE.CanvasTexture {
  const key = `${n}-${color}`;
  let t = totalCache.get(key);
  if (t) return t;
  t = paint(ctx => drawLabel(ctx, `+${n}`, drawBadge(ctx, color)));
  totalCache.set(key, t);
  return t;
}
