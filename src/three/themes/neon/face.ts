import { SPECIAL } from '../../../game/content';
import type { Card } from '../../../game/types';
import { ARROW_ICONS, BODY, DISPLAY, H, W, drawArrowIcon, drawEmoji, hasLabel, isEmoji, rr, shade, symbolOf, type ArrowIcon } from '../kit';

/** Neon-shifted card colours: brighter than the classic ones, still four clearly different hues. */
export const NEON: Record<'red' | 'yellow' | 'green' | 'blue', string> = {
  red: '#ff2b56',
  yellow: '#ffd91a',
  green: '#22ff7a',
  blue: '#1f9bff',
};
const WILD_ORDER = ['red', 'yellow', 'green', 'blue'] as const;

/** a #rrggbb colour with an alpha */
export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/** The dark glass body every neon card shares: tinted toward its colour, with scanlines and a glass sheen. */
function glassBody(ctx: CanvasRenderingContext2D, tint: string | null) {
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = '#07040f';
  ctx.fill();
  ctx.save();
  rr(ctx, 0, 0, W, H, 30);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  if (tint) {
    g.addColorStop(0, shade(tint, -0.55));
    g.addColorStop(0.55, shade(tint, -0.78));
    g.addColorStop(1, shade(tint, -0.88));
  } else {
    g.addColorStop(0, '#1d0b33');
    g.addColorStop(0.6, '#0c0619');
    g.addColorStop(1, '#05030b');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // scanlines
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.6);
  // a diagonal glass sheen
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(W * 0.62, 0);
  ctx.lineTo(0, H * 0.5);
  ctx.closePath();
  const s = ctx.createLinearGradient(0, 0, W * 0.3, H * 0.25);
  s.addColorStop(0, 'rgba(255,255,255,.13)');
  s.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = s;
  ctx.fill();
  ctx.restore();
}

/** A glowing tube along the current path: a wide soft halo, the coloured tube, a hot white-ish core. */
function tube(ctx: CanvasRenderingContext2D, color: string | CanvasGradient, glow: string, width: number, core = true) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.shadowColor = glow;
  ctx.shadowBlur = 18;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.shadowBlur = 8;
  ctx.stroke();
  if (core) {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = Math.max(1.2, width * 0.3);
    ctx.stroke();
  }
  ctx.restore();
}

