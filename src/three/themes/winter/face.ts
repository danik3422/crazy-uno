import { SPECIAL } from '../../../game/content';
import type { Card } from '../../../game/types';
import { ARROW_ICONS, BODY, DISPLAY, H, W, drawArrowIcon, drawEmoji, hasLabel, isEmoji, rr, seeded, shade, symbolOf, type ArrowIcon } from '../kit';

/** The four colours on a winter evening: berry red, candle gold, pine green, ice blue — clearly apart. */
export const WINTER = {
  red: '#df3346',
  yellow: '#f3b21f',
  green: '#169a62',
  blue: '#2b7be0',
} as const;
/** fresh snow, a touch of blue */
export const SNOW = '#f4f8ff';
export const NIGHT = '#0c1636';
export const AURORA = [WINTER.red, WINTER.yellow, WINTER.green, WINTER.blue];

/* ---------- small winter bits ---------- */

/** A six-armed snowflake centred at (x, y), `r` its arm length, drawn as strokes. */
export function snowflake(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, lw = r * 0.14, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.moveTo(0, 0);
    ctx.lineTo(c * r, s * r);
    // two little branches on each arm
    for (const k of [0.45, 0.72]) {
      const bx = c * r * k;
      const by = s * r * k;
      const l = r * (k < 0.5 ? 0.32 : 0.22);
      for (const sg of [1, -1]) {
        const b = a + sg * 0.75;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + Math.cos(b) * l, by + Math.sin(b) * l);
      }
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** Feathery frost growing out of a corner (cx, cy) toward (dx, dy) = ±1. */
export function frostCorner(ctx: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, size: number, color: string, seed: number) {
  const rnd = seeded(seed);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dx, dy);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  const fern = (a: number, len: number, w: number, depth: number) => {
    const ex = Math.cos(a) * len;
    const ey = Math.sin(a) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    for (let k = 0.3; k < 0.95; k += 0.22) {
      ctx.save();
      ctx.translate(ex * k, ey * k);
      fern(a + 0.7 + rnd() * 0.2, len * (1 - k) * 0.55, w * 0.7, depth - 1);
      fern(a - 0.7 - rnd() * 0.2, len * (1 - k) * 0.55, w * 0.7, depth - 1);
      ctx.restore();
    }
  };
  for (const a of [0.25, 0.78, 1.32]) fern(a + (rnd() - 0.5) * 0.15, size * (0.75 + rnd() * 0.3), 2.2, 2);
  ctx.restore();
}

/** A lumpy cap of snow along the top of a box, with a cool shadow and a few icicles hanging from it. */
export function snowCap(ctx: CanvasRenderingContext2D, x0: number, y0: number, w: number, depth: number, seed: number, icicles = true) {
  const rnd = seeded(seed);
  const lumps: [number, number][] = [];
  for (let x = x0; x <= x0 + w + 20; x += 18 + rnd() * 10) lumps.push([x, depth * (0.65 + rnd() * 0.55)]);
  const path = (dy: number) => {
    ctx.beginPath();
    ctx.moveTo(x0 - 4, y0 - 4);
    ctx.lineTo(x0 - 4, y0 + lumps[0][1] + dy);
    for (let i = 1; i < lumps.length; i++) {
      const [px, py] = lumps[i - 1];
      const [nx, ny] = lumps[i];
      ctx.quadraticCurveTo((px + nx) / 2, y0 + Math.max(py, ny) + 7 + dy, nx, y0 + ny + dy);
    }
    ctx.lineTo(x0 + w + 24, y0 - 4);
    ctx.closePath();
  };
  // icicles first, so the snow covers their roots
  if (icicles) {
    const g = ctx.createLinearGradient(0, y0, 0, y0 + depth + 30);
    g.addColorStop(0, 'rgba(235,248,255,.95)');
    g.addColorStop(1, 'rgba(170,215,255,.55)');
    ctx.fillStyle = g;
    for (let i = 1; i < lumps.length - 1; i++) {
      if (rnd() < 0.45) continue;
      const [x, d] = lumps[i];
      const l = 10 + rnd() * 18;
      ctx.beginPath();
      ctx.moveTo(x - 4, y0 + d);
      ctx.lineTo(x + 0.5, y0 + d + l);
      ctx.lineTo(x + 4, y0 + d);
      ctx.fill();
    }
  }
  ctx.fillStyle = 'rgba(40,70,140,.28)';
  path(4);
  ctx.fill();
  const sg = ctx.createLinearGradient(0, y0, 0, y0 + depth + 6);
  sg.addColorStop(0, '#ffffff');
  sg.addColorStop(1, '#dce9fb');
  ctx.fillStyle = sg;
  path(0);
  ctx.fill();
}

