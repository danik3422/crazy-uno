/**
 * Drawn icons for the random events (meteor, lightning, jackpot…), in the same style as the card icons
 * (icons.ts): bold silhouettes, a dark ink outline, soft gradients lit from the top-left and a glossy highlight.
 * Used on the 3D table (canvas) and in the HTML (banner, reference list, HUD) as a cached PNG.
 *
 * Each icon is designed in a 100 × 100 box centred on the origin.
 */
import type { EventId } from '../../game/types';
import { iconKit, stampIcon, type IconCtx as Ctx } from './icons';

const { INK, TAU, lin, rad, paint, rrect, ellipse, gloss, cased, star, twinkle, lw } = iconKit;

const UNO = { red: '#e5413a', yellow: '#f2bf16', green: '#26a556', blue: '#2c79dc' };

/** a closed wobbly blob around (x, y): a rock, a cloud puff */
function lumpy(ctx: Ctx, x: number, y: number, r: number, wob: number, seed: number, n = 11) {
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const rr = r * (1 + wob * Math.sin(a * 3 + seed) * 0.6 + wob * Math.sin(a * 5 + seed * 2.3) * 0.4);
    const px = x + Math.cos(a) * rr;
    const py = y + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function bolt(ctx: Ctx, x: number, y: number, s: number, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(s, s);
  ctx.beginPath();
  ctx.moveTo(4, -30);
  ctx.lineTo(-14, 4);
  ctx.lineTo(-1, 4);
  ctx.lineTo(-8, 30);
  ctx.lineTo(16, -6);
  ctx.lineTo(3, -6);
  ctx.lineTo(12, -30);
  ctx.closePath();
  ctx.restore();
  paint(ctx, lin(ctx, x - 10 * s, y - 30 * s, x + 10 * s, y + 30 * s, ['#fffbd0', '#ffe14a', '#ffa21a']));
}

// ─── icons ────────────────────────────────────────────────────────────────

function meteor(ctx: Ctx) {
  const cx = -12;
  const cy = 14;
  const R = 25;
  // flame tail toward the top right
  const d = [Math.SQRT1_2, -Math.SQRT1_2];
  const n = [Math.SQRT1_2, Math.SQRT1_2];
  const P = (along: number, side: number) => [cx + d[0] * along + n[0] * side, cy + d[1] * along + n[1] * side] as const;
  const flame = (w: number, len: number) => {
    ctx.beginPath();
    let p = P(0, w);
    ctx.moveTo(p[0], p[1]);
    // wavy outer edge with three tongues
    const tongues = [[0.35, 0.95], [0.62, 0.62], [1, 0]] as const;
    let prevA = 0;
    let prevW = w;
    for (const [a, k] of tongues) {
      const c = P((prevA + (a - prevA) * 0.5) * len, prevW * 1.12);
      p = P(a * len, w * k);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      prevA = a;
      prevW = w * k;
    }
    const back = [[0.66, -0.55], [0.38, -0.9], [0, -1]] as const;
    prevA = 1;
    prevW = 0;
    for (const [a, k] of back) {
      const c = P((prevA + (a - prevA) * 0.5) * len, w * k * 1.15);
      p = P(a * len, w * k);
      ctx.quadraticCurveTo(c[0], c[1], p[0], p[1]);
      prevA = a;
    }
    ctx.closePath();
  };
  flame(R * 1.08, 82);
  const [tx, ty] = P(80, 0);
  paint(ctx, lin(ctx, cx, cy, tx, ty, ['#fff4b0', '#ffc23a', '#ff6a1f', '#e8361e']));
  flame(R * 0.62, 56);
  ctx.fillStyle = lin(ctx, cx, cy, cx + 40, cy - 40, ['rgba(255,255,230,0.95)', 'rgba(255,230,120,0.6)', 'rgba(255,200,80,0)']);
  ctx.fill();
  // rock
  lumpy(ctx, cx, cy, R, 0.12, 1.3);
  paint(ctx, rad(ctx, cx - 10, cy - 10, R * 1.7, ['#c49a76', '#7d5640', '#3f2a22']));
  // hot rim on the side facing the flight
  ctx.save();
  lumpy(ctx, cx, cy, R, 0.12, 1.3);
  ctx.clip();
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(255,140,40,0.85)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI * 0.85, Math.PI * 0.15);
  ctx.stroke();
  ctx.restore();
  // craters
  for (const [x, y, r] of [[-20, 20, 6], [-4, 24, 4], [-6, 6, 4.5]] as const) {
    ellipse(ctx, x, y, r, r * 0.8, 0.4);
    ctx.fillStyle = 'rgba(40,20,14,0.55)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, r, Math.PI * 0.1, Math.PI * 0.9);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(255,220,180,0.45)';
    ctx.stroke();
  }
  gloss(ctx, cx - 11, cy - 10, 7, 4, -0.7, 0.55);
  twinkle(ctx, 34, 26, 7);
  twinkle(ctx, -36, -28, 5);
}

