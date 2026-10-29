/**
 * Hand-drawn vector icons for the special cards (gift, bomb, dare, rain, mirror, chaos, dump, discard-all,
 * roulette), painted with Canvas 2D paths instead of the emoji font. One style for the whole set: bold
 * silhouettes with a dark ink outline (so they read on white ovals, dark glass and black wild cards alike),
 * soft gradients lit from the top-left and a glossy highlight.
 *
 * Each icon is designed in a 100 × 100 box centred on the origin and scaled to `size`.
 */
import { HEX } from '../../game/content';

type Ctx = CanvasRenderingContext2D;

const INK = '#22182e';
const TAU = Math.PI * 2;
/** outline width in icon units; set per draw (thicker when small so the silhouette survives) */
let LW = 5;

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function rad(ctx: Ctx, x: number, y: number, r: number, stops: string[]) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

/** fills the current path and outlines it in ink */
function paint(ctx: Ctx, fill: string | CanvasGradient, lw = LW) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = INK;
  ctx.stroke();
}

function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}

function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0, a = 0.6) {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}

/** a stroke with an ink casing: a thick ink line, then the coloured line on top */
function cased(ctx: Ctx, path: () => void, color: string | CanvasGradient, w: number) {
  path();
  ctx.lineWidth = w + LW * 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  path();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function star(ctx: Ctx, x: number, y: number, r: number, inner: number, points: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

/** a small four-pointed twinkle */
function twinkle(ctx: Ctx, x: number, y: number, r: number) {
  star(ctx, x, y, r, r * 0.32, 4);
  paint(ctx, '#ffffff', LW * 0.6);
}

function drop(ctx: Ctx, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s * 1.9);
  ctx.bezierCurveTo(x + s * 0.4, y - s * 1.0, x + s, y - s * 0.5, x + s, y);
  ctx.arc(x, y, s, 0, Math.PI);
  ctx.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.4, y - s * 1.0, x, y - s * 1.9);
  ctx.closePath();
  paint(ctx, lin(ctx, x - s, y - s * 2, x + s, y + s, ['#c9f3ff', '#4fb8f5', '#2a7fd4']), LW * 0.8);
  gloss(ctx, x - s * 0.35, y - s * 0.1, s * 0.25, s * 0.45, 0.3, 0.8);
}

// ─── icons ────────────────────────────────────────────────────────────────