/* ---------- snowy text ---------- */

let maskCv: HTMLCanvasElement | null = null;

/**
 * Text with fresh snow settled on every upward edge: the glyph minus itself shifted down leaves its tops.
 * Drawn: an offset shadow, an ink rim, the fill, then the snow.
 */
export function snowyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  o: { fill: string | CanvasGradient; ink: string; rim: number; shadow?: string; snow?: number },
) {
  const font = `900 ${size}px ${DISPLAY}`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(text, 4, 6);
  }
  ctx.lineWidth = o.rim;
  ctx.strokeStyle = o.ink;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = o.fill;
  ctx.fillText(text, 0, 0);
  const depth = o.snow ?? Math.max(4, size * 0.07);
  if (depth <= 0) return;
  // the snow, made on a small offscreen canvas at the card's own resolution
  const m = ctx.getTransform();
  const scale = Math.max(Math.hypot(m.a, m.b), 1);
  const bw = Math.ceil(size * Math.max(1.2, text.length * 0.85) + 40);
  const bh = Math.ceil(size * 1.4);
  maskCv ??= document.createElement('canvas');
  maskCv.width = Math.ceil(bw * scale);
  maskCv.height = Math.ceil(bh * scale);
  const k = maskCv.getContext('2d')!;
  k.setTransform(scale, 0, 0, scale, bw * scale / 2, bh * scale / 2);
  k.font = font;
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.lineJoin = 'round';
  k.fillStyle = '#ffffff';
  k.strokeStyle = '#ffffff';
  k.lineWidth = o.rim * 0.5;
  k.fillText(text, 0, -1);
  k.strokeText(text, 0, -1);
  k.globalCompositeOperation = 'destination-out';
  k.fillText(text, 0, depth);
  k.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.shadowColor = 'rgba(30,60,120,.45)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1.5;
  ctx.drawImage(maskCv, -bw / 2, -bh / 2, bw, bh);
  ctx.restore();
}

/* ---------- the face ---------- */