function recolor(ctx: Ctx) {
  // palette with a thumb hole
  ctx.save();
  ctx.translate(-4, 6);
  ctx.rotate(-0.18);
  ctx.beginPath();
  ctx.ellipse(0, 0, 44, 33, 0, 0, TAU);
  ctx.moveTo(-17 + 7, 15);
  ctx.arc(-17, 15, 7, 0, TAU, true);
  ctx.fillStyle = lin(ctx, -40, -30, 40, 30, ['#ffe6b8', '#eab36c', '#c27c38']);
  ctx.fill('evenodd');
  ctx.lineWidth = lw();
  ctx.strokeStyle = INK;
  ctx.stroke();
  // blobs of paint
  const blobs = [[-24, -8, UNO.red], [-4, -20, UNO.yellow], [19, -15, UNO.green], [28, 6, UNO.blue]] as const;
  for (const [x, y, c] of blobs) {
    lumpy(ctx, x, y, 9, 0.1, x);
    paint(ctx, rad(ctx, x - 3, y - 3, 13, ['#ffffff', c, c]), lw() * 0.8);
    gloss(ctx, x - 3, y - 3, 3, 2, -0.6, 0.8);
  }
  ctx.restore();
  // brush across the palette
  ctx.save();
  ctx.translate(18, 18);
  ctx.rotate(-0.75);
  rrect(ctx, -5, 2, 10, 40, 5);
  paint(ctx, lin(ctx, -5, 0, 5, 0, ['#e08a4a', '#b8582a', '#7a3416']));
  rrect(ctx, -6.5, -8, 13, 12, 2);
  paint(ctx, lin(ctx, -6, 0, 6, 0, ['#f2f4fa', '#a9b0c4', '#6b7290']));
  ctx.beginPath();
  ctx.moveTo(-6.5, -8);
  ctx.quadraticCurveTo(-7, -22, 0, -32);
  ctx.quadraticCurveTo(7, -22, 6.5, -8);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, -32, 0, -8, [UNO.blue, UNO.green, UNO.yellow, UNO.red]));
  ctx.restore();
  twinkle(ctx, -38, -30, 6);
}

function monoCard(ctx: Ctx, rot: number, fill: CanvasGradient | string) {
  // fanned from a pivot below the cards
  ctx.save();
  ctx.translate(0, 44);
  ctx.rotate(rot);
  ctx.translate(0, -40);
  rrect(ctx, -16, -24, 32, 48, 6);
  paint(ctx, fill);
  rrect(ctx, -11, -19, 22, 38, 4);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.stroke();
  ellipse(ctx, 0, 0, 8.5, 14, 0.5);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fill();
  ctx.restore();
}

function mono(ctx: Ctx) {
  const red = lin(ctx, -30, -30, 30, 40, ['#ff8a7a', UNO.red, '#a92320']);
  monoCard(ctx, -0.5, red);
  monoCard(ctx, 0, red);
  monoCard(ctx, 0.5, red);
  // a drop of the same paint above, dripping onto them
  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.bezierCurveTo(5, -42, 11, -36, 11, -30);
  ctx.arc(0, -30, 11, 0, Math.PI);
  ctx.bezierCurveTo(-11, -36, -5, -42, 0, -50);
  ctx.closePath();
  paint(ctx, lin(ctx, -11, -50, 11, -19, ['#ffb0a4', UNO.red, '#b62a24']));
  gloss(ctx, -4, -30, 2.5, 4.5, 0.3, 0.8);
  twinkle(ctx, 36, -30, 6);
  twinkle(ctx, -36, -34, 4.5);
}