/** The neon face: dark tinted glass, a tube frame and tilted tube oval in the card's colour, a glowing symbol. */
export function neonFace(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  const col = wild ? '#ff3df0' : NEON[card.color as keyof typeof NEON];
  const light = wild ? '#ffffff' : shade(col, 0.72);
  glassBody(ctx, wild ? null : col);

  // the frame tube
  let frame: string | CanvasGradient = col;
  if (wild) {
    const fg = ctx.createLinearGradient(0, 0, W, H);
    WILD_ORDER.forEach((c, i) => fg.addColorStop(i / 3, NEON[c]));
    frame = fg;
  }
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  tube(ctx, frame, wild ? '#c040ff' : col, 4.5);

  // the tilted oval: a soft colour fill inside, a tube round it (four tubes on a wild card)
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  const RX = 82;
  const RY = 146;
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  if (wild) {
    ctx.save();
    ctx.clip();
    WILD_ORDER.forEach((c, i) => {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 200, -Math.PI / 2 + (i * Math.PI) / 2, (i * Math.PI) / 2);
      ctx.closePath();
      ctx.fillStyle = rgba(NEON[c], 0.3);
      ctx.fill();
    });
    ctx.restore();
    WILD_ORDER.forEach((c, i) => {
      ctx.beginPath();
      ctx.ellipse(0, 0, RX, RY, 0, -Math.PI / 2 + (i * Math.PI) / 2 + 0.09, (i * Math.PI) / 2 - 0.09);
      tube(ctx, NEON[c], NEON[c], 6);
    });
  } else {
    const fill = ctx.createRadialGradient(0, 0, 10, 0, 0, RY);
    fill.addColorStop(0, rgba(col, 0.42));
    fill.addColorStop(0.7, rgba(col, 0.16));
    fill.addColorStop(1, rgba(col, 0.32));
    ctx.fillStyle = fill;
    ctx.fill();
    tube(ctx, col, col, 6);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const sym = symbolOf(card);
  const emoji = isEmoji(sym);
  const arrow = ARROW_ICONS.includes(card.type);
  const glow = wild ? '#ff3df0' : col;

  // the big glowing symbol
  ctx.save();
  ctx.translate(W / 2, H / 2 + 4);
  if (arrow) {
    ctx.rotate(-0.12);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;
    drawArrowIcon(ctx, card.type as ArrowIcon, 66, { fill: light, rim: col, rimWidth: 6 });
    ctx.shadowBlur = 0;
    drawArrowIcon(ctx, card.type as ArrowIcon, 66, { fill: light, rim: wild ? '#ff3df0' : col, rimWidth: 3 });
  } else if (emoji) {
    const halo = ctx.createRadialGradient(0, 0, 4, 0, 0, 82);
    halo.addColorStop(0, rgba(wild ? '#ffffff' : col, 0.75));
    halo.addColorStop(0.5, rgba(glow, 0.3));
    halo.addColorStop(1, rgba(glow, 0));
    ctx.fillStyle = halo;
    ctx.fillRect(-90, -90, 180, 180);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    drawEmoji(ctx, sym, 0, 0, 100);
  } else if (card.type === 'skipAll') {
    // skip everyone: two glowing signs on the diagonal and a tube ring round them, never just a plain skip
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    tube(ctx, col, col, 4);
    ctx.font = `900 92px ${DISPLAY}`;
    for (const [dx, dy] of [[-22, -26], [22, 26]]) {
      ctx.shadowColor = col;
      ctx.shadowBlur = 22;
      ctx.lineWidth = 10;
      ctx.strokeStyle = col;
      ctx.strokeText(sym, dx, dy);
      ctx.shadowBlur = 0;
      ctx.fillStyle = light;
      ctx.fillText(sym, dx, dy);
    }
  } else {
    ctx.font = `900 ${sym.length > 2 ? 70 : sym.length > 1 ? 92 : 128}px ${DISPLAY}`;
    if (wild) {
      // a rainbow tube outline, white-hot core
      const tg = ctx.createLinearGradient(-60, -50, 60, 50);
      WILD_ORDER.forEach((c, i) => tg.addColorStop(i / 3, NEON[c]));
      ctx.shadowColor = '#ff3df0';
      ctx.shadowBlur = 26;
      ctx.lineWidth = 12;
      ctx.strokeStyle = tg;
      ctx.strokeText(sym, 0, 0);
      ctx.shadowBlur = 0;
      ctx.strokeText(sym, 0, 0);
    } else {
      ctx.shadowColor = col;
      ctx.shadowBlur = 28;
      ctx.lineWidth = 11;
      ctx.strokeStyle = col;
      ctx.strokeText(sym, 0, 0);
      ctx.shadowBlur = 10;
      ctx.strokeText(sym, 0, 0);
      ctx.shadowBlur = 0;
    }
    ctx.fillStyle = light;
    ctx.fillText(sym, 0, 0);
  }
  ctx.restore();

  // corner indices: bright core, coloured rim and glow, readable over a dark neighbour in the fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    if (arrow) drawArrowIcon(ctx, card.type as ArrowIcon, 19, { fill: light, rim: wild ? '#ff3df0' : col, rimWidth: 3.5 });
    else if (emoji) drawEmoji(ctx, sym, 0, 0, 34);
    else {
      ctx.font = `900 ${sym.length > 2 ? 24 : sym.length > 1 ? 30 : 40}px ${DISPLAY}`;
      ctx.lineWidth = 6;
      ctx.strokeStyle = wild ? '#ff3df0' : col;
      ctx.strokeText(sym, 0, 0);
      ctx.shadowBlur = 0;
      ctx.fillStyle = light;
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
  };
  corner(44, 50, 0);
  if (hasLabel(card)) {
    const label = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    ctx.save();
    // shrink long names until they fit between the frame tubes
    let size = 26;
    ctx.font = `800 ${size}px ${BODY}`;
    while (size > 12 && ctx.measureText(label).width > W - 56) {
      size -= 1;
      ctx.font = `800 ${size}px ${BODY}`;
    }
    // a little tube underline, like a sign
    ctx.beginPath();
    ctx.moveTo(W / 2 - 54, H - 26);
    ctx.lineTo(W / 2 + 54, H - 26);
    tube(ctx, wild ? '#ff3df0' : col, glow, 3, false);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    ctx.lineWidth = 5;
    ctx.strokeStyle = wild ? '#ff3df0' : col;
    ctx.strokeText(label, W / 2, H - 46);
    ctx.shadowBlur = 0;
    ctx.fillStyle = light;
    ctx.fillText(label, W / 2, H - 46);
    ctx.restore();
  } else corner(W - 44, H - 50, Math.PI);
}
