import { HEX, SPECIAL } from '../../../game/content';
import type { Card } from '../../../game/types';
import { ARROW_ICONS, BODY, DISPLAY, H, W, drawArrowIcon, drawEmoji, hasLabel, isEmoji, rr, seeded, shade, symbolOf, type ArrowIcon } from '../kit';

type Hue = 'red' | 'yellow' | 'green' | 'blue';

/** Each colour as its own nebula: a deep shadow, the card colour, and a hot light core. */
const NEBULA: Record<Hue, { deep: string; glow: string; light: string }> = {
  red: { deep: '#4a0716', glow: '#ff7a3c', light: '#ffc0a0' },
  yellow: { deep: '#5a3000', glow: '#ffe45a', light: '#fff4c0' },
  green: { deep: '#03301f', glow: '#5effa8', light: '#c8ffe0' },
  blue: { deep: '#081a5a', glow: '#5ac8ff', light: '#c8e6ff' },
};
const QUADS: Hue[] = ['red', 'yellow', 'green', 'blue'];
const WHITE = '#ffffff';
const HULL = '#eef1ff';
const CX = W / 2;
const CY = H / 2 + 4;
/** radius of the porthole in the middle */
const PR = 82;

function stars(ctx: CanvasRenderingContext2D, seed: number, n: number, x0: number, y0: number, w: number, h: number) {
  const rnd = seeded(seed);
  ctx.fillStyle = WHITE;
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w;
    const y = y0 + rnd() * h;
    const s = rnd();
    ctx.globalAlpha = 0.35 + rnd() * 0.65;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.5 + 0.4, 0, Math.PI * 2);
    ctx.fill();
    if (s > 0.93) {
      // a four-point twinkle on the brightest ones
      ctx.globalAlpha = 0.8;
      ctx.fillRect(x - 6, y - 0.6, 12, 1.2);
      ctx.fillRect(x - 0.6, y - 6, 1.2, 12);
    }
  }
  ctx.globalAlpha = 1;
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** The coloured field: the card colour as a glowing nebula with stars. */
function field(ctx: CanvasRenderingContext2D, card: Card) {
  if (card.color === 'wild') {
    ctx.fillStyle = '#0a0820';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    // four nebula lobes, one per colour, swirling round the middle
    const at: [number, number][] = [[W * 0.18, H * 0.2], [W * 0.84, H * 0.3], [W * 0.82, H * 0.82], [W * 0.16, H * 0.72]];
    QUADS.forEach((q, i) => {
      blob(ctx, at[i][0], at[i][1], 175, HEX[q], 1);
      blob(ctx, at[i][0], at[i][1], 70, NEBULA[q].glow, 0.5);
    });
    ctx.globalCompositeOperation = 'source-over';
    stars(ctx, 41, 60, 0, 0, W, H);
    return;
  }
  const hue = card.color as Hue;
  const base = HEX[hue];
  const n = NEBULA[hue];
  const g = ctx.createLinearGradient(0, 0, W * 0.6, H);
  g.addColorStop(0, shade(base, 0.12));
  g.addColorStop(0.5, base);
  g.addColorStop(1, shade(base, -0.35));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // nebula clouds: darker dust lanes and a hot glow
  blob(ctx, W * 0.95, H * 0.95, 190, n.deep, 0.75);
  blob(ctx, W * 0.0, H * 0.55, 120, n.deep, 0.45);
  ctx.globalCompositeOperation = 'lighter';
  blob(ctx, W * 0.15, H * 0.1, 140, n.glow, 0.35);
  blob(ctx, W * 0.9, H * 0.38, 90, n.glow, 0.18);
  ctx.globalCompositeOperation = 'source-over';
  stars(ctx, 7 + QUADS.indexOf(hue) * 13, 46, 0, 0, W, H);
}