function field(ctx: CanvasRenderingContext2D, col: string, wild: boolean, seed: number) {
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.save();
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (wild) {
    g.addColorStop(0, '#1d2c66');
    g.addColorStop(0.6, NIGHT);
    g.addColorStop(1, '#070d24');
  } else {
    g.addColorStop(0, shade(col, 0.2));
    g.addColorStop(0.5, col);
    g.addColorStop(1, shade(col, -0.22));
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(seed + 3);
  if (wild) {
    // stars over the night field
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
      ctx.beginPath();
      ctx.arc(14 + rnd() * (W - 28), 14 + rnd() * (H - 28), 0.6 + rnd() * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // falling snow, faint
  for (let i = 0; i < 9; i++) {
    const x = 24 + rnd() * (W - 48);
    const y = 60 + rnd() * (H - 120);
    if (Math.abs(x - W / 2) < 70 && Math.abs(y - H / 2) < 130) continue;
    snowflake(ctx, x, y, 5 + rnd() * 6, 'rgba(255,255,255,.4)', 1.4, rnd());
  }
  // frost in two corners (the other two hold the indices)
  const frost = wild ? 'rgba(190,225,255,.35)' : 'rgba(255,255,255,.42)';
  frostCorner(ctx, W - 12, 40, -1, 1, 70, frost, seed + 1);
  frostCorner(ctx, 12, H - 12, 1, -1, 74, frost, seed + 2);
  // a soft snow drift along the bottom
  ctx.fillStyle = wild ? 'rgba(200,225,255,.22)' : 'rgba(255,255,255,.28)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 44);
  ctx.quadraticCurveTo(W * 0.3, H - 70, W * 0.55, H - 46);
  ctx.quadraticCurveTo(W * 0.8, H - 28, W, H - 52);
  ctx.lineTo(W, H);
  ctx.fill();
  // inner shadow along the frame
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(10,20,60,.2)';
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.stroke();
  // snow on the top edge, with icicles
  snowCap(ctx, 12, 12, W - 24, 14, seed + 7);
  ctx.restore();
}

/** The ice disc: frosted glass with a cold sheen, in the classic tilted oval. */
function iceDisc(ctx: CanvasRenderingContext2D, col: string) {
  const RX = 82;
  const RY = 146;
  ctx.save();
  ctx.rotate(0.42);
  ctx.save();
  ctx.shadowColor = 'rgba(10,30,80,.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(-20, -40, 10, 0, 0, RY);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.55, '#eaf4ff');
  g.addColorStop(1, '#bcd8f6');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.clip();
  // a tint of the card's colour seeping in at the rim
  const tint = ctx.createRadialGradient(0, 0, RX * 0.7, 0, 0, RY * 1.05);
  tint.addColorStop(0, 'rgba(255,255,255,0)');
  tint.addColorStop(1, col);
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = tint;
  ctx.fillRect(-RX, -RY, RX * 2, RY * 2);
  ctx.globalAlpha = 1;
  // faint crystal facets
  ctx.strokeStyle = 'rgba(120,170,230,.28)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-RX, -40);
  ctx.lineTo(-10, -RY * 0.2);
  ctx.lineTo(RX, -90);
  ctx.moveTo(-10, -RY * 0.2);
  ctx.lineTo(20, RY);
  ctx.moveTo(-RX, 70);
  ctx.lineTo(30, 40);
  ctx.lineTo(RX, 110);
  ctx.stroke();
  // a glossy streak on the upper left
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  ctx.beginPath();
  ctx.ellipse(-44, -82, 9, 40, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // the rim: snow-white with a thin ink edge
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = shade(col, -0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, RX + 3, RY + 3, 0, 0, Math.PI * 2);
  ctx.stroke();
  // a little cap of snow sitting on top of the disc
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RX + 3, RY + 3, 0, Math.PI * 1.18, Math.PI * 1.82);
  ctx.ellipse(0, -RY + 22, RX * 0.62, 30, 0, Math.PI * 1.9, Math.PI * 1.1, true);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(30,60,120,.35)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

/** The wild cards' centre: a globe of night sky with an aurora of all four colours over snowy hills. */
function auroraGlobe(ctx: CanvasRenderingContext2D) {
  const RX = 84;
  const RY = 148;
  ctx.save();
  ctx.rotate(0.42);
  ctx.save();
  ctx.shadowColor = 'rgba(120,200,255,.5)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#081030';
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-0.42);
  // four curtains of light side by side, each a wavy band fading downward
  AURORA.forEach((c, i) => {
    const x0 = -108 + i * 54;
    const g = ctx.createLinearGradient(0, -150, 0, 110);
    g.addColorStop(0, c);
    g.addColorStop(0.6, c);
    g.addColorStop(1, 'rgba(8,16,48,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x0 - 10, -170);
    ctx.bezierCurveTo(x0 + 14, -80, x0 - 12, 0, x0 + 6, 110);
    ctx.lineTo(x0 + 60, 110);
    ctx.bezierCurveTo(x0 + 42, 0, x0 + 68, -80, x0 + 44, -170);
    ctx.closePath();
    ctx.fill();
  });
  // a soft glow over the curtains
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createLinearGradient(0, -150, 0, 60);
  glow.addColorStop(0, 'rgba(255,255,255,.18)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-160, -170, 320, 240);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // snowy hills at the bottom
  ctx.fillStyle = '#e9f2ff';
  ctx.beginPath();
  ctx.moveTo(-160, 200);
  ctx.lineTo(-160, 92);
  ctx.quadraticCurveTo(-60, 52, 20, 96);
  ctx.quadraticCurveTo(90, 70, 160, 84);
  ctx.lineTo(160, 200);
  ctx.fill();
  ctx.fillStyle = '#bcd2f0';
  ctx.beginPath();
  ctx.moveTo(-160, 200);
  ctx.lineTo(-160, 130);
  ctx.quadraticCurveTo(-30, 104, 160, 132);
  ctx.lineTo(160, 200);
  ctx.fill();
  // two little pines on the hill
  ctx.fillStyle = '#123a3a';
  for (const [x, y, s] of [[-58, 78, 1], [70, 82, 0.8]] as const) {
    ctx.beginPath();
    ctx.moveTo(x, y - 34 * s);
    ctx.lineTo(x + 13 * s, y);
    ctx.lineTo(x - 13 * s, y);
    ctx.fill();
  }
  ctx.restore();
  // glass rim
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#e8f4ff';
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.beginPath();
  ctx.ellipse(-44, -84, 8, 38, 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A winter face: snow-white frame, a frosty colour field capped with snow, an ice disc and snow-topped numbers. */
export function drawFace(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  const col = wild ? NIGHT : WINTER[card.color as keyof typeof WINTER];
  const seed = card.id * 13 + (card.type === 'num' ? card.value ?? 0 : 50) + 1;

  // the snowy frame, edge to edge (the 3D card cuts its own outline)
  rr(ctx, 0, 0, W, H, 30);
  const fg = ctx.createLinearGradient(0, 0, W, H);
  fg.addColorStop(0, '#ffffff');
  fg.addColorStop(1, '#dfeafa');
  ctx.fillStyle = fg;
  ctx.fill();

  field(ctx, col, wild, seed);
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(40,70,140,.4)';
  ctx.stroke();

  const sym = symbolOf(card);
  const emoji = isEmoji(sym);
  const arrowKind: ArrowIcon | null = card.type === 'wildRev4' ? 'rev' : ARROW_ICONS.includes(card.type) ? (card.type as ArrowIcon) : null;
  const tag = hasLabel(card);
  const ink = wild ? '#081030' : shade(col, -0.55);
  // numbers a little deeper than the field, lit from the top
  const fill = (y0: number, y1: number) => {
    if (wild) return SNOW;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, shade(col, 0.12));
    g.addColorStop(1, shade(col, -0.12));
    return g;
  };

  ctx.save();
  ctx.translate(W / 2, H / 2);
  if (wild) auroraGlobe(ctx);
  else iceDisc(ctx, col);
  ctx.translate(0, 6);
  if (wild) {
    ctx.shadowColor = 'rgba(160,230,255,.9)';
    ctx.shadowBlur = 14;
  }
  if (arrowKind) {
    const rev4 = card.type === 'wildRev4';
    ctx.save();
    if (rev4) ctx.translate(0, -30);
    ctx.rotate(-0.12);
    drawArrowIcon(ctx, arrowKind, rev4 ? 48 : 64, { fill: wild ? SNOW : col, rim: ink, rimWidth: wild ? 7 : 5, shadow: wild ? undefined : ink });
    ctx.restore();
    if (rev4) {
      ctx.translate(0, 44);
      snowyText(ctx, '+4', 50, { fill: SNOW, ink, rim: 9 });
    }
  } else if (emoji) {
    ctx.shadowColor = wild ? 'rgba(160,230,255,.9)' : 'rgba(0,30,80,.3)';
    ctx.shadowBlur = wild ? 18 : 8;
    ctx.shadowOffsetY = wild ? 0 : 4;
    drawEmoji(ctx, sym, 0, 0, wild ? 92 : 102);
  } else if (card.type === 'skipAll') {
    // skip everyone: two signs on the diagonal, so it never looks like a plain skip
    ctx.save();
    ctx.translate(-26, -46);
    snowyText(ctx, sym, 88, { fill: fill(-40, 40), ink, rim: 8, shadow: ink });
    ctx.restore();
    ctx.translate(26, 44);
    snowyText(ctx, sym, 88, { fill: fill(-40, 40), ink, rim: 8, shadow: ink });
  } else {
    const size = sym.length > 2 ? 62 : sym.length > 1 ? (wild ? 80 : 86) : wild ? 112 : 128;
    snowyText(ctx, sym, size, { fill: fill(-size / 2, size / 2), ink, rim: wild ? 11 : 9, shadow: wild ? undefined : ink });
  }
  ctx.restore();

  // corner indices: snow white with a dark rim, readable when cards overlap in a fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (arrowKind) drawArrowIcon(ctx, arrowKind, 19, { fill: SNOW, rim: ink, rimWidth: 3.5 });
    else if (emoji) drawEmoji(ctx, sym, 0, 0, 34);
    else {
      ctx.font = `900 ${sym.length > 2 ? 25 : sym.length > 1 ? 32 : 44}px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = ink;
      ctx.strokeText(sym, 0, 0);
      ctx.fillStyle = SNOW;
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
  };
  corner(46, 58, 0);
  if (tag) {
    // the name on a frosted-glass ribbon at the foot
    const label = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    let fs = 24;
    ctx.font = `800 ${fs}px ${BODY}`;
    while (fs > 12 && ctx.measureText(label).width > W - 74) ctx.font = `800 ${--fs}px ${BODY}`;
    const tw = Math.min(W - 40, ctx.measureText(label).width + 30);
    ctx.fillStyle = wild ? 'rgba(8,16,48,.85)' : 'rgba(244,250,255,.92)';
    rr(ctx, W / 2 - tw / 2, H - 62, tw, 36, 14);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = wild ? 'rgba(170,220,255,.7)' : shade(col, -0.3);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = wild ? '#bff0ff' : shade(col, -0.5);
    ctx.fillText(label, W / 2, H - 43);
  } else corner(W - 46, H - 58, Math.PI);
}