function gift(ctx: Ctx) {
  const gold = (y0: number, y1: number) => lin(ctx, 0, y0, 0, y1, ['#fff1a6', '#ffcc33', '#e89a0c']);
  // bow loops
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.bezierCurveTo(s * -6, -46, s * -34, -50, s * -30, -32);
    ctx.bezierCurveTo(s * -27, -22, s * -12, -21, 0, -24);
    paint(ctx, gold(-48, -20));
  }
  // loop holes
  for (const s of [-1, 1]) {
    ellipse(ctx, s * -15, -32, 5, 3, s * 0.5);
    ctx.fillStyle = 'rgba(150,80,0,0.55)';
    ctx.fill();
  }
  // box
  rrect(ctx, -32, -6, 64, 48, 6);
  paint(ctx, lin(ctx, -32, -6, 32, 42, ['#ff8aa4', '#ee3a64', '#b81d48']));
  rrect(ctx, -32, -6, 64, 48, 6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(90,0,30,0.22)';
  ctx.fillRect(-32, -6, 64, 9); // shadow under the lid
  ctx.restore();
  rrect(ctx, -8, -6, 16, 48, 0);
  paint(ctx, gold(-6, 42));
  // lid
  rrect(ctx, -38, -24, 76, 20, 6);
  paint(ctx, lin(ctx, -38, -24, 38, -4, ['#ff9bb2', '#f04a72', '#c92655']));
  rrect(ctx, -9, -24, 18, 20, 0);
  paint(ctx, gold(-24, -4));
  // knot
  rrect(ctx, -8, -31, 16, 12, 5);
  paint(ctx, gold(-31, -19));
  // shine
  gloss(ctx, -24, -18, 9, 2.6, 0, 0.75);
  rrect(ctx, -26, 2, 5, 30, 2.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
}

function bomb(ctx: Ctx) {
  // cap
  ctx.save();
  ctx.translate(17, -18);
  ctx.rotate(Math.PI / 4);
  rrect(ctx, -10, -9, 20, 16, 3);
  paint(ctx, lin(ctx, -10, 0, 10, 0, ['#a4abc4', '#5f6680', '#3a3f55']));
  ctx.restore();
  // fuse
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(21, -24);
    ctx.bezierCurveTo(26, -34, 30, -40, 38, -38);
  }, '#f2d39b', 4.5);
  // body
  ellipse(ctx, -5, 10, 35, 35);
  paint(ctx, rad(ctx, -18, -4, 52, ['#8c94b8', '#4a5072', '#22243a']));
  // rim light
  ctx.beginPath();
  ctx.arc(-5, 10, 29, 0.15, 1.45);
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(150,170,255,0.55)';
  ctx.stroke();
  gloss(ctx, -19, -5, 11, 6.5, -0.75, 0.6);
  gloss(ctx, -7, -15, 3, 3, 0, 0.7);
  // spark
  star(ctx, 39, -39, 14, 6, 8, 0.2);
  paint(ctx, rad(ctx, 39, -39, 14, ['#ffffff', '#ffe14a', '#ff7a1a']), LW * 0.7);
  ellipse(ctx, 39, -39, 3.2, 3.2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

function rain(ctx: Ctx) {
  // handle
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 30);
    ctx.arc(-8, 30, 8, 0, Math.PI);
  }, lin(ctx, 0, -6, 0, 40, ['#ffd27a', '#f08c2a']), 5.5);
  // canopy
  const cy = -2;
  const canopy = () => {
    ctx.beginPath();
    ctx.arc(0, cy, 44, Math.PI, TAU);
    const n = 4;
    for (let i = 0; i < n; i++) {
      const x0 = 44 - (88 / n) * i;
      const x1 = x0 - 88 / n;
      ctx.quadraticCurveTo((x0 + x1) / 2, cy - 10, x1, cy);
    }
    ctx.closePath();
  };
  canopy();
  paint(ctx, lin(ctx, -40, -46, 30, 0, ['#c7a6ff', '#8a5cf5', '#5a30c9']));
  ctx.save();
  canopy();
  ctx.clip();
  // alternate panels lighter
  for (const [a, b] of [[-44, -22], [0, 22]]) {
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.quadraticCurveTo(a * 0.75, -30, a, cy);
    ctx.lineTo(b, cy);
    ctx.quadraticCurveTo(b * 0.75, -30, 0, -46);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fill();
  }
  ctx.lineWidth = LW * 0.55;
  ctx.strokeStyle = INK;
  for (const x of [-22, 0, 22]) {
    ctx.beginPath();
    ctx.moveTo(0, -46);
    ctx.quadraticCurveTo(x * 0.75, -30, x, cy);
    ctx.stroke();
  }
  ctx.restore();
  canopy();
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke();
  gloss(ctx, -24, -28, 11, 5, -0.7, 0.55);
  // tip
  ellipse(ctx, 0, -48, 3.5, 3.5);
  paint(ctx, '#ffd27a', LW * 0.7);
  // rain
  drop(ctx, -33, 22, 5.5);
  drop(ctx, -22, 42, 4.5);
  drop(ctx, 32, 20, 5.5);
  drop(ctx, 20, 40, 4.5);
}

function mirror(ctx: Ctx) {
  const gold = lin(ctx, -30, -46, 30, 40, ['#fff0a0', '#ffc531', '#d98a0e']);
  ctx.save();
  ctx.translate(-3, 2);
  ctx.rotate(-0.38);
  // handle
  rrect(ctx, -7, 18, 14, 30, 6);
  paint(ctx, gold);
  ellipse(ctx, 0, 48, 7, 5);
  paint(ctx, gold);
  // frame
  ellipse(ctx, 0, -10, 30, 34);
  paint(ctx, gold);
  // glass
  ellipse(ctx, 0, -10, 22, 26);
  paint(ctx, lin(ctx, -20, -36, 20, 16, ['#f2fdff', '#a6e6fb', '#4aa6dc']), LW * 0.6);
  ctx.save();
  ellipse(ctx, 0, -10, 22, 26);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(-26, -6);
  ctx.lineTo(4, -40);
  ctx.lineTo(14, -40);
  ctx.lineTo(-20, 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.moveTo(-16, 8);
  ctx.lineTo(18, -32);
  ctx.lineTo(22, -26);
  ctx.lineTo(-11, 13);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // frame gleam
  ctx.beginPath();
  ctx.ellipse(0, -10, 26, 30, 0, Math.PI * 1.05, Math.PI * 1.45);
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.stroke();
  ctx.restore();
  twinkle(ctx, 32, -34, 10);
  twinkle(ctx, 38, -14, 5.5);
}

function maskPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(0, -30);
  ctx.bezierCurveTo(18, -30, 25, -26, 25, -14);
  ctx.bezierCurveTo(25, 8, 13, 29, 0, 30);
  ctx.bezierCurveTo(-13, 29, -25, 8, -25, -14);
  ctx.bezierCurveTo(-25, -26, -18, -30, 0, -30);
  ctx.closePath();
}