function carousel(ctx: Ctx) {
  // poles
  for (const x of [-26, 0, 26]) {
    rrect(ctx, x - 3, -8, 6, 40, 3);
    paint(ctx, lin(ctx, x - 3, 0, x + 3, 0, ['#fff2b0', '#f2bf16', '#b07c06']), lw() * 0.8);
  }
  // little horses on the poles (simple saddles)
  for (const [x, y, c] of [[-26, 14, UNO.blue], [0, 6, UNO.red], [26, 16, UNO.green]] as const) {
    rrect(ctx, x - 9, y - 4, 18, 9, 4);
    paint(ctx, c, lw() * 0.8);
  }
  // platform
  ellipse(ctx, 0, 34, 44, 10);
  paint(ctx, lin(ctx, 0, 24, 0, 44, ['#ffe08a', '#e0a020', '#9a6a08']));
  // canopy: a striped cone with a scalloped valance
  const top = -44;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(46, -12);
  for (let i = 0; i < 6; i++) {
    const x0 = 46 - i * (92 / 6);
    ctx.quadraticCurveTo(x0 - 92 / 12, 0, x0 - 92 / 6, -12);
  }
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.clip();
  for (let i = -3; i < 3; i++) {
    if (i % 2 === 0) continue;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(i * 16, 2);
    ctx.lineTo((i + 1) * 16, 2);
    ctx.closePath();
    ctx.fillStyle = UNO.red;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(48, -12);
  ctx.lineTo(-48, -12);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, -40, top, 40, 0, ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)', 'rgba(60,0,20,0.25)']);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(0, top);
  ctx.lineTo(46, -12);
  for (let i = 0; i < 6; i++) {
    const x0 = 46 - i * (92 / 6);
    ctx.quadraticCurveTo(x0 - 92 / 12, 0, x0 - 92 / 6, -12);
  }
  ctx.closePath();
  ctx.lineWidth = lw();
  ctx.strokeStyle = INK;
  ctx.stroke();
  // flag
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, top - 10);
  }, '#f2d39b', 2.5);
  ctx.beginPath();
  ctx.moveTo(1, top - 12);
  ctx.lineTo(15, top - 8);
  ctx.lineTo(1, top - 4);
  ctx.closePath();
  paint(ctx, UNO.yellow, lw() * 0.7);
  gloss(ctx, -14, -24, 7, 2.5, -0.55, 0.6);
}

function robin(ctx: Ctx) {
  // the arrow behind the hat
  ctx.save();
  ctx.translate(2, 2);
  ctx.rotate(-0.62);
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(42, 0);
  }, '#d9a066', 4);
  ctx.beginPath();
  ctx.moveTo(56, 0);
  ctx.lineTo(40, -8);
  ctx.lineTo(43, 0);
  ctx.lineTo(40, 8);
  ctx.closePath();
  paint(ctx, lin(ctx, 40, -8, 56, 8, ['#f2f4fa', '#9aa2ba', '#5c637c']), lw() * 0.8);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-50, 0);
    ctx.lineTo(-42, s * 11);
    ctx.lineTo(-30, s * 11);
    ctx.lineTo(-36, 0);
    ctx.closePath();
    paint(ctx, UNO.red, lw() * 0.7);
  }
  ctx.restore();
  // hat crown, the peak tipped back
  ctx.beginPath();
  ctx.moveTo(-36, 14);
  ctx.bezierCurveTo(-34, -14, -4, -34, 36, -30);
  ctx.bezierCurveTo(28, -20, 30, -2, 36, 12);
  ctx.bezierCurveTo(10, 20, -14, 20, -36, 14);
  ctx.closePath();
  paint(ctx, lin(ctx, -30, -30, 30, 20, ['#8fe07a', '#3fa63a', '#1d6a26']));
  // brim, turned up
  ctx.beginPath();
  ctx.moveTo(-44, 10);
  ctx.bezierCurveTo(-20, 22, 20, 22, 46, 4);
  ctx.bezierCurveTo(44, 16, 36, 26, 24, 28);
  ctx.bezierCurveTo(0, 32, -30, 28, -44, 10);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 6, 0, 30, ['#6cc85a', '#2f8a2e', '#185a20']));
  // feather
  ctx.save();
  ctx.translate(-24, 8);
  ctx.rotate(-0.75);
  ellipse(ctx, 0, -20, 8, 24);
  paint(ctx, lin(ctx, -8, -40, 8, 0, ['#ff8a7a', '#e5413a', '#a92320']), lw() * 0.8);
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.quadraticCurveTo(2, -20, 0, -42);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(80,10,10,0.7)';
  ctx.stroke();
  ctx.restore();
  // band
  ctx.beginPath();
  ctx.moveTo(-35, 8);
  ctx.bezierCurveTo(-12, 15, 14, 14, 35, 5);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#7a4a1e';
  ctx.stroke();
  gloss(ctx, -18, -10, 9, 3.5, -0.6, 0.5);
}

