import { SPECIAL } from '../../../game/content';
import type { Card } from '../../../game/types';
import { ARROW_ICONS, BODY, DISPLAY, H, W, drawArrowIcon, drawEmoji, hasLabel, isEmoji, rr, seeded, shade, symbolOf, type ArrowIcon } from '../kit';

/** The four colours, pushed a little toward a spooky night but still clearly apart. */
export const SPOOKY = {
  red: '#d8322e',
  yellow: '#f6b318',
  green: '#3fb83a',
  blue: '#5263e0',
} as const;
/** old bone / parchment */
export const BONE = '#f1e5c8';
const NIGHT = '#170c1f';

/* ---------- drips ---------- */

let maskCv: HTMLCanvasElement | null = null;

/**
 * Bottom edges of a text glyph, found on a little offscreen mask, so the number can drip like wet paint.
 * Returns a few x / y spots (relative to the text's centre).
 */
function dripSpots(text: string, font: string, seed: number, count: number): [number, number][] {
  maskCv ??= Object.assign(document.createElement('canvas'), { width: 220, height: 200 });
  const m = maskCv.getContext('2d', { willReadFrequently: true })!;
  m.clearRect(0, 0, 220, 200);
  m.font = font;
  m.textAlign = 'center';
  m.textBaseline = 'middle';
  m.fillStyle = '#000';
  m.fillText(text, 110, 100);
  const px = m.getImageData(0, 0, 220, 200).data;
  const cols: [number, number][] = [];
  for (let x = 4; x < 216; x += 3) {
    for (let y = 196; y > 4; y--) {
      if (px[(y * 220 + x) * 4 + 3] > 160) {
        cols.push([x - 110, y - 100]);
        break;
      }
    }
  }
  if (!cols.length) return [];
  // only the lowest bits drip: pick spots near the bottom, apart from each other
  const rnd = seeded(seed);
  const maxY = Math.max(...cols.map(c => c[1]));
  const low = cols.filter(c => c[1] > maxY - 26);
  const out: [number, number][] = [];
  for (let tries = 0; tries < 40 && out.length < count; tries++) {
    const c = low[Math.floor(rnd() * low.length)];
    if (out.every(o => Math.abs(o[0] - c[0]) > 22)) out.push([c[0], c[1] - 3]);
  }
  return out;
}

/** One drop running down from (x, y): a stalk and a round bead. */
function drip(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, w: number) {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.55, y + len * 0.6, x - w * 0.5, y + len);
  ctx.arc(x, y + len, w * 0.95, Math.PI, 0, true);
  ctx.quadraticCurveTo(x + w * 0.55, y + len * 0.6, x + w, y);
  ctx.closePath();
  ctx.fill();
}

/**
 * A big centre symbol that drips: dark offset shadow, an ink rim, the fill on top,
 * with a few drops running off its lowest strokes.
 */
export function drippyText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  o: { fill: string | CanvasGradient; ink: string; rim: number; shadow?: string; seed: number; drops?: number },
) {
  const font = `900 ${size}px ${DISPLAY}`;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const rnd = seeded(o.seed * 7 + 3);
  const drops = dripSpots(text, font, o.seed, o.drops ?? 3).map(([x, y]) => [x, y, 12 + rnd() * 20, 4.6 + rnd() * 2.4] as const);
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.fillText(text, 5, 7);
  }
  ctx.lineWidth = o.rim;
  ctx.strokeStyle = o.ink;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = o.ink;
  for (const [x, y, l, w] of drops) drip(ctx, x, y, l + 2.5, w + o.rim * 0.28);
  ctx.fillStyle = o.fill;
  ctx.fillText(text, 0, 0);
  for (const [x, y, l, w] of drops) drip(ctx, x, y - 2, l, w);
  // a wet highlight on each bead
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (const [x, y, l, w] of drops) {
    ctx.beginPath();
    ctx.arc(x - w * 0.35, y + l - w * 0.3, w * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ---------- small spooky bits ---------- */

/** A bat silhouette centred at (x, y), `s` its half wing span. */
export function bat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s / 30, s / 30);
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.quadraticCurveTo(-14, -16, -30, -6);
  ctx.quadraticCurveTo(-23, -1, -21, 8);
  ctx.quadraticCurveTo(-15, 1, -10, 7);
  ctx.quadraticCurveTo(-5, 1, 0, 8);
  ctx.quadraticCurveTo(5, 1, 10, 7);
  ctx.quadraticCurveTo(15, 1, 21, 8);
  ctx.quadraticCurveTo(23, -1, 30, -6);
  ctx.quadraticCurveTo(14, -16, 0, -3);
  ctx.fill();
  // ears
  ctx.beginPath();
  ctx.moveTo(-4, -4);
  ctx.lineTo(-3, -10);
  ctx.lineTo(0, -5);
  ctx.lineTo(3, -10);
  ctx.lineTo(4, -4);
  ctx.fill();
  ctx.restore();
}