/** A tilted orbit around the porthole, with a little moon riding on it. */
function orbit(ctx: CanvasRenderingContext2D, wild: boolean) {
  ctx.save();
  ctx.translate(CX, CY);
  ctx.rotate(-0.5);
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 7]);
  ctx.beginPath();
  ctx.ellipse(0, 0, 128, 44, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 112, 150, 0.9, 0, Math.PI * 2);
  ctx.stroke();
  // the moon
  const mx = Math.cos(2.6) * 128;
  const my = Math.sin(2.6) * 44;
  const mg = ctx.createRadialGradient(mx - 3, my - 3, 1, mx, my, 9);
  mg.addColorStop(0, WHITE);
  mg.addColorStop(1, wild ? '#b9a8ff' : '#c9d2e8');
  ctx.fillStyle = mg;
  ctx.beginPath();
  ctx.arc(mx, my, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The round porthole: a riveted metal rim around deep space, glowing in the card colour. */
function porthole(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  ctx.save();
  ctx.translate(CX, CY);
  // a soft drop shadow so it sits above the nebula
  ctx.shadowColor = 'rgba(0,0,0,.45)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.beginPath();
  ctx.arc(0, 0, PR + 8, 0, Math.PI * 2);
  const rim = ctx.createLinearGradient(-PR, -PR, PR, PR);
  rim.addColorStop(0, '#ffffff');
  rim.addColorStop(0.45, '#b8c0d8');
  rim.addColorStop(1, '#5a6280');
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  // the window
  ctx.beginPath();
  ctx.arc(0, 0, PR, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#05061a';
  ctx.fillRect(-PR, -PR, PR * 2, PR * 2);
  if (wild) {
    // a galaxy of all four colours, its arms swirling
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const c = HEX[QUADS[i]];
      for (let k = 0; k < 7; k++) {
        const a = (i * Math.PI) / 2 + k * 0.32;
        const d = 10 + k * 10;
        blob(ctx, Math.cos(a) * d, Math.sin(a) * d, 38 - k * 2.4, c, 0.85);
      }
    }
    blob(ctx, 0, 0, 30, '#ffffff', 0.6);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    const n = NEBULA[card.color as Hue];
    ctx.globalCompositeOperation = 'lighter';
    blob(ctx, 0, PR * 0.85, PR * 1.25, HEX[card.color as Hue], 0.8);
    blob(ctx, -PR * 0.5, -PR * 0.6, PR * 0.7, n.glow, 0.22);
    ctx.globalCompositeOperation = 'source-over';
  }
  stars(ctx, wild ? 99 : 23, 22, -PR, -PR, PR * 2, PR * 2);
  // glass glint
  const gl = ctx.createLinearGradient(-PR, -PR, PR * 0.2, PR * 0.2);
  gl.addColorStop(0, 'rgba(255,255,255,.22)');
  gl.addColorStop(0.5, 'rgba(255,255,255,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(-PR, -PR, PR * 2, PR * 2);
  ctx.restore();
  // inner rim line and rivets
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(20,24,48,.7)';
  ctx.beginPath();
  ctx.arc(0, 0, PR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#3a4060';
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (PR + 4), Math.sin(a) * (PR + 4), 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Space faces: a nebula in the card's colour, a porthole with the symbol glowing inside, a silver hull frame. */
export function spaceFace(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  const base = wild ? HEX.black : HEX[card.color as Hue];
  const glow = wild ? '#ffffff' : NEBULA[card.color as Hue].glow;
  const ink = wild ? '#07061a' : shade(base, -0.6);

  // the hull frame, edge to edge
  rr(ctx, 0, 0, W, H, 30);
  const hull = ctx.createLinearGradient(0, 0, W, H);
  hull.addColorStop(0, '#ffffff');
  hull.addColorStop(1, '#c6cce6');
  ctx.fillStyle = hull;
  ctx.fill();

  rr(ctx, 11, 11, W - 22, H - 22, 22);
  ctx.save();
  ctx.clip();
  field(ctx, card);
  orbit(ctx, wild);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  rr(ctx, 11, 11, W - 22, H - 22, 22);
  ctx.stroke();
  ctx.restore();

  porthole(ctx, card);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const sym = symbolOf(card);
  const emoji = isEmoji(sym);
  // the wild reverse +4 gets the drawn reverse arrows too (its ⇄ glyph would come from a thin system font)
  const revPlus = card.type === 'wildRev4';
  const arrow = ARROW_ICONS.includes(card.type) || revPlus;
  const icon = (revPlus ? 'rev' : card.type) as ArrowIcon;
  const label = hasLabel(card);

  // the big symbol: white starlight with a coloured halo inside the porthole
  ctx.save();
  ctx.translate(CX, CY);
  if (arrow) {
    ctx.rotate(-0.12);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 18;
    drawArrowIcon(ctx, icon, revPlus ? 54 : 62, { fill: WHITE, rim: wild ? '#7a5cff' : base, rimWidth: 6 });
    if (revPlus) {
      ctx.rotate(0.12);
      ctx.shadowBlur = 0;
      ctx.font = `900 34px ${DISPLAY}`;
      ctx.lineWidth = 11;
      ctx.strokeStyle = '#2a1670';
      ctx.strokeText('+4', 0, 4);
      ctx.fillStyle = WHITE;
      ctx.fillText('+4', 0, 4);
    }
  } else if (emoji) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;
    drawEmoji(ctx, sym, 0, 0, 100);
  } else if (card.type === 'skipAll') {
    // skip everyone: two signs on the diagonal, like a pair of moons, so it never reads as a plain skip
    ctx.font = `900 76px ${DISPLAY}`;
    for (const [dx, dy] of [[-19, -21], [19, 23]]) {
      ctx.shadowColor = glow;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 10;
      ctx.strokeStyle = base;
      ctx.strokeText(sym, dx, dy);
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = WHITE;
      ctx.fillText(sym, dx, dy);
    }
  } else {
    const size = sym.length > 2 ? 64 : sym.length > 1 ? 84 : 118;
    ctx.font = `900 ${size}px ${DISPLAY}`;
    const y = size * 0.04;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 24;
    ctx.lineWidth = 12;
    ctx.strokeStyle = wild ? '#7a5cff' : base;
    ctx.strokeText(sym, 0, y);
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = WHITE;
    ctx.fillText(sym, 0, y);
    if (wild) {
      // the four colours shimmer through the wild symbol
      const g = ctx.createLinearGradient(-50, -50, 50, 50);
      QUADS.forEach((q, i) => g.addColorStop(i / 3, NEBULA[q].light));
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.55;
      ctx.fillText(sym, 0, y);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();

  // corner indices: white, a thick dark rim, readable when cards overlap in a fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (arrow) drawArrowIcon(ctx, icon, 20, { fill: HULL, rim: ink, rimWidth: 4 });
    else if (emoji) {
      ctx.fillStyle = 'rgba(5,6,26,.55)';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();
      drawEmoji(ctx, sym, 0, 0, 32);
    } else {
      ctx.font = `900 ${sym.length > 2 ? 24 : sym.length > 1 ? 30 : 40}px ${DISPLAY}`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = ink;
      ctx.strokeText(sym, 0, 2);
      ctx.fillStyle = HULL;
      ctx.fillText(sym, 0, 2);
    }
    ctx.restore();
  };
  corner(44, 50, 0);
  if (label) {
    // a mission plate along the bottom
    const text = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    // shrink the font until the name fits the plate
    let fs = 24;
    ctx.font = `800 ${fs}px ${BODY}`;
    while (fs > 12 && ctx.measureText(text).width > 184) ctx.font = `800 ${--fs}px ${BODY}`;
    const tw = ctx.measureText(text).width;
    rr(ctx, CX - tw / 2 - 14, H - 64, tw + 28, 36, 18);
    ctx.fillStyle = 'rgba(5,6,26,.72)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = wild ? 'rgba(255,255,255,.6)' : glow;
    ctx.stroke();
    ctx.fillStyle = HULL;
    ctx.fillText(text, CX, H - 45);
  } else corner(W - 44, H - 50, Math.PI);
}