function upside(ctx: Ctx) {
  // a smiley turned over
  ellipse(ctx, 0, 2, 38, 38);
  paint(ctx, rad(ctx, -12, -10, 56, ['#fff6a8', '#ffd23a', '#e89a0c']));
  ctx.save();
  ctx.translate(0, 2);
  ctx.rotate(Math.PI);
  // eyes (now at the bottom)
  for (const x of [-12, 12]) {
    ellipse(ctx, x, -9, 4.5, 7);
    ctx.fillStyle = INK;
    ctx.fill();
    ellipse(ctx, x - 1.2, -11.5, 1.6, 2.2);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  // big smile (now on top)
  ctx.beginPath();
  ctx.moveTo(-21, 5);
  ctx.quadraticCurveTo(0, 38, 21, 5);
  ctx.quadraticCurveTo(0, 9, -21, 5);
  ctx.closePath();
  paint(ctx, '#7a1e2c', lw() * 0.8);
  ctx.save();
  ctx.clip();
  ellipse(ctx, 0, 24, 10, 6);
  ctx.fillStyle = '#ff7a8a';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-18, 3, 36, 5);
  ctx.restore();
  ctx.restore();
  // a turning arrow around it
  cased(ctx, () => {
    ctx.beginPath();
    ctx.arc(0, 2, 47, -Math.PI * 0.95, -Math.PI * 0.35);
  }, '#ffffff', 5);
  const a = -Math.PI * 0.35;
  const hx = Math.cos(a) * 47;
  const hy = 2 + Math.sin(a) * 47;
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(a + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-6, -9);
  ctx.lineTo(-6, 9);
  ctx.closePath();
  paint(ctx, '#ffffff', lw() * 0.8);
  ctx.restore();
  gloss(ctx, -16, -16, 9, 5, -0.7, 0.55);
}

function blind(ctx: Ctx) {
  // temples
  for (const s of [-1, 1]) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(s * 40, -8);
      ctx.lineTo(s * 47, -16);
    }, '#3a3f55', 4);
  }
  // frame + lenses
  const lens = (s: number) => {
    ctx.beginPath();
    ctx.moveTo(s * 4, -12);
    ctx.lineTo(s * 44, -12);
    ctx.quadraticCurveTo(s * 46, 8, s * 36, 18);
    ctx.quadraticCurveTo(s * 20, 26, s * 8, 14);
    ctx.quadraticCurveTo(s * 3, 6, s * 4, -12);
    ctx.closePath();
  };
  for (const s of [-1, 1]) {
    lens(s);
    paint(ctx, lin(ctx, s * 4, -12, s * 40, 22, ['#5a6290', '#262a44', '#0e0f1c']), lw() * 1.2);
    // reflections
    ctx.save();
    lens(s);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(s * 10, -12);
    ctx.lineTo(s * 22, -12);
    ctx.lineTo(s * 12, 20);
    ctx.lineTo(s * 0, 20);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fill();
    ctx.restore();
    gloss(ctx, s * 32, -4, 4, 2.5, 0, 0.7);
  }
  // bridge
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-5, -10);
    ctx.quadraticCurveTo(0, -15, 5, -10);
  }, '#3a3f55', 4);
  // a question mark over them: you can't see your cards
  ctx.font = '900 30px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = lw() * 1.4;
  ctx.strokeStyle = INK;
  ctx.strokeText('?', 0, -36);
  ctx.fillStyle = '#ffd23a';
  ctx.fillText('?', 0, -36);
}