/** A quarter spider web anchored in a corner (cx, cy), opening toward (dx, dy) = ±1. */
export function cornerWeb(ctx: CanvasRenderingContext2D, cx: number, cy: number, dx: number, dy: number, size: number, color: string, width = 1.3) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(dx, dy);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  const spokes = 5;
  for (let i = 0; i <= spokes; i++) {
    const a = (i / spokes) * (Math.PI / 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * size, Math.sin(a) * size);
    ctx.stroke();
  }
  for (let r = size * 0.22; r < size; r += size * 0.2) {
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = (i / spokes) * (Math.PI / 2);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const m = a - Math.PI / 4 / spokes;
        ctx.quadraticCurveTo(Math.cos(m) * r * 0.84, Math.sin(m) * r * 0.84, x, y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** The tombstone outline around the origin: an arched top, w wide, h tall, centred. */
function tombPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const r = w / 2;
  ctx.beginPath();
  ctx.moveTo(-r, h / 2);
  ctx.lineTo(-r, -h / 2 + r);
  ctx.arc(0, -h / 2 + r, r, Math.PI, 0);
  ctx.lineTo(r, h / 2);
  ctx.closePath();
}

/* ---------- the face ---------- */

const TOMB_W = 172;
const TOMB_H = 248;

function field(ctx: CanvasRenderingContext2D, col: string, wild: boolean, seed: number) {
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.save();
  ctx.clip();
  if (wild) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2c1240');
    g.addColorStop(1, NIGHT);
    ctx.fillStyle = g;
  } else ctx.fillStyle = col;
  ctx.fillRect(0, 0, W, H);
  // candle glow behind the centre, night creeping in from the edges
  const glow = ctx.createRadialGradient(W / 2, H * 0.46, 20, W / 2, H * 0.5, H * 0.62);
  glow.addColorStop(0, wild ? 'rgba(140,255,90,.28)' : 'rgba(255,236,170,.32)');
  glow.addColorStop(0.5, 'rgba(255,200,120,.04)');
  glow.addColorStop(1, 'rgba(20,0,30,.5)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  // a web in the top-right corner and two bats, faint
  cornerWeb(ctx, W - 12, 12, -1, 1, 96, wild ? 'rgba(220,210,255,.28)' : 'rgba(25,5,30,.3)', 1.4);
  ctx.fillStyle = wild ? 'rgba(0,0,0,.6)' : 'rgba(25,5,30,.32)';
  const rnd = seeded(seed + 11);
  bat(ctx, 40 + rnd() * 30, 104 + rnd() * 12, 13, -0.2);
  bat(ctx, W - 50 - rnd() * 20, 128 + rnd() * 18, 10, 0.25);
  // ground mist along the bottom
  ctx.fillStyle = wild ? 'rgba(150,255,120,.12)' : 'rgba(255,250,235,.16)';
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= W; x += 32) ctx.quadraticCurveTo(x + 16, H - 62 - ((x / 32) % 2) * 14, x + 32, H - 52);
  ctx.lineTo(W, H);
  ctx.fill();
  // drippy slime along the top edge, in a darker tone of the field
  ctx.fillStyle = wild ? '#120818' : shade(col, -0.32);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  for (let x = 0; x < W; x += 18) {
    const l = rnd() < 0.35 ? 10 + rnd() * 18 : 2 + rnd() * 4;
    ctx.quadraticCurveTo(x + 4, 22, x + 6, 22 + l);
    ctx.arc(x + 9, 22 + l, 3, Math.PI, 0, true);
    ctx.quadraticCurveTo(x + 14, 22, x + 18, 22);
  }
  ctx.lineTo(W, 0);
  ctx.fill();
  // an inner shadow along the frame
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,0,.22)';
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.stroke();
  ctx.restore();
}