function mask(ctx: Ctx, happy: boolean) {
  maskPath(ctx);
  paint(ctx, happy
    ? lin(ctx, -25, -30, 25, 30, ['#fff3a8', '#ffd23f', '#f09a14'])
    : lin(ctx, -25, -30, 25, 30, ['#b9d4ff', '#6f97f5', '#3f5fcf']));
  ctx.fillStyle = INK;
  if (happy) {
    // smiling eyes: upward crescents
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 10, -8, 7, 6, 0, Math.PI, TAU);
      ctx.ellipse(s * 10, -7, 7, 3, 0, TAU, Math.PI, true);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-14, 6);
    ctx.quadraticCurveTo(0, 12, 14, 6);
    ctx.quadraticCurveTo(12, 24, 0, 24);
    ctx.quadraticCurveTo(-12, 24, -14, 6);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,90,110,0.55)';
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 17, 6, 4.5, 3);
      ctx.fill();
    }
  } else {
    // sad eyes: drooping almonds
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 10, -6, 7, 4, s * 0.35, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.moveTo(-12, 20);
    ctx.quadraticCurveTo(0, 2, 12, 20);
    ctx.quadraticCurveTo(0, 13, -12, 20);
    ctx.fill();
    drop(ctx, -13, 9, 2.8);
  }
  // eyebrows
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    if (happy) ctx.arc(s * 10, -12, 7, Math.PI * 1.2, Math.PI * 1.8);
    else {
      ctx.moveTo(s * 4, -16);
      ctx.lineTo(s * 15, -20);
    }
    ctx.stroke();
  }
  // shine
  gloss(ctx, -14, -20, 6, 3, -0.5, 0.65);
}

function dare(ctx: Ctx) {
  ctx.save();
  ctx.translate(15, -9);
  ctx.rotate(0.28);
  mask(ctx, false);
  ctx.restore();
  ctx.save();
  ctx.translate(-13, 9);
  ctx.rotate(-0.22);
  mask(ctx, true);
  ctx.restore();
}

function chaos(ctx: Ctx) {
  const bands = [
    { y: 34, w: 7, x: 4 },
    { y: 22, w: 13, x: -3 },
    { y: 9, w: 20, x: 3 },
    { y: -5, w: 28, x: -4 },
    { y: -20, w: 36, x: 2 },
    { y: -35, w: 44, x: -2 },
  ];
  // the tip curling to the ground
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(4, 38);
    ctx.quadraticCurveTo(10, 46, 2, 48);
  }, '#c3b8ff', 4);
  for (const b of bands) {
    const h = 6 + b.w * 0.1;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y, b.w, h, 0, 0, TAU);
    paint(ctx, lin(ctx, b.x - b.w, b.y - h, b.x + b.w, b.y + h, ['#eef0ff', '#a9a4ff', '#6a55d8']));
    // inner hollow of each ring
    ctx.beginPath();
    ctx.ellipse(b.x + b.w * 0.08, b.y - h * 0.25, b.w * 0.72, h * 0.45, 0, 0, TAU);
    ctx.fillStyle = 'rgba(60,40,140,0.35)';
    ctx.fill();
    gloss(ctx, b.x - b.w * 0.55, b.y + h * 0.35, b.w * 0.22, h * 0.25, 0, 0.7);
  }
  // debris whirling around
  ctx.save();
  ctx.translate(-38, -2);
  ctx.rotate(0.6);
  rrect(ctx, -6, -3.5, 12, 7, 1.5);
  paint(ctx, lin(ctx, -6, -4, 6, 4, ['#ffd08a', '#e08a2c']), LW * 0.7);
  ctx.restore();
  // a leaf
  ctx.save();
  ctx.translate(38, 16);
  ctx.rotate(-0.5);
  ctx.beginPath();
  ctx.moveTo(-7, 0);
  ctx.quadraticCurveTo(0, -7, 7, 0);
  ctx.quadraticCurveTo(0, 7, -7, 0);
  ctx.closePath();
  paint(ctx, lin(ctx, -7, -5, 7, 5, ['#b6f59a', '#3fbf5b']), LW * 0.7);
  ctx.restore();
  ellipse(ctx, -30, 26, 3.2, 3.2);
  paint(ctx, '#a9a4ff', LW * 0.6);
}