function blitz(ctx: Ctx) {
  // speed lines
  for (const [y, l] of [[-10, 18], [4, 24], [18, 14]] as const) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(-48, y);
      ctx.lineTo(-48 + l, y);
    }, '#ffffff', 3);
  }
  // crown and side buttons
  rrect(ctx, -6, -46, 12, 10, 3);
  paint(ctx, lin(ctx, -6, 0, 6, 0, ['#f2f4fa', '#a9b0c4', '#6b7290']));
  ctx.save();
  ctx.translate(26, -30);
  ctx.rotate(0.75);
  rrect(ctx, -4, -6, 8, 10, 2);
  paint(ctx, lin(ctx, -4, 0, 4, 0, ['#f2f4fa', '#a9b0c4', '#6b7290']));
  ctx.restore();
  // body
  ellipse(ctx, 4, 2, 36, 36);
  paint(ctx, lin(ctx, -30, -34, 30, 38, ['#ff8a7a', UNO.red, '#a92320']));
  ellipse(ctx, 4, 2, 28, 28);
  paint(ctx, rad(ctx, -6, -8, 40, ['#ffffff', '#f2f0ea', '#cfcbc0']), lw() * 0.8);
  // ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    const r0 = i % 3 ? 23 : 20;
    ctx.beginPath();
    ctx.moveTo(4 + Math.cos(a) * r0, 2 + Math.sin(a) * r0);
    ctx.lineTo(4 + Math.cos(a) * 26, 2 + Math.sin(a) * 26);
    ctx.lineWidth = i % 3 ? 1.6 : 3;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // a red wedge: the time running out
  ctx.beginPath();
  ctx.moveTo(4, 2);
  ctx.arc(4, 2, 19, -Math.PI / 2, -Math.PI / 2 + 0.9);
  ctx.closePath();
  ctx.fillStyle = 'rgba(229,65,58,0.4)';
  ctx.fill();
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(4, 2);
    ctx.lineTo(4 + Math.cos(-Math.PI / 2 + 0.9) * 19, 2 + Math.sin(-Math.PI / 2 + 0.9) * 19);
  }, UNO.red, 2.5);
  ellipse(ctx, 4, 2, 3.5, 3.5);
  ctx.fillStyle = INK;
  ctx.fill();
  gloss(ctx, -12, -14, 8, 4, -0.7, 0.6);
  bolt(ctx, 32, 28, 0.62, 0.15);
}

function cloudPath(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(-36, 6);
  ctx.bezierCurveTo(-50, 4, -48, -18, -32, -18);
  ctx.bezierCurveTo(-30, -36, -6, -42, 2, -28);
  ctx.bezierCurveTo(12, -44, 40, -36, 36, -16);
  ctx.bezierCurveTo(52, -14, 52, 8, 36, 8);
  ctx.closePath();
}

function lightning(ctx: Ctx) {
  // the bolt below the cloud
  ctx.save();
  ctx.translate(2, 18);
  ctx.beginPath();
  ctx.moveTo(-2, -20);
  ctx.lineTo(-18, 12);
  ctx.lineTo(-4, 12);
  ctx.lineTo(-14, 40);
  ctx.lineTo(16, 0);
  ctx.lineTo(2, 0);
  ctx.lineTo(12, -20);
  ctx.closePath();
  ctx.restore();
  paint(ctx, lin(ctx, -10, 0, 10, 58, ['#fffbd0', '#ffe14a', '#ffa21a']));
  // cloud
  cloudPath(ctx);
  paint(ctx, lin(ctx, 0, -42, 0, 8, ['#d9e1f5', '#8a95b8', '#4c5578']));
  ctx.save();
  cloudPath(ctx);
  ctx.clip();
  ellipse(ctx, 0, 10, 50, 10);
  ctx.fillStyle = 'rgba(30,34,60,0.35)';
  ctx.fill();
  ctx.restore();
  gloss(ctx, -12, -26, 10, 4, -0.4, 0.6);
  // rain
  for (const [x, y] of [[-34, 22], [30, 20], [24, 36]] as const) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + 8);
    }, '#7fd0ff', 3);
  }
}