/** The weathered stone the symbol is carved into. */
function tombstone(ctx: CanvasRenderingContext2D, ink: string, seed: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.4)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 5;
  tombPath(ctx, TOMB_W, TOMB_H);
  const g = ctx.createLinearGradient(-60, -TOMB_H / 2, 60, TOMB_H / 2);
  g.addColorStop(0, '#fbf5e6');
  g.addColorStop(1, '#d9ceb6');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  ctx.save();
  tombPath(ctx, TOMB_W, TOMB_H);
  ctx.clip();
  // carved border
  tombPath(ctx, TOMB_W - 20, TOMB_H - 20);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(80,60,40,.28)';
  ctx.stroke();
  // a crack and some moss at the foot
  const rnd = seeded(seed + 5);
  ctx.strokeStyle = 'rgba(70,50,40,.35)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  let x = TOMB_W / 2 - 6;
  let y = -TOMB_H / 2 + 70 + rnd() * 30;
  ctx.moveTo(x, y);
  for (let i = 0; i < 4; i++) ctx.lineTo((x -= 6 + rnd() * 8), (y += 7 + rnd() * 9));
  ctx.stroke();
  ctx.fillStyle = 'rgba(70,120,40,.4)';
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    ctx.arc(-TOMB_W / 2 + rnd() * TOMB_W, TOMB_H / 2 - rnd() * 8, 6 + rnd() * 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // the outline
  tombPath(ctx, TOMB_W, TOMB_H);
  ctx.lineWidth = 3;
  ctx.strokeStyle = ink;
  ctx.stroke();
}

const WILD_RING = [SPOOKY.red, SPOOKY.yellow, SPOOKY.green, SPOOKY.blue];

