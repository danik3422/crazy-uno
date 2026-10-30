/**
 * Small drawn icons for the menus (in place of emoji): same style as the card icons and avatars.
 * Each is drawn in a 100 × 100 box and cached as an image per pixel size.
 */
import { drawIcon } from '../three/themes/icons';
import { circle, type Ctx, ellipse, fillOnly, gloss, INK, lin, line, lite, paint, rad, rrect, setLineWidth, shade, star } from './kit';

export type UiIconName = 'events' | 'themes' | 'players' | 'robot' | 'person' | 'phone' | 'crown' | 'trophy';

const gold = (ctx: Ctx, y0: number, y1: number) => lin(ctx, 0, y0, 0, y1, ['#fff3a6', '#ffd23a', '#f0a018', '#c87a0a']);

function personBust(ctx: Ctx, x: number, y: number, s: number, skin: string, hair: string, shirt: string) {
  ctx.beginPath();
  ctx.moveTo(x - 24 * s, y + 46 * s);
  ctx.bezierCurveTo(x - 24 * s, y + 24 * s, x - 12 * s, y + 18 * s, x, y + 18 * s);
  ctx.bezierCurveTo(x + 12 * s, y + 18 * s, x + 24 * s, y + 24 * s, x + 24 * s, y + 46 * s);
  ctx.closePath();
  paint(ctx, shade(ctx, shirt, x - 24 * s, y + 18 * s, x + 24 * s, y + 46 * s));
  circle(ctx, x, y, 15 * s);
  paint(ctx, shade(ctx, skin, x - 15 * s, y - 15 * s, x + 15 * s, y + 15 * s));
  ctx.beginPath();
  ctx.moveTo(x - 15.4 * s, y + 1 * s);
  ctx.bezierCurveTo(x - 17 * s, y - 16 * s, x + 17 * s, y - 16 * s, x + 15.4 * s, y + 1 * s);
  ctx.quadraticCurveTo(x + 6 * s, y - 8 * s, x - 15.4 * s, y + 1 * s);
  ctx.closePath();
  paint(ctx, shade(ctx, hair, x - 16 * s, y - 16 * s, x + 16 * s, y));
  ctx.fillStyle = INK;
  for (const d of [-5.4, 5.4]) {
    ellipse(ctx, x + d * s, y + 3 * s, 1.8 * s, 2.4 * s);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y + 5 * s, 5 * s, Math.PI * 0.2, Math.PI * 0.8);
  line(ctx, 2.6 * s);
}