function jackpot(ctx: Ctx) {
  // a gold coin behind
  ellipse(ctx, 18, 18, 24, 24);
  paint(ctx, rad(ctx, 10, 10, 34, ['#fff4b0', '#ffcc33', '#c98a00']));
  ellipse(ctx, 18, 18, 17, 17);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = 'rgba(150,90,0,0.6)';
  ctx.stroke();
  star(ctx, 18, 18, 9, 4, 5);
  ctx.fillStyle = 'rgba(160,100,0,0.55)';
  ctx.fill();
  // four-leaf clover
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.quadraticCurveTo(-12, 26, -28, 42);
  }, '#3fa63a', 4.5);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(-10, -4);
    ctx.rotate(i * (Math.PI / 2) + Math.PI / 4);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-20, -6, -18, -30, -5, -28);
    ctx.bezierCurveTo(-2, -28, 0, -25, 0, -22);
    ctx.bezierCurveTo(0, -25, 2, -28, 5, -28);
    ctx.bezierCurveTo(18, -30, 20, -6, 0, 0);
    ctx.closePath();
    paint(ctx, lin(ctx, 0, -30, 0, 0, ['#9ff08a', '#43b23a', '#1f7a26']));
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.lineTo(0, -18);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(20,80,20,0.55)';
    ctx.stroke();
    ctx.restore();
  }
  gloss(ctx, -26, -18, 5, 3, -0.7, 0.6);
  twinkle(ctx, 36, -30, 8);
  twinkle(ctx, -40, 26, 5);
}

function group(ctx: Ctx) {
  // sound waves
  for (const s of [-1, 1]) {
    for (const r of [34, 46]) {
      cased(ctx, () => {
        ctx.beginPath();
        if (s > 0) ctx.arc(0, -16, r, -0.5, 0.5);
        else ctx.arc(0, -16, r, Math.PI - 0.5, Math.PI + 0.5);
      }, '#ffffff', 3.5);
    }
  }
  // handle
  ctx.beginPath();
  ctx.moveTo(-11, 6);
  ctx.lineTo(11, 6);
  ctx.lineTo(6, 46);
  ctx.quadraticCurveTo(0, 50, -6, 46);
  ctx.closePath();
  paint(ctx, lin(ctx, -11, 0, 11, 0, ['#5a6290', '#262a44', '#0e0f1c']));
  rrect(ctx, -13, 2, 26, 9, 3);
  paint(ctx, lin(ctx, -13, 0, 13, 0, ['#fff2b0', '#f2bf16', '#b07c06']));
  // grille
  ellipse(ctx, 0, -16, 20, 20);
  paint(ctx, rad(ctx, -7, -24, 30, ['#ffffff', '#c3c9da', '#6b7290']));
  ctx.save();
  ellipse(ctx, 0, -16, 20, 20);
  ctx.clip();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = 'rgba(40,40,70,0.45)';
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(-22, -16 + i * 6);
    ctx.lineTo(22, -16 + i * 6);
    ctx.moveTo(i * 6, -38);
    ctx.lineTo(i * 6, 6);
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, 0, -16, 20, 20);
  ctx.lineWidth = lw();
  ctx.strokeStyle = INK;
  ctx.stroke();
  gloss(ctx, -8, -25, 6, 3.5, -0.7, 0.8);
}