function dump(ctx: Ctx) {
  // dust cloud being swept
  for (const [x, y, r] of [[-30, 40, 8], [-40, 34, 6.5], [-21, 45, 5.5], [-44, 44, 5]] as const) {
    ellipse(ctx, x, y, r, r);
    paint(ctx, rad(ctx, x - r * 0.4, y - r * 0.4, r * 1.6, ['#ffffff', '#e7ddcb', '#b7a68c']), LW * 0.7);
  }
  ctx.save();
  ctx.translate(6, -2);
  ctx.rotate(0.62);
  // handle
  rrect(ctx, -4.5, -56, 9, 64, 4.5);
  paint(ctx, lin(ctx, -5, 0, 5, 0, ['#f5c58c', '#cf8746', '#9b5a24']));
  // bristles
  const head = () => {
    ctx.beginPath();
    ctx.moveTo(-12, 6);
    ctx.lineTo(12, 6);
    ctx.lineTo(25, 42);
    ctx.quadraticCurveTo(0, 49, -25, 42);
    ctx.closePath();
  };
  head();
  paint(ctx, lin(ctx, -25, 6, 25, 48, ['#fff0a6', '#ffcc4d', '#e09a22']));
  ctx.save();
  head();
  ctx.clip();
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(160,90,10,0.55)';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 3.2, 14);
    ctx.lineTo(i * 6.8, 46);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.moveTo(-10, 12);
  ctx.lineTo(-6, 12);
  ctx.lineTo(-15, 40);
  ctx.lineTo(-20, 40);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  head();
  ctx.lineWidth = LW;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // binding
  rrect(ctx, -14, 1, 28, 11, 4);
  paint(ctx, lin(ctx, 0, 1, 0, 12, ['#ff8a8a', '#e53a4a', '#a81f33']));
  gloss(ctx, -6, 4, 5, 1.6, 0, 0.7);
  ctx.restore();
  twinkle(ctx, -45, 18, 6.5);
}

function discardAll(ctx: Ctx) {
  const steel = (x0: number, x1: number) => lin(ctx, x0, 0, x1, 0, ['#f4f8ff', '#b9c8de', '#7d8fae', '#5a6a8a']);
  // body
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(-29, -8);
    ctx.lineTo(29, -8);
    ctx.lineTo(23, 42);
    ctx.quadraticCurveTo(22.5, 48, 17, 48);
    ctx.lineTo(-17, 48);
    ctx.quadraticCurveTo(-22.5, 48, -23, 42);
    ctx.closePath();
  };
  body();
  paint(ctx, steel(-29, 29));
  // grooves
  ctx.lineCap = 'round';
  for (const x of [-12, 0, 12]) {
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x * 0.82, 38);
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = 'rgba(40,50,80,0.45)';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 2.6, 3);
    ctx.lineTo(x * 0.82 - 2.4, 37);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
  }
  // rim
  rrect(ctx, -32, -13, 64, 9, 3.5);
  paint(ctx, steel(-32, 32));
  // lid, popped open
  ctx.save();
  ctx.translate(-5, -27);
  ctx.rotate(-0.3);
  rrect(ctx, -9, -13, 18, 9, 3.5);
  paint(ctx, steel(-9, 9));
  rrect(ctx, -34, -6, 68, 11, 5);
  paint(ctx, steel(-34, 34));
  gloss(ctx, -18, -2, 10, 2, 0, 0.8);
  ctx.restore();
  // pop lines
  ctx.lineCap = 'round';
  for (const [x0, y0, x1, y1] of [[33, -30, 41, -36], [36, -20, 45, -21]] as const) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }, '#ffffff', 2.6);
  }
  gloss(ctx, -21, 16, 2.6, 18, -0.06, 0.55);
}