/** A witch's cauldron brewing all four colours: the wild cards' centre. */
function cauldron(ctx: CanvasRenderingContext2D, fire: boolean) {
  // bubbles of every colour rising out of it
  const bubbles: [number, number, number, string][] = [
    [-46, -96, 17, SPOOKY.red], [6, -120, 22, SPOOKY.yellow], [52, -90, 15, SPOOKY.green], [-12, -74, 11, SPOOKY.blue],
    [30, -146, 9, SPOOKY.blue], [-36, -136, 8, SPOOKY.green],
  ];
  for (const [x, y, r, c] of bubbles) {
    ctx.fillStyle = c;
    ctx.strokeStyle = '#0b0610';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath();
    ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // flames under the pot (not when the name ribbon sits there)
  if (fire) for (let i = -2; i <= 2; i++) {
    const fx = i * 22;
    ctx.fillStyle = i % 2 ? '#ff7a1a' : '#ffc23a';
    ctx.beginPath();
    ctx.moveTo(fx - 13, 150);
    ctx.quadraticCurveTo(fx - 12, 128, fx + (i % 2 ? 4 : -3), 112 - (i === 0 ? 10 : 0));
    ctx.quadraticCurveTo(fx + 12, 128, fx + 13, 150);
    ctx.fill();
  }
  // the pot, with stubby feet
  ctx.fillStyle = '#0b0610';
  if (fire) {
    rr(ctx, -66, 116, 22, 26, 6);
    ctx.fill();
    rr(ctx, 44, 116, 22, 26, 6);
    ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(130,255,90,.55)';
  ctx.shadowBlur = 22;
  ctx.beginPath();
  ctx.ellipse(0, 36, 96, 88, 0, 0, Math.PI * 2);
  const pot = ctx.createRadialGradient(-34, 6, 8, 0, 36, 100);
  pot.addColorStop(0, '#3a2c48');
  pot.addColorStop(1, '#09050d');
  ctx.fillStyle = pot;
  ctx.fill();
  ctx.restore();
  // the brew: four colours swirling at the mouth
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -44, 82, 17, 0, 0, Math.PI * 2);
  ctx.clip();
  WILD_RING.forEach((c, i) => {
    ctx.beginPath();
    ctx.moveTo(0, -44);
    ctx.arc(0, -44, 100, (i * Math.PI) / 2 - 0.4, ((i + 1) * Math.PI) / 2 - 0.4);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  });
  ctx.restore();
  // potion running over the rim
  WILD_RING.forEach((c, i) => {
    ctx.fillStyle = c;
    drip(ctx, -54 + i * 36, -36, 12 + ((i * 7) % 13), 6);
  });
  // the rim
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#0b0610';
  ctx.beginPath();
  ctx.ellipse(0, -44, 86, 19, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(200,170,255,.35)';
  ctx.beginPath();
  ctx.ellipse(0, -46, 88, 20, 0, Math.PI * 1.05, Math.PI * 1.6);
  ctx.stroke();
}

/** A Halloween face: bone frame, slime-dripping colour field, a tombstone (or a cauldron for wilds) and dripping numbers. */
export function drawFace(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  const col = wild ? NIGHT : SPOOKY[card.color as keyof typeof SPOOKY];
  const seed = card.id * 13 + (card.type === 'num' ? card.value ?? 0 : 50);

  // bone frame, edge to edge (the 3D card cuts its own outline), with a few age stains
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = BONE;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const stain = ctx.createRadialGradient(W, H, 20, W, H, H * 0.9);
  stain.addColorStop(0, 'rgba(120,80,30,.25)');
  stain.addColorStop(1, 'rgba(120,80,30,0)');
  ctx.fillStyle = stain;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  field(ctx, col, wild, seed);
  // a thin dark line between the bone and the field
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(30,10,30,.55)';
  ctx.stroke();

  const sym = symbolOf(card);
  const emoji = isEmoji(sym);
  // reverse +4 shows the drawn reverse arrows (the font has no good ⇄) with a +4 badge
  const arrowKind: ArrowIcon | null = card.type === 'wildRev4' ? 'rev' : ARROW_ICONS.includes(card.type) ? (card.type as ArrowIcon) : null;
  const tag = hasLabel(card);
  const ink = wild ? '#0b0610' : shade(col, -0.55);

  ctx.save();
  ctx.translate(W / 2, H / 2 + 4);
  if (wild) cauldron(ctx, !tag);
  else tombstone(ctx, ink, seed);
  // the big symbol: carved into the stone, or glowing on the cauldron
  const cy = wild ? 34 : 14;
  ctx.translate(0, cy);
  if (arrowKind) {
    const rev4 = card.type === 'wildRev4';
    ctx.save();
    if (rev4) ctx.translate(0, -26);
    ctx.rotate(-0.12);
    drawArrowIcon(ctx, arrowKind, rev4 ? 46 : wild ? 58 : 64, { fill: wild ? BONE : col, rim: ink, rimWidth: wild ? 7 : 5, shadow: wild ? undefined : ink });
    ctx.restore();
    if (rev4) {
      ctx.shadowColor = 'rgba(150,255,100,.8)';
      ctx.shadowBlur = 12;
      ctx.translate(0, 52);
      drippyText(ctx, '+4', 46, { fill: '#b6ff7a', ink, rim: 8, seed, drops: 0 });
      ctx.shadowColor = 'transparent';
    }
  } else if (emoji) {
    if (wild) {
      // a glow of witch-light behind the emoji, so it reads on the black pot
      const gl = ctx.createRadialGradient(0, 0, 4, 0, 0, 68);
      gl.addColorStop(0, 'rgba(230,255,200,.95)');
      gl.addColorStop(0.55, 'rgba(150,255,100,.55)');
      gl.addColorStop(1, 'rgba(120,255,80,0)');
      ctx.fillStyle = gl;
      ctx.beginPath();
      ctx.arc(0, 0, 68, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    drawEmoji(ctx, sym, 0, 0, wild ? 90 : 100);
  } else {
    const size = sym.length > 2 ? 62 : sym.length > 1 ? (wild ? 76 : 84) : wild ? 110 : 124;
    if (wild) {
      ctx.shadowColor = 'rgba(150,255,100,.8)';
      ctx.shadowBlur = 16;
    }
    if (card.type === 'skipAll') {
      // skip everyone: two signs on the diagonal, so it never looks like a plain skip
      ctx.save();
      ctx.translate(-27, -46);
      drippyText(ctx, sym, 90, { fill: col, ink, rim: 8, shadow: ink, seed: seed + 1, drops: 0 });
      ctx.restore();
      ctx.translate(25, 42);
      drippyText(ctx, sym, 90, { fill: col, ink, rim: 8, shadow: ink, seed, drops: 2 });
    } else drippyText(ctx, sym, size, { fill: wild ? BONE : col, ink, rim: wild ? 10 : 9, shadow: wild ? undefined : ink, seed, drops: wild ? 0 : 3 });
  }
  ctx.restore();

  // corner indices: bone with a dark rim, readable when cards overlap in a fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (arrowKind) drawArrowIcon(ctx, arrowKind, 19, { fill: BONE, rim: ink, rimWidth: 3.5 });
    else if (emoji) drawEmoji(ctx, sym, 0, 0, 34);
    else {
      ctx.font = `900 ${sym.length > 2 ? 25 : sym.length > 1 ? 32 : 44}px ${DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 7;
      ctx.strokeStyle = ink;
      ctx.strokeText(sym, 0, 0);
      ctx.fillStyle = BONE;
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
  };
  corner(46, 54, 0);
  if (tag) {
    // the name on a dark ribbon at the foot
    const label = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    // shrink the font until the name fits on the ribbon
    let fs = 24;
    ctx.font = `800 ${fs}px ${BODY}`;
    while (fs > 12 && ctx.measureText(label).width > W - 74) ctx.font = `800 ${--fs}px ${BODY}`;
    const tw = ctx.measureText(label).width + 30;
    ctx.fillStyle = 'rgba(15,5,20,.82)';
    rr(ctx, W / 2 - tw / 2, H - 62, tw, 36, 12);
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = wild ? '#b6ff7a' : '#ffb347';
    ctx.fillText(label, W / 2, H - 43);
  } else corner(W - 46, H - 54, Math.PI);
}