function coin(ctx: Ctx) {
  // edge (thickness) then the face, tilted a little
  ctx.save();
  ctx.rotate(-0.22);
  ellipse(ctx, 0, 6, 40, 36);
  paint(ctx, lin(ctx, 0, -30, 0, 42, ['#e8a812', '#b07806', '#7a5204']));
  ellipse(ctx, 0, 0, 40, 36);
  paint(ctx, rad(ctx, -14, -14, 60, ['#fff6c0', '#ffd23a', '#d99a0a']));
  ellipse(ctx, 0, 0, 31, 28);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(150,90,0,0.55)';
  ctx.stroke();
  // embossed star
  star(ctx, 1.5, 2, 18, 8, 5);
  ctx.fillStyle = 'rgba(150,90,0,0.45)';
  ctx.fill();
  star(ctx, 0, 0, 18, 8, 5);
  ctx.fillStyle = lin(ctx, -18, -18, 18, 18, ['#fffbe0', '#ffe170', '#f0b020']);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(150,90,0,0.6)';
  ctx.stroke();
  gloss(ctx, -18, -16, 10, 5, -0.7, 0.6);
  ctx.restore();
  twinkle(ctx, 36, -32, 8);
  twinkle(ctx, -40, 30, 5);
}

function bomber(ctx: Ctx) {
  // little bomb dropping below
  ctx.save();
  ctx.translate(6, 34);
  ctx.rotate(0.35);
  ellipse(ctx, 0, 0, 7, 11);
  paint(ctx, rad(ctx, -3, -4, 14, ['#8c94b8', '#4a5072', '#22243a']), lw() * 0.8);
  ctx.beginPath();
  ctx.moveTo(-6, -9);
  ctx.lineTo(6, -9);
  ctx.lineTo(0, -16);
  ctx.closePath();
  paint(ctx, UNO.red, lw() * 0.6);
  ctx.restore();
  for (const [x, y] of [[-2, 20], [-8, 12]] as const) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y - 6);
    }, '#ffffff', 2.5);
  }
  // tail fin
  ctx.beginPath();
  ctx.moveTo(-34, -6);
  ctx.lineTo(-46, -28);
  ctx.lineTo(-36, -28);
  ctx.lineTo(-22, -10);
  ctx.closePath();
  paint(ctx, lin(ctx, -46, -28, -22, -6, ['#ff8a7a', UNO.red, '#a92320']));
  // back wing
  ctx.beginPath();
  ctx.moveTo(-2, -6);
  ctx.lineTo(10, -24);
  ctx.lineTo(20, -24);
  ctx.lineTo(14, -6);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, -24, 0, -6, ['#ffe170', UNO.yellow, '#b88a06']));
  // fuselage
  ctx.beginPath();
  ctx.moveTo(-44, -10);
  ctx.bezierCurveTo(-20, -16, 20, -18, 34, -10);
  ctx.bezierCurveTo(42, -6, 42, 6, 34, 9);
  ctx.bezierCurveTo(16, 14, -20, 8, -44, -2);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, -18, 0, 12, ['#ff9a8a', UNO.red, '#9a1e1a']));
  // stripe
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-44, -10);
  ctx.bezierCurveTo(-20, -16, 20, -18, 34, -10);
  ctx.bezierCurveTo(42, -6, 42, 6, 34, 9);
  ctx.bezierCurveTo(16, 14, -20, 8, -44, -2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.fillRect(-14, -15, 7, 26);
  ctx.restore();
  // cockpit
  ctx.beginPath();
  ctx.moveTo(6, -14);
  ctx.quadraticCurveTo(12, -28, 24, -13);
  ctx.closePath();
  paint(ctx, lin(ctx, 6, -26, 24, -13, ['#e8f8ff', '#7fd0ff', '#2a7fd4']), lw() * 0.8);
  // front wing
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(16, 2);
  ctx.lineTo(6, 22);
  ctx.lineTo(-6, 22);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 2, 0, 22, ['#ffe170', UNO.yellow, '#b88a06']));
  // propeller blur
  ellipse(ctx, 42, 0, 4, 20);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fill();
  ctx.lineWidth = lw() * 0.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ellipse(ctx, 40, 0, 4, 4);
  paint(ctx, '#f2bf16', lw() * 0.7);
  gloss(ctx, -12, -11, 12, 2.5, -0.06, 0.6);
}