const ICONS: Record<UiIconName, (ctx: Ctx) => void> = {
  events: ctx => {
    drawIcon(ctx, '🌪', 50, 50, 96);
  },
  themes: ctx => {
    // a painter's palette with the four card colours
    ctx.beginPath();
    ctx.moveTo(50, 12);
    ctx.bezierCurveTo(80, 12, 94, 32, 92, 52);
    ctx.bezierCurveTo(90, 70, 76, 74, 66, 70);
    ctx.bezierCurveTo(56, 66, 54, 78, 58, 84);
    ctx.bezierCurveTo(62, 92, 44, 92, 30, 86);
    ctx.bezierCurveTo(12, 78, 6, 58, 10, 42);
    ctx.bezierCurveTo(14, 24, 30, 12, 50, 12);
    ctx.closePath();
    paint(ctx, shade(ctx, '#f2c48a', 8, 12, 92, 90));
    ellipse(ctx, 68, 56, 6, 5);
    paint(ctx, lin(ctx, 0, 50, 0, 62, ['#8a5a2a', '#c99a5a']));
    for (const [x, y, c] of [[30, 34, '#ff4a4a'], [50, 26, '#ffd23f'], [72, 34, '#3fd06b'], [26, 58, '#3aa0ff']] as const) {
      ellipse(ctx, x, y, 8.6, 7.6);
      paint(ctx, rad(ctx, x, y, 9, [lite(c, 0.45), c], x - 3, y - 3));
      gloss(ctx, x - 3, y - 2.6, 2.6, 1.6, -0.5, 0.75);
    }
    gloss(ctx, 40, 18, 10, 2.6, -0.2, 0.45);
  },
  players: ctx => {
    personBust(ctx, 66, 34, 0.9, '#c98a5c', '#2a1a12', '#3aa0ff');
    personBust(ctx, 38, 44, 1.05, '#f8cfae', '#e0702a', '#ff5a6a');
  },
  robot: ctx => {
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(50, 22);
    ctx.lineTo(50, 10);
    line(ctx, 10);
    ctx.beginPath();
    ctx.moveTo(50, 22);
    ctx.lineTo(50, 10);
    line(ctx, 4, '#8a96b0');
    circle(ctx, 50, 9, 7);
    paint(ctx, rad(ctx, 50, 9, 8, ['#ffffff', '#ff5a6a'], 47, 6));
    for (const s of [-1, 1]) {
      rrect(ctx, 50 + s * 40 - 5, 42, 10, 22, 4);
      paint(ctx, lin(ctx, 0, 42, 0, 64, ['#8a96b0', '#4a5470']));
    }
    rrect(ctx, 14, 22, 72, 62, 18);
    paint(ctx, shade(ctx, '#7f8fe8', 14, 22, 86, 84));
    rrect(ctx, 24, 34, 52, 36, 12);
    paint(ctx, lin(ctx, 0, 34, 0, 70, ['#2a2c50', '#141428']));
    for (const x of [38, 62]) {
      circle(ctx, x, 48, 10);
      fillOnly(ctx, rad(ctx, x, 48, 10, ['rgba(255,224,102,0.6)', 'rgba(255,224,102,0)']));
      circle(ctx, x, 48, 6);
      fillOnly(ctx, rad(ctx, x, 48, 6, ['#ffffff', '#ffe066', '#ffcf2e']));
    }
    ctx.beginPath();
    ctx.arc(50, 52, 9, Math.PI * 0.25, Math.PI * 0.75);
    line(ctx, 4, '#ffe066');
    gloss(ctx, 30, 28, 10, 3, -0.2, 0.45);
  },
  person: ctx => {
    personBust(ctx, 50, 38, 1.35, '#f8cfae', '#6b3a1a', '#ff9a1a');
  },
  phone: ctx => {
    ctx.save();
    ctx.translate(50, 50);
    ctx.rotate(-0.16);
    rrect(ctx, -26, -44, 52, 88, 12);
    paint(ctx, lin(ctx, -26, -44, 26, 44, ['#4a4466', '#22182e']));
    rrect(ctx, -20, -34, 40, 66, 5);
    fillOnly(ctx, lin(ctx, 0, -34, 0, 32, ['#5ad0ff', '#3a6cf0', '#7a3cff']));
    // a little card on the screen
    ctx.save();
    ctx.rotate(0.2);
    rrect(ctx, -10, -16, 20, 30, 4);
    paint(ctx, '#ffffff', 2.6);
    rrect(ctx, -7, -13, 14, 24, 3);
    fillOnly(ctx, '#ff4a4a');
    ellipse(ctx, 0, -1, 5, 9, 0.5);
    fillOnly(ctx, '#ffffff');
    ctx.restore();
    rrect(ctx, -8, 36, 16, 3.4, 1.7);
    fillOnly(ctx, 'rgba(255,255,255,0.6)');
    gloss(ctx, -12, -24, 3, 10, 0.1, 0.35);
    ctx.restore();
  },
  crown: ctx => {
    ctx.beginPath();
    ctx.moveTo(14, 74);
    ctx.lineTo(10, 30);
    ctx.lineTo(32, 50);
    ctx.lineTo(50, 20);
    ctx.lineTo(68, 50);
    ctx.lineTo(90, 30);
    ctx.lineTo(86, 74);
    ctx.closePath();
    ctx.lineJoin = 'round';
    paint(ctx, gold(ctx, 20, 74));
    rrect(ctx, 12, 70, 76, 14, 5);
    paint(ctx, gold(ctx, 66, 84));
    for (const [x, y] of [[10, 28], [50, 17], [90, 28]]) {
      circle(ctx, x, y, 6);
      paint(ctx, rad(ctx, x, y, 6, ['#ffffff', '#ffd23a'], x - 2, y - 2));
    }
    for (const [x, c] of [[30, '#ff4a6a'], [50, '#3aa0ff'], [70, '#3fd06b']] as const) {
      ellipse(ctx, x, 77, 5, 4);
      paint(ctx, rad(ctx, x, 77, 5, [lite(c, 0.5), c], x - 1.6, 75.4), 2.6);
    }
    gloss(ctx, 30, 58, 3, 8, 0.6, 0.5);
  },
  trophy: ctx => {
    // handles
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(50 + s * 30, 34, 12, 0, Math.PI * 2);
      ctx.lineWidth = 15;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffc62e';
      ctx.stroke();
    }
    // cup
    ctx.beginPath();
    ctx.moveTo(22, 16);
    ctx.lineTo(78, 16);
    ctx.bezierCurveTo(78, 48, 68, 62, 50, 64);
    ctx.bezierCurveTo(32, 62, 22, 48, 22, 16);
    ctx.closePath();
    paint(ctx, lin(ctx, 22, 0, 78, 0, ['#ffe680', '#ffd23a', '#f0a018', '#c87a0a']));
    rrect(ctx, 44, 62, 12, 12, 2);
    paint(ctx, gold(ctx, 62, 74));
    rrect(ctx, 28, 74, 44, 16, 5);
    paint(ctx, lin(ctx, 0, 74, 0, 90, ['#7a4dff', '#4a22b0']));
    rrect(ctx, 38, 78.5, 24, 6, 2);
    fillOnly(ctx, gold(ctx, 78, 85));
    star(ctx, 50, 36, 12, 5.4, 5);
    paint(ctx, lin(ctx, 0, 24, 0, 48, ['#ffffff', '#fff3a6']), 3);
    gloss(ctx, 32, 28, 3, 9, 0.1, 0.5);
  },
};

const cache = new Map<string, string>();

/** paints icon `name` into a `px` box at the context's origin */
export function drawUiIcon(ctx: Ctx, name: UiIconName, px: number) {
  ctx.save();
  ctx.scale(px / 100, px / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  setLineWidth(px < 48 ? 6.4 : 4.6);
  ICONS[name](ctx);
  ctx.restore();
}

export function uiIconUrl(name: UiIconName, px: number) {
  const k = `${name}@${px}`;
  let u = cache.get(k);
  if (!u) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    drawUiIcon(cv.getContext('2d')!, name, px);
    u = cv.toDataURL('image/png');
    cache.set(k, u);
  }
  return u;
}

export const UI_ICONS = Object.keys(ICONS) as UiIconName[];