function roulette(ctx: Ctx) {
  const cy = 6;
  const R = 40;
  // rim
  ellipse(ctx, 0, cy, R + 3, R + 3);
  paint(ctx, lin(ctx, -R, cy - R, R, cy + R, ['#fff0a0', '#ffc531', '#c97a0c']));
  // segments
  const cols = [HEX.red, HEX.yellow, HEX.green, HEX.blue];
  const n = 8;
  const r = R - 5;
  for (let i = 0; i < n; i++) {
    const a0 = -Math.PI / 2 + (i * TAU) / n - Math.PI / n;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.arc(0, cy, r, a0, a0 + TAU / n);
    ctx.closePath();
    ctx.fillStyle = cols[i % 4];
    ctx.fill();
  }
  // shading: light top-left, dark bottom-right
  ellipse(ctx, 0, cy, r, r);
  ctx.fillStyle = rad(ctx, -14, cy - 14, r * 1.7, ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(0,0,0,0.3)']);
  ctx.fill();
  ctx.lineWidth = LW * 0.55;
  ctx.strokeStyle = INK;
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * TAU) / n - Math.PI / n;
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.stroke();
  }
  ellipse(ctx, 0, cy, r, r);
  ctx.lineWidth = LW * 0.8;
  ctx.stroke();
  // studs on the rim
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * TAU) / n - Math.PI / n;
    ellipse(ctx, Math.cos(a) * (R - 1), cy + Math.sin(a) * (R - 1), 2.2, 2.2);
    ctx.fillStyle = '#fffbe6';
    ctx.fill();
  }
  // gloss across the wheel
  ctx.save();
  ellipse(ctx, 0, cy, r, r);
  ctx.clip();
  gloss(ctx, -14, cy - 18, 22, 10, -0.7, 0.28);
  ctx.restore();
  // hub
  ellipse(ctx, 0, cy, 9, 9);
  paint(ctx, rad(ctx, -3, cy - 3, 12, ['#ffffff', '#e4e8f2', '#9aa3ba']), LW * 0.8);
  ellipse(ctx, 0, cy, 3, 3);
  ctx.fillStyle = INK;
  ctx.fill();
  // pointer
  ctx.beginPath();
  ctx.moveTo(-12, -47);
  ctx.quadraticCurveTo(0, -51, 12, -47);
  ctx.lineTo(2, -27);
  ctx.quadraticCurveTo(0, -24, -2, -27);
  ctx.closePath();
  ctx.lineJoin = 'round';
  paint(ctx, lin(ctx, -12, -50, 12, -26, ['#ffffff', '#e6e9f2', '#a8b0c6']));
  gloss(ctx, -4, -43, 4, 1.8, 0, 0.9);
}

const ICONS: Record<string, (ctx: Ctx) => void> = {
  '🎁': gift,
  '💣': bomb,
  '🎭': dare,
  '☔': rain,
  '🪞': mirror,
  '🌪': chaos,
  '🧹': dump,
  '🗑': discardAll,
  '🎡': roulette,
};

const key = (sym: string) => sym.replace(/️/g, '');

export const hasIcon = (sym: string) => key(sym) in ICONS;

/**
 * Draws the icon for `sym` centred at (x, y), filling a `size` × `size` box (the same footprint as the emoji
 * glyph it replaces). Returns false when there is no drawn icon for that symbol.
 */
const tiles = new Map<string, HTMLCanvasElement>();
/** the icon box is drawn with this much room around the 100-unit design box (sparks, outlines) */
const PAD = 1.25;

function iconTile(sym: string, draw: (ctx: Ctx) => void, size: number, px: number) {
  const k = `${sym}|${px}|${size < 60 ? 's' : 'l'}`;
  let tile = tiles.get(k);
  if (tile) return tile;
  tile = document.createElement('canvas');
  tile.width = tile.height = px;
  const t = tile.getContext('2d')!;
  t.translate(px / 2, px / 2);
  t.scale(px / (100 * PAD), px / (100 * PAD));
  // small icons get a heavier outline so the silhouette survives the corner index
  LW = size < 60 ? 6.5 : 5;
  t.lineJoin = 'round';
  t.lineCap = 'round';
  draw(t);
  if (tiles.size > 200) tiles.clear();
  tiles.set(k, tile);
  return tile;
}

/**
 * Draws the icon for `sym` centred at (x, y), filling a `size` × `size` box (the same footprint as the emoji
 * glyph it replaces). Returns false when there is no drawn icon for that symbol.
 * The icon is painted once at the target's real pixel size, then stamped with a faint light rim so the
 * dark outline still separates it from dark card faces.
 */
export function drawIcon(ctx: Ctx, sym: string, x: number, y: number, size: number): boolean {
  const draw = ICONS[key(sym)];
  if (!draw) return false;
  const m = ctx.getTransform();
  const scale = Math.max(Math.hypot(m.a, m.b), Math.hypot(m.c, m.d)) || 1;
  const box = size * PAD;
  const px = Math.min(2048, Math.max(16, Math.ceil(box * scale)));
  const tile = iconTile(key(sym), draw, size, px);
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.shadowColor = 'rgba(255,255,255,0.4)';
  ctx.shadowBlur = Math.max(1, size * scale * 0.035);
  ctx.drawImage(tile, x - box / 2, y - box / 2, box, box);
  ctx.restore();
  return true;
}