const DRAW: Record<EventId, (ctx: Ctx) => void> = {
  meteor, recolor, mono, carousel, robin, upside, blind, blitz, lightning, jackpot, group, coin, bomber,
};

export const EVENT_IDS = Object.keys(DRAW) as EventId[];
export const isEventId = (x: unknown): x is EventId => typeof x === 'string' && x in DRAW;

/** Draws an event's icon centred at (x, y) in a `size` box (like drawIcon for the cards). */
export function drawEventIcon(ctx: Ctx, id: EventId, x: number, y: number, size: number) {
  stampIcon(ctx, `ev:${id}`, DRAW[id], x, y, size);
}

const urls = new Map<string, string>();

/** The icon as a PNG data URL (for <img>), drawn once per size. `px` is the image's full side in pixels. */
export function eventIconUrl(id: EventId, px = 128): string {
  const k = `${id}|${px}`;
  let u = urls.get(k);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    // the icon box plus its margin (sparks, outlines) fills the image
    drawEventIcon(cv.getContext('2d')!, id, px / 2, px / 2, px / 1.25);
    u = cv.toDataURL('image/png');
    urls.set(k, u);
  }
  return u;
}

// ─── extra shapes for the 3D event effects (same style) ─────────────────────

function pumpkin(ctx: Ctx) {
  // stem
  ctx.beginPath();
  ctx.moveTo(-5, -30);
  ctx.quadraticCurveTo(-4, -44, 8, -48);
  ctx.lineTo(10, -42);
  ctx.quadraticCurveTo(3, -38, 5, -30);
  ctx.closePath();
  paint(ctx, lin(ctx, -5, -48, 10, -30, ['#8fd86a', '#3f8a2a', '#1f5a1a']));
  // ribs, back to front
  const ribs = [[-24, 22], [24, 22], [-11, 26], [11, 26], [0, 22]] as const;
  for (const [x, rx] of ribs) {
    ellipse(ctx, x, 4, rx, 34);
    paint(ctx, rad(ctx, x - 8, -10, 46, ['#ffc46a', '#ff8a1a', '#c2500a']));
  }
  // carved face, glowing
  const glow = rad(ctx, 0, 6, 30, ['#fffbd0', '#ffe14a', '#ff9a1a']);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 6, -6);
    ctx.lineTo(s * 20, -10);
    ctx.lineTo(s * 14, 2);
    ctx.closePath();
    paint(ctx, glow, lw() * 0.7);
  }
  ctx.beginPath();
  ctx.moveTo(-22, 12);
  ctx.quadraticCurveTo(0, 34, 22, 12);
  ctx.lineTo(14, 14);
  ctx.lineTo(10, 20);
  ctx.lineTo(4, 15);
  ctx.lineTo(-4, 15);
  ctx.lineTo(-10, 20);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  paint(ctx, glow, lw() * 0.7);
  gloss(ctx, -16, -14, 6, 9, 0.4, 0.45);
}

function dart(ctx: Ctx) {
  // an arrow flying to the right
  cased(ctx, () => {
    ctx.beginPath();
    ctx.moveTo(-44, 0);
    ctx.lineTo(30, 0);
  }, '#d9a066', 6);
  ctx.beginPath();
  ctx.moveTo(48, 0);
  ctx.lineTo(26, -12);
  ctx.lineTo(30, 0);
  ctx.lineTo(26, 12);
  ctx.closePath();
  paint(ctx, lin(ctx, 26, -12, 48, 12, ['#f2f4fa', '#9aa2ba', '#5c637c']));
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-46, 0);
    ctx.lineTo(-38, s * 14);
    ctx.lineTo(-24, s * 14);
    ctx.lineTo(-30, 0);
    ctx.closePath();
    paint(ctx, lin(ctx, -46, 0, -24, 0, ['#9ff08a', '#43b23a', '#1f7a26']));
  }
}

const SHAPES = { pumpkin, dart };

/** A drawn shape used only by the 3D event effects (flaming pumpkin, Robin Hood's arrow). */
export function drawFxShape(ctx: Ctx, id: keyof typeof SHAPES, x: number, y: number, size: number) {
  stampIcon(ctx, `fx:${id}`, SHAPES[id], x, y, size);
}
