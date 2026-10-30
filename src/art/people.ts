/**
 * People portraits, built from parts: skin, hair style, eyes, mouth, clothes, hats, glasses, beards.
 * Head centre (50, 50), radii 21 × 23; eyes at y 52, mouth at y 62.
 */
import {
  blobs, blush, brows, bust, bustPath, circle, type Ctx, deep, ellipse, eyes, type EyeKind, fillOnly, gloss, head, inside, INK, lin, line,
  lite, lw, mouth, type MouthKind, paint, poly, rad, rgba, rrect, shade, star,
} from './kit';

export const SKIN = {
  porcelain: '#ffe1cf',
  light: '#f8cfae',
  tan: '#e8ad7e',
  medium: '#c98a5c',
  brown: '#9a5f3a',
  dark: '#6b3f26',
  pale: '#e8e4f4',
} as const;

type Hair = 'short' | 'quiff' | 'curly' | 'puffs' | 'bun' | 'mohawk' | 'long' | 'bob' | 'slick' | 'wavy' | 'fade' | 'clown' | 'none';
type Hat = 'cowboy' | 'beanie' | 'capBack' | 'chef' | 'wizard' | 'tricorn' | 'headphones' | 'hijab' | 'helmet' | 'astro';
type Clothes = 'tee' | 'hoodie' | 'jacket' | 'cardigan' | 'robe' | 'cape' | 'suit' | 'armor' | 'scales' | 'space' | 'stripes' | 'apron' | 'ruff' | 'bandana';

export interface Person {
  skin: string;
  hair?: Hair;
  hairColor?: string;
  eyes?: EyeKind;
  iris?: string;
  lash?: boolean;
  mouth?: MouthKind;
  clothes: Clothes;
  shirt: string;
  shirt2?: string;
  hat?: Hat;
  hatColor?: string;
  hat2?: string;
  glasses?: 'round' | 'shades' | 'square' | 'patch';
  glassColor?: string;
  beard?: 'full' | 'stache' | 'long' | 'curly';
  beardColor?: string;
  brows?: 'arc' | 'thick' | 'angry' | 'worried';
  freckles?: boolean;
  earrings?: 'hoop' | 'star' | 'pearl' | 'stud';
  blush?: boolean;
  nose?: 'button' | 'red';
  extra?: (ctx: Ctx) => void;
}

const HX = 50;
const HY = 50;
const RX = 21;
const RY = 23;

export function drawPerson(ctx: Ctx, p: Person) {
  const hc = p.hairColor ?? '#3b2417';
  const hidden = p.hat === 'hijab' || p.hat === 'helmet';
  if (p.hat === 'hijab') hijabBack(ctx, p.hatColor ?? '#2bb3a0');
  else hairBack(ctx, p.hair ?? 'none', hc);
  hatBack(ctx, p);
  clothes(ctx, p);
  if (!hidden && p.hat !== 'headphones') ears(ctx, p.skin);
  head(ctx, p.skin, HX, HY, RX, RY);
  // a soft shadow under the hairline / cheeks
  inside(ctx, () => ellipse(ctx, HX, HY, RX, RY), () => {
    ellipse(ctx, HX + 8, HY + 18, 20, 10);
    fillOnly(ctx, rgba(deep(p.skin, 0.5), 0.12));
  });
  if (!hidden) hairFront(ctx, p.hair ?? 'none', hc);
  if (p.hat === 'hijab') hijabFront(ctx, p.hatColor ?? '#2bb3a0');
  face(ctx, p);
  if (p.beard) beard(ctx, p.beard, p.beardColor ?? hc, p);
  if (p.glasses) glasses(ctx, p.glasses, p.glassColor ?? INK);
  if (p.hat && p.hat !== 'hijab') hat(ctx, p);
  if (p.earrings && !hidden) earrings(ctx, p.earrings);
  p.extra?.(ctx);
}

function ears(ctx: Ctx, skin: string) {
  for (const s of [-1, 1]) {
    ellipse(ctx, HX + s * 21, 54, 5, 6.2);
    paint(ctx, shade(ctx, skin, HX + s * 21 - 5, 47, HX + s * 21 + 5, 60));
    ctx.beginPath();
    ctx.arc(HX + s * 21.4, 54.5, 2.4, s < 0 ? Math.PI * 0.6 : -Math.PI * 0.4, s < 0 ? Math.PI * 1.4 : Math.PI * 0.4);
    line(ctx, lw() * 0.5, deep(skin, 0.35));
  }
}

function face(ctx: Ctx, p: Person) {
  const browC = p.hair === 'clown' ? INK : deep(p.hairColor ?? '#3b2417', 0.25);
  if (p.brows && p.glasses !== 'shades') brows(ctx, 42, 58, 44.5, browC, p.brows);
  if (p.glasses !== 'shades') {
    if (p.glasses === 'patch') eyes(ctx, p.eyes ?? 'dot', 42, 42, 52, 1, { iris: p.iris, lash: p.lash });
    else eyes(ctx, p.eyes ?? 'dot', 42, 58, 52, p.eyes === 'big' ? 0.95 : 1, { iris: p.iris, lash: p.lash });
  }
  if (p.blush !== false) blush(ctx, 37, 63, 60, 4.2, 0.5);
  if (p.freckles) {
    ctx.fillStyle = rgba(deep(p.skin, 0.45), 0.7);
    for (const [x, y] of [[36, 57], [39, 59.5], [34, 60], [64, 57], [61, 59.5], [66, 60]]) {
      circle(ctx, x, y, 0.95);
      ctx.fill();
    }
  }
  // nose
  if (p.nose === 'red') {
    circle(ctx, HX, 58, 4.6);
    paint(ctx, rad(ctx, HX, 58, 5, ['#ff8a8a', '#ff2a3a', '#b0102a'], HX - 1.5, 56.5));
    gloss(ctx, HX - 1.5, 56.4, 1.6, 1, 0, 0.8);
  } else {
    ctx.beginPath();
    ctx.moveTo(HX - 2.2, 57.2);
    ctx.quadraticCurveTo(HX, 59.4, HX + 2.2, 57.2);
    ctx.lineCap = 'round';
    line(ctx, lw() * 0.7, deep(p.skin, 0.45));
  }
  mouth(ctx, p.mouth ?? 'smile', HX, 63, 0.95);
}

/* ---------- hair ---------- */

/** the hair cap over the top of the head, with a parting line `part` (−1 left, 1 right, 0 none) */
function cap(ctx: Ctx, c: string, top = 23, side = 47, fringe = 36) {
  ctx.beginPath();
  ctx.moveTo(HX - 22, side + 8);
  ctx.bezierCurveTo(HX - 25, top + 4, HX - 12, top, HX, top);
  ctx.bezierCurveTo(HX + 14, top, HX + 25, top + 4, HX + 22, side + 8);
  ctx.bezierCurveTo(HX + 20.5, side, HX + 17, fringe + 2, HX + 12, fringe);
  ctx.bezierCurveTo(HX + 2, fringe + 4, HX - 8, fringe + 2, HX - 14, fringe - 3);
  ctx.bezierCurveTo(HX - 18, fringe + 2, HX - 20.5, side, HX - 22, side + 8);
  ctx.closePath();
  paint(ctx, shade(ctx, c, HX - 24, top, HX + 24, side + 8));
}

function strands(ctx: Ctx, c: string, pts: number[][]) {
  ctx.lineCap = 'round';
  for (const s of pts) {
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.quadraticCurveTo(s[2], s[3], s[4], s[5]);
    line(ctx, lw() * 0.55, rgba(deep(c, 0.45), 0.8));
  }
}

function hairBack(ctx: Ctx, h: Hair, c: string) {
  const g = (y0: number, y1: number) => lin(ctx, 0, y0, 0, y1, [lite(c, 0.15), c, deep(c, 0.3)]);
  switch (h) {
    case 'long':
      ctx.beginPath();
      ctx.moveTo(HX - 23, 40);
      ctx.bezierCurveTo(HX - 28, 62, HX - 30, 80, HX - 26, 92);
      ctx.lineTo(HX + 26, 92);
      ctx.bezierCurveTo(HX + 30, 80, HX + 28, 62, HX + 23, 40);
      ctx.closePath();
      paint(ctx, g(30, 92));
      break;
    case 'wavy': {
      ctx.beginPath();
      ctx.moveTo(HX - 23, 38);
      ctx.bezierCurveTo(HX - 32, 50, HX - 24, 58, HX - 31, 68);
      ctx.bezierCurveTo(HX - 37, 78, HX - 26, 84, HX - 32, 96);
      ctx.lineTo(HX + 32, 96);
      ctx.bezierCurveTo(HX + 26, 84, HX + 37, 78, HX + 31, 68);
      ctx.bezierCurveTo(HX + 24, 58, HX + 32, 50, HX + 23, 38);
      ctx.closePath();
      paint(ctx, g(30, 96));
      break;
    }
    case 'bob':
      rrect(ctx, HX - 27, 26, 54, 46, [24, 24, 8, 8]);
      paint(ctx, g(26, 72));
      break;
    case 'puffs':
      for (const s of [-1, 1]) {
        const cs: [number, number, number][] = [];
        for (let i = 0; i < 9; i++) {
          const a = (i / 9) * Math.PI * 2;
          cs.push([HX + s * 23 + Math.cos(a) * 9, 27 + Math.sin(a) * 9, 5.5]);
        }
        cs.push([HX + s * 23, 27, 10]);
        blobs(ctx, cs, rad(ctx, HX + s * 23, 27, 16, [lite(c, 0.25), c, deep(c, 0.25)], HX + s * 23 - 5, 21));
        // a band where the puff is tied
        ellipse(ctx, HX + s * 16, 35, 4.5, 2.6, s * -0.7);
        paint(ctx, s < 0 ? '#ffcf2e' : '#ff5fa2', lw() * 0.7);
      }
      break;
    case 'bun':
      circle(ctx, HX, 22, 10);
      paint(ctx, rad(ctx, HX, 22, 12, [lite(c, 0.3), c, deep(c, 0.2)], HX - 4, 18));
      strands(ctx, c, [[HX - 6, 18, HX, 14, HX + 6, 19], [HX - 6, 25, HX, 29, HX + 7, 23]]);
      break;
    case 'clown':
      for (const s of [-1, 1]) {
        const cs: [number, number, number][] = [
          [HX + s * 25, 36, 8], [HX + s * 31, 44, 8], [HX + s * 30, 54, 7.5], [HX + s * 24, 30, 6], [HX + s * 33, 36, 6],
        ];
        blobs(ctx, cs, lin(ctx, 0, 26, 0, 60, ['#ff5a5a', '#ffb02e', '#ffe14a', '#3fd06b', '#3aa0ff']));
      }
      break;
    default:
      break;
  }
}

function hairFront(ctx: Ctx, h: Hair, c: string) {
  switch (h) {
    case 'short':
      cap(ctx, c, 24, 46, 35);
      strands(ctx, c, [[HX - 6, 30, HX + 2, 28, HX + 10, 33]]);
      break;
    case 'fade':
      // a short, flat-topped afro with a crisp line
      {
        const cs: [number, number, number][] = [];
        for (let i = 0; i <= 8; i++) cs.push([HX - 18 + i * 4.5, 26 + Math.abs(i - 4) * 0.6, 6.4]);
        cs.push([HX - 20, 34, 5.2], [HX + 20, 34, 5.2]);
        blobs(ctx, cs, lin(ctx, 0, 18, 0, 40, [lite(c, 0.2), c, deep(c, 0.2)]));
        ctx.fillStyle = rgba('#ffffff', 0.18);
        for (const [x, y] of [[HX - 12, 25], [HX - 4, 23], [HX + 6, 24], [HX - 8, 30], [HX + 2, 29]]) {
          circle(ctx, x, y, 1.6);
          ctx.fill();
        }
      }
      break;
    case 'quiff':
      cap(ctx, c, 26, 46, 35);
      ctx.beginPath();
      ctx.moveTo(HX - 18, 34);
      ctx.bezierCurveTo(HX - 18, 16, HX + 6, 8, HX + 22, 16);
      ctx.bezierCurveTo(HX + 12, 15, HX + 8, 20, HX + 10, 26);
      ctx.bezierCurveTo(HX + 2, 26, HX - 8, 30, HX - 18, 34);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 18, 10, HX + 22, 34));
      strands(ctx, c, [[HX - 12, 28, HX - 4, 16, HX + 12, 15]]);
      gloss(ctx, HX - 4, 18, 6, 1.6, -0.4, 0.4);
      break;
    case 'curly': {
      const cs: [number, number, number][] = [];
      for (let i = 0; i < 11; i++) {
        const a = Math.PI * (1.02 + (i / 10) * 0.96);
        cs.push([HX + Math.cos(a) * 21, 44 + Math.sin(a) * 20, 6.6]);
      }
      cs.push([HX - 8, 30, 7], [HX + 6, 29, 7]);
      blobs(ctx, cs, lin(ctx, 0, 18, 0, 50, [lite(c, 0.25), c, deep(c, 0.2)]));
      ctx.lineCap = 'round';
      for (const [x, y] of [[HX - 12, 28], [HX + 1, 25], [HX + 13, 29], [HX - 18, 38], [HX + 18, 38]]) {
        ctx.beginPath();
        ctx.arc(x, y, 2.4, Math.PI * 0.9, Math.PI * 2.1);
        line(ctx, lw() * 0.5, rgba(deep(c, 0.5), 0.8));
      }
      break;
    }
    case 'puffs':
      // edges laid down under the puffs
      cap(ctx, c, 26, 44, 33);
      break;
    case 'bun':
      cap(ctx, c, 26, 46, 33);
      strands(ctx, c, [[HX, 28, HX - 10, 30, HX - 16, 40], [HX, 28, HX + 10, 30, HX + 16, 40]]);
      break;
    case 'mohawk': {
      ctx.beginPath();
      ctx.moveTo(HX - 7, 32);
      const tips = [[HX - 10, 18], [HX - 4, 20], [HX - 3, 6], [HX + 2, 17], [HX + 7, 4], [HX + 7, 18], [HX + 15, 10], [HX + 10, 30]];
      for (const [x, y] of tips) ctx.lineTo(x, y);
      ctx.closePath();
      ctx.lineJoin = 'round';
      paint(ctx, lin(ctx, 0, 4, 0, 32, ['#ff5fd2', '#b44dff', '#5a3cff']));
      gloss(ctx, HX - 3, 22, 1.6, 6, 0.2, 0.4);
      break;
    }
    case 'long':
      cap(ctx, c, 24, 50, 34);
      strands(ctx, c, [[HX - 2, 26, HX - 12, 30, HX - 16, 42]]);
      break;
    case 'wavy':
      cap(ctx, c, 24, 50, 33);
      strands(ctx, c, [[HX + 2, 26, HX + 12, 28, HX + 17, 40]]);
      break;
    case 'bob':
      // straight bangs
      ctx.beginPath();
      ctx.moveTo(HX - 23, 52);
      ctx.bezierCurveTo(HX - 25, 30, HX - 14, 24, HX, 24);
      ctx.bezierCurveTo(HX + 14, 24, HX + 25, 30, HX + 23, 52);
      ctx.lineTo(HX + 20, 52);
      ctx.lineTo(HX + 19, 41);
      ctx.lineTo(HX - 19, 41);
      ctx.lineTo(HX - 20, 52);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 24, 24, HX + 24, 52));
      strands(ctx, c, [[HX - 8, 30, HX - 9, 36, HX - 9, 40], [HX + 4, 29, HX + 5, 36, HX + 5, 40]]);
      gloss(ctx, HX - 8, 29, 7, 1.8, -0.15, 0.35);
      break;
    case 'slick':
      ctx.beginPath();
      ctx.moveTo(HX - 22, 50);
      ctx.bezierCurveTo(HX - 25, 26, HX - 12, 22, HX, 22);
      ctx.bezierCurveTo(HX + 12, 22, HX + 25, 26, HX + 22, 50);
      ctx.bezierCurveTo(HX + 19, 40, HX + 14, 34, HX + 8, 33);
      ctx.lineTo(HX, 41);
      ctx.lineTo(HX - 8, 33);
      ctx.bezierCurveTo(HX - 14, 34, HX - 19, 40, HX - 22, 50);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 24, 22, HX + 24, 50));
      gloss(ctx, HX - 9, 27, 7, 1.8, -0.3, 0.35);
      break;
    default:
      break;
  }
}

/* ---------- clothes ---------- */

function clothes(ctx: Ctx, p: Person) {
  const c = p.shirt;
  const c2 = p.shirt2 ?? lite(c, 0.5);
  const wide = p.clothes === 'armor' || p.clothes === 'space' ? 3 : 0;
  bust(ctx, c, { neck: p.hat === 'hijab' || p.clothes === 'space' ? undefined : p.skin, wide });
  const clip = (f: () => void) => inside(ctx, () => bustPath(ctx, 80, wide), f);
  switch (p.clothes) {
    case 'tee':
      ctx.beginPath();
      ctx.arc(HX, 80, 8, 0, Math.PI);
      line(ctx, lw() * 0.8);
      break;
    case 'stripes':
      clip(() => {
        ctx.fillStyle = c2;
        for (let y = 85; y < 104; y += 8) ctx.fillRect(0, y, 100, 3.6);
      });
      ctx.beginPath();
      ctx.arc(HX, 80, 8, 0, Math.PI);
      line(ctx, lw() * 0.8);
      break;
    case 'hoodie':
      clip(() => {
        ellipse(ctx, HX, 80, 22, 8);
        fillOnly(ctx, deep(c, 0.18));
      });
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(HX + s * 5, 84);
        ctx.lineTo(HX + s * 6, 96);
        ctx.lineCap = 'round';
        line(ctx, lw() * 0.6, c2);
        circle(ctx, HX + s * 6, 97, 1.4);
        fillOnly(ctx, c2);
      }
      break;
    case 'jacket':
      clip(() => {
        poly(ctx, [HX - 9, 79, HX, 104, HX + 9, 79]);
        fillOnly(ctx, c2);
      });
      for (const s of [-1, 1]) {
        poly(ctx, [HX + s * 9, 79, HX + s * 2, 93, HX + s * 16, 86, HX + s * 18, 81]);
        paint(ctx, lite(c, 0.2), lw() * 0.7);
      }
      gloss(ctx, 25, 90, 6, 2, -0.5, 0.35);
      break;
    case 'cardigan':
      clip(() => {
        poly(ctx, [HX - 8, 79, HX, 100, HX + 8, 79]);
        fillOnly(ctx, c2);
      });
      ctx.beginPath();
      ctx.moveTo(HX - 8, 79);
      ctx.lineTo(HX, 100);
      ctx.lineTo(HX + 8, 79);
      line(ctx, lw() * 0.7);
      ctx.fillStyle = INK;
      for (const y of [92, 98]) {
        circle(ctx, HX + 1.8, y, 1.3);
        ctx.fill();
      }
      break;
    case 'suit':
      clip(() => {
        poly(ctx, [HX - 8, 79, HX, 104, HX + 8, 79]);
        fillOnly(ctx, '#ffffff');
      });
      poly(ctx, [HX - 2.6, 82, HX + 2.6, 82, HX + 3.4, 96, HX, 100, HX - 3.4, 96]);
      paint(ctx, p.shirt2 ?? '#e8304a', lw() * 0.6);
      break;
    case 'ruff':
      for (let i = 0; i < 7; i++) {
        const x = HX - 18 + i * 6;
        ellipse(ctx, x, 81, 4.6, 3.6);
        paint(ctx, i % 2 ? c2 : '#ffffff', lw() * 0.6);
      }
      clip(() => {
        ctx.fillStyle = rgba('#ffffff', 0.25);
        for (let x = 6; x < 100; x += 14) {
          circle(ctx, x, 96, 3.4);
          ctx.fill();
        }
      });
      break;
    case 'robe':
      clip(() => {
        ctx.fillStyle = c2;
        ctx.fillRect(HX - 3, 78, 6, 30);
        ctx.fillStyle = '#ffd84a';
        for (const [x, y] of [[22, 92], [78, 90], [30, 100]]) {
          star(ctx, x, y, 3, 1.3, 5);
          ctx.fill();
        }
      });
      break;
    case 'cape':
      // high collar points up behind the head was drawn by hatBack; here the cape front
      for (const s of [-1, 1]) {
        poly(ctx, [HX + s * 4, 78, HX + s * 26, 66, HX + s * 30, 84, HX + s * 12, 92]);
        paint(ctx, lin(ctx, 0, 66, 0, 92, [c2, deep(c2, 0.3)]), lw() * 0.8);
      }
      clip(() => {
        poly(ctx, [HX - 7, 79, HX, 96, HX + 7, 79]);
        fillOnly(ctx, '#ffffff');
      });
      circle(ctx, HX, 84, 2.6);
      paint(ctx, '#ff2a4a', lw() * 0.6);
      break;
    case 'armor':
      clip(() => {
        ctx.fillStyle = rgba('#ffffff', 0.35);
        ctx.fillRect(0, 85, 100, 2);
        ctx.fillStyle = rgba('#000000', 0.12);
        ctx.fillRect(0, 87, 100, 2);
      });
      for (const s of [-1, 1]) {
        ellipse(ctx, HX + s * 30, 90, 12, 9, s * 0.4);
        paint(ctx, shade(ctx, c, HX + s * 30 - 12, 81, HX + s * 30 + 12, 99), lw() * 0.8);
        circle(ctx, HX + s * 30, 89, 1.5);
        fillOnly(ctx, INK);
      }
      // a crest
      poly(ctx, [HX - 6, 88, HX + 6, 88, HX + 6, 96, HX, 101, HX - 6, 96]);
      paint(ctx, p.shirt2 ?? '#e8304a', lw() * 0.7);
      break;
    case 'scales':
      clip(() => {
        ctx.strokeStyle = rgba(deep(c, 0.4), 0.55);
        ctx.lineWidth = lw() * 0.45;
        for (let row = 0; row < 4; row++) {
          for (let i = -1; i < 12; i++) {
            const x = i * 9 + (row % 2) * 4.5;
            const y = 84 + row * 5.5;
            ctx.beginPath();
            ctx.arc(x, y, 4.5, 0, Math.PI);
            ctx.stroke();
          }
        }
      });
      // shell necklace
      ctx.beginPath();
      ctx.arc(HX, 70, 13, Math.PI * 0.2, Math.PI * 0.8);
      line(ctx, lw() * 0.5, '#fff6d8');
      shell(ctx, HX, 84, c2);
      break;
    case 'space':
      clip(() => {
        ctx.fillStyle = rgba('#000000', 0.1);
        ctx.fillRect(HX - 1, 80, 2, 30);
      });
      rrect(ctx, 63, 86, 12, 9, 2);
      paint(ctx, '#3a74ff', lw() * 0.6);
      star(ctx, 69, 90.5, 3, 1.3, 5);
      fillOnly(ctx, '#ffffff');
      rrect(ctx, 27, 87, 10, 5, 1.5);
      paint(ctx, '#ff4a4a', lw() * 0.5);
      break;
    case 'apron':
      clip(() => {
        rrect(ctx, HX - 17, 82, 34, 30, 4);
        fillOnly(ctx, '#ffffff');
      });
      rrect(ctx, HX - 17, 82, 34, 30, 4);
      line(ctx, lw() * 0.6);
      ellipse(ctx, HX, 80, 9, 4);
      paint(ctx, p.shirt2 ?? '#e8304a', lw() * 0.7);
      break;
    case 'bandana':
      poly(ctx, [HX - 15, 75, HX + 15, 75, HX + 2, 92, HX - 2, 92]);
      paint(ctx, lin(ctx, 0, 75, 0, 92, [p.shirt2 ?? '#e8304a', deep(p.shirt2 ?? '#e8304a', 0.25)]), lw() * 0.8);
      ctx.fillStyle = rgba('#ffffff', 0.8);
      for (const [x, y] of [[HX - 6, 79], [HX + 5, 80], [HX, 85]]) {
        circle(ctx, x, y, 1.1);
        ctx.fill();
      }
      break;
  }
}

function shell(ctx: Ctx, x: number, y: number, c: string) {
  ctx.beginPath();
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x - 6, y - 1);
  ctx.arc(x, y - 1, 6, Math.PI, 0);
  ctx.closePath();
  paint(ctx, lin(ctx, x, y - 7, x, y + 5, [lite(c, 0.4), c]), lw() * 0.6);
  ctx.beginPath();
  for (const dx of [-3, 0, 3]) {
    ctx.moveTo(x, y + 4);
    ctx.lineTo(x + dx, y - 5);
  }
  line(ctx, lw() * 0.35);
}

/* ---------- beards, glasses, earrings ---------- */

function beard(ctx: Ctx, kind: 'full' | 'stache' | 'long' | 'curly', c: string, p: Person) {
  const fill = (y0: number, y1: number) => lin(ctx, 0, y0, 0, y1, [lite(c, 0.15), c, deep(c, 0.2)]);
  if (kind === 'full' || kind === 'curly') {
    ctx.beginPath();
    ctx.moveTo(HX - 21, 50);
    ctx.bezierCurveTo(HX - 21, 72, HX - 10, 80, HX, 80);
    ctx.bezierCurveTo(HX + 10, 80, HX + 21, 72, HX + 21, 50);
    ctx.bezierCurveTo(HX + 17, 60, HX + 12, 61, HX + 6, 60);
    ctx.quadraticCurveTo(HX, 58, HX - 6, 60);
    ctx.bezierCurveTo(HX - 12, 61, HX - 17, 60, HX - 21, 50);
    ctx.closePath();
    paint(ctx, fill(50, 80));
    // mouth opening
    ellipse(ctx, HX, 65.5, 6, 3.4);
    fillOnly(ctx, '#6e1634');
    ctx.save();
    ellipse(ctx, HX, 65.5, 6, 3.4);
    ctx.clip();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(HX - 6, 62, 12, 2.2);
    ctx.restore();
    ellipse(ctx, HX, 65.5, 6, 3.4);
    line(ctx, lw() * 0.6);
    strands(ctx, c, [[HX - 12, 66, HX - 10, 72, HX - 6, 75], [HX + 12, 66, HX + 10, 72, HX + 6, 75]]);
  }
  if (kind === 'long') {
    ctx.beginPath();
    ctx.moveTo(HX - 20, 55);
    ctx.bezierCurveTo(HX - 22, 76, HX - 12, 88, HX, 102);
    ctx.bezierCurveTo(HX + 12, 88, HX + 22, 76, HX + 20, 55);
    ctx.bezierCurveTo(HX + 14, 62, HX + 6, 66, HX, 66);
    ctx.bezierCurveTo(HX - 6, 66, HX - 14, 62, HX - 20, 55);
    ctx.closePath();
    paint(ctx, fill(55, 102));
    strands(ctx, c, [[HX - 10, 70, HX - 8, 82, HX - 3, 92], [HX + 9, 70, HX + 8, 80, HX + 3, 90], [HX, 72, HX + 1, 82, HX, 94]]);
  }
  if (kind === 'stache' || kind === 'long' || kind === 'full') {
    // a handlebar moustache under the nose
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(HX, 60);
      ctx.bezierCurveTo(HX + s * 4, 57.4, HX + s * 9, 58, HX + s * 11, 61);
      ctx.bezierCurveTo(HX + s * 13, 63, HX + s * 15, 61.6, HX + s * 15.6, 59.4);
      ctx.bezierCurveTo(HX + s * 16, 64.4, HX + s * 11, 66.4, HX + s * 7, 64);
      ctx.bezierCurveTo(HX + s * 4, 62.6, HX + s * 2, 62.6, HX, 63);
      ctx.closePath();
      paint(ctx, fill(57, 66), lw() * 0.75);
    }
  }
  void p;
}

function glasses(ctx: Ctx, kind: 'round' | 'shades' | 'square' | 'patch', c: string) {
  if (kind === 'patch') {
    ctx.beginPath();
    ctx.moveTo(HX - 21, 40);
    ctx.lineTo(HX + 21, 49);
    line(ctx, lw() * 0.8);
    ellipse(ctx, 58, 52, 6, 5.4, 0.2);
    paint(ctx, lin(ctx, 52, 46, 64, 58, ['#4a3a5a', INK]), lw() * 0.6);
    return;
  }
  if (kind === 'shades') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(HX + s * 3, 47.6);
      ctx.lineTo(HX + s * 19, 47.6);
      ctx.quadraticCurveTo(HX + s * 19, 58, HX + s * 12, 58);
      ctx.quadraticCurveTo(HX + s * 4, 58, HX + s * 3, 47.6);
      ctx.closePath();
      paint(ctx, lin(ctx, 0, 47, 0, 58, ['#3d2a5c', '#120a1c']), lw() * 0.8);
      ctx.beginPath();
      ctx.moveTo(HX + s * 6.5 + (s < 0 ? -3 : 3), 50);
      ctx.lineTo(HX + s * 9 + (s < 0 ? -3 : 3), 55);
      line(ctx, lw() * 0.6, 'rgba(255,255,255,0.55)');
    }
    ctx.beginPath();
    ctx.moveTo(HX - 22, 48);
    ctx.lineTo(HX + 22, 48);
    line(ctx, lw() * 0.9);
    return;
  }
  for (const s of [-1, 1]) {
    const x = HX + s * 9;
    if (kind === 'round') ellipse(ctx, x, 52, 7.2, 7.2);
    else rrect(ctx, x - 7.6, 46.4, 15.2, 11.6, 3.4);
    ctx.fillStyle = 'rgba(200,235,255,0.22)';
    ctx.fill();
    ctx.lineWidth = lw() * 1.25;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.lineWidth = lw() * 0.55;
    ctx.strokeStyle = c;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 3.4, 48.8);
    ctx.lineTo(x - 5.2, 51.6);
    line(ctx, lw() * 0.45, 'rgba(255,255,255,0.8)');
  }
  ctx.beginPath();
  ctx.moveTo(HX - 2, 51);
  ctx.quadraticCurveTo(HX, 49.4, HX + 2, 51);
  line(ctx, lw() * 0.8);
}

function earrings(ctx: Ctx, kind: 'hoop' | 'star' | 'pearl' | 'stud') {
  for (const s of [-1, 1]) {
    const x = HX + s * 21.5;
    if (kind === 'hoop') {
      circle(ctx, x, 63.5, 3.8);
      ctx.lineWidth = lw() * 1.3;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = lw() * 0.6;
      ctx.strokeStyle = '#ffcf2e';
      ctx.stroke();
    } else if (kind === 'star') {
      star(ctx, x, 63, 3.6, 1.6, 5);
      paint(ctx, '#ffd84a', lw() * 0.5);
    } else {
      circle(ctx, x, 61.5, kind === 'pearl' ? 2.2 : 1.6);
      paint(ctx, kind === 'pearl' ? '#ffffff' : '#9af0ff', lw() * 0.45);
    }
  }
}

/* ---------- hats ---------- */

function hatBack(ctx: Ctx, p: Person) {
  const c = p.hatColor ?? '#6a3cf0';
  if (p.hat === 'cowboy') {
    // the far side of the brim
    ellipse(ctx, HX, 31, 37, 9.5, -0.06);
    paint(ctx, shade(ctx, deep(c, 0.1), HX - 37, 22, HX + 37, 40));
  }
  if (p.clothes === 'cape') {
    for (const s of [-1, 1]) {
      poly(ctx, [HX + s * 8, 80, HX + s * 30, 52, HX + s * 34, 76]);
      paint(ctx, lin(ctx, 0, 52, 0, 80, ['#2a1440', '#140a22']), lw() * 0.8);
    }
  }
}

function hat(ctx: Ctx, p: Person) {
  const c = p.hatColor ?? '#6a3cf0';
  const c2 = p.hat2 ?? '#ffd84a';
  switch (p.hat) {
    case 'cowboy': {
      // crown
      ctx.beginPath();
      ctx.moveTo(HX - 17, 31);
      ctx.bezierCurveTo(HX - 19, 18, HX - 15, 8, HX - 8, 9);
      ctx.quadraticCurveTo(HX, 13, HX + 8, 9);
      ctx.bezierCurveTo(HX + 15, 8, HX + 19, 18, HX + 17, 31);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 19, 8, HX + 19, 31));
      ctx.beginPath();
      ctx.moveTo(HX - 18, 25);
      ctx.quadraticCurveTo(HX, 28, HX + 18, 25);
      ctx.lineTo(HX + 17.4, 31);
      ctx.quadraticCurveTo(HX, 34, HX - 17.4, 31);
      ctx.closePath();
      paint(ctx, c2, lw() * 0.7);
      // the near side of the brim, curled up at the sides
      ctx.beginPath();
      ctx.moveTo(HX - 38, 24);
      ctx.bezierCurveTo(HX - 34, 38, HX - 14, 38, HX, 37);
      ctx.bezierCurveTo(HX + 14, 38, HX + 34, 38, HX + 38, 24);
      ctx.bezierCurveTo(HX + 32, 33, HX + 18, 31, HX, 31);
      ctx.bezierCurveTo(HX - 18, 31, HX - 32, 33, HX - 38, 24);
      ctx.closePath();
      paint(ctx, lin(ctx, 0, 24, 0, 38, [lite(c, 0.25), c]));
      gloss(ctx, HX - 8, 15, 3, 5, 0.3, 0.35);
      break;
    }
    case 'beanie': {
      ctx.beginPath();
      ctx.moveTo(HX - 23, 40);
      ctx.bezierCurveTo(HX - 25, 14, HX + 25, 14, HX + 23, 40);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 25, 14, HX + 25, 40));
      inside(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(HX - 23, 40);
        ctx.bezierCurveTo(HX - 25, 14, HX + 25, 14, HX + 23, 40);
        ctx.closePath();
      }, () => {
        ctx.strokeStyle = rgba(deep(c, 0.4), 0.5);
        ctx.lineWidth = lw() * 0.5;
        for (let x = HX - 20; x <= HX + 20; x += 6) {
          ctx.beginPath();
          ctx.moveTo(x, 40);
          ctx.quadraticCurveTo(HX + (x - HX) * 0.6, 22, HX + (x - HX) * 0.2, 14);
          ctx.stroke();
        }
      });
      rrect(ctx, HX - 25, 34, 50, 10, 5);
      paint(ctx, lin(ctx, 0, 34, 0, 44, [lite(c2, 0.2), c2]));
      blobs(ctx, [[HX, 15, 5.2], [HX - 3, 13, 4], [HX + 3, 13, 4], [HX, 11, 4]], rad(ctx, HX, 13, 7, ['#ffffff', c2], HX - 2, 11), lw() * 0.8);
      break;
    }
    case 'capBack': {
      // dome
      ctx.beginPath();
      ctx.moveTo(HX - 22, 40);
      ctx.bezierCurveTo(HX - 24, 16, HX + 24, 16, HX + 22, 40);
      ctx.quadraticCurveTo(HX, 36, HX - 22, 40);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 24, 16, HX + 24, 40));
      // strap opening at the front (the cap is on backwards)
      ctx.beginPath();
      ctx.moveTo(HX - 7, 38);
      ctx.quadraticCurveTo(HX, 30, HX + 7, 38);
      ctx.closePath();
      paint(ctx, p.hairColor ?? '#3b2417', lw() * 0.6);
      // brim sticking out to the side
      ctx.beginPath();
      ctx.moveTo(HX + 18, 34);
      ctx.bezierCurveTo(HX + 28, 28, HX + 36, 30, HX + 37, 35);
      ctx.bezierCurveTo(HX + 33, 38, HX + 26, 38, HX + 21, 39);
      ctx.closePath();
      paint(ctx, lin(ctx, 0, 28, 0, 39, [lite(c2, 0.2), c2]));
      circle(ctx, HX, 18.4, 2.2);
      paint(ctx, c2, lw() * 0.5);
      gloss(ctx, HX - 10, 25, 5, 2, -0.5, 0.4);
      break;
    }
    case 'chef': {
      rrect(ctx, HX - 18, 24, 36, 12, 3);
      paint(ctx, lin(ctx, 0, 24, 0, 36, ['#ffffff', '#dfe4ef']));
      blobs(ctx, [[HX - 12, 16, 9], [HX + 12, 16, 9], [HX, 10, 11], [HX - 6, 20, 8], [HX + 6, 20, 8]], rad(ctx, HX, 14, 22, ['#ffffff', '#ffffff', '#d8deea'], HX - 6, 6));
      ctx.beginPath();
      ctx.moveTo(HX - 6, 24);
      ctx.quadraticCurveTo(HX - 7, 18, HX - 4, 14);
      ctx.moveTo(HX + 6, 24);
      ctx.quadraticCurveTo(HX + 7, 18, HX + 4, 14);
      line(ctx, lw() * 0.45, '#c3cad8');
      break;
    }
    case 'wizard': {
      ellipse(ctx, HX, 33, 31, 7.5, -0.05);
      paint(ctx, shade(ctx, c, HX - 31, 26, HX + 31, 40));
      ctx.beginPath();
      ctx.moveTo(HX - 19, 32);
      ctx.bezierCurveTo(HX - 12, 20, HX - 2, 6, HX + 10, -2);
      ctx.bezierCurveTo(HX + 22, -6, HX + 26, 2, HX + 20, 6);
      ctx.bezierCurveTo(HX + 12, 12, HX + 14, 22, HX + 19, 32);
      ctx.quadraticCurveTo(HX, 36, HX - 19, 32);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 19, -4, HX + 26, 34));
      rrect(ctx, HX - 18.5, 26, 37, 6, 3);
      paint(ctx, c2, lw() * 0.7);
      ctx.fillStyle = '#ffe14a';
      for (const [x, y, r] of [[HX - 4, 20, 2.8], [HX + 9, 12, 2.2], [HX + 4, 4, 1.8]]) {
        star(ctx, x, y, r, r * 0.45, 5);
        ctx.fill();
      }
      break;
    }
    case 'tricorn': {
      ctx.beginPath();
      ctx.moveTo(HX - 32, 30);
      ctx.bezierCurveTo(HX - 24, 8, HX + 24, 8, HX + 32, 30);
      ctx.quadraticCurveTo(HX + 18, 34, HX, 38);
      ctx.quadraticCurveTo(HX - 18, 34, HX - 32, 30);
      ctx.closePath();
      paint(ctx, shade(ctx, c, HX - 32, 8, HX + 32, 38));
      ctx.beginPath();
      ctx.moveTo(HX - 30, 29);
      ctx.quadraticCurveTo(HX - 16, 32, HX, 36);
      ctx.quadraticCurveTo(HX + 16, 32, HX + 30, 29);
      line(ctx, lw() * 0.7, c2);
      // skull badge
      circle(ctx, HX, 21, 4.6);
      paint(ctx, '#ffffff', lw() * 0.6);
      ctx.fillStyle = INK;
      for (const s of [-1, 1]) {
        circle(ctx, HX + s * 1.7, 20.6, 1.1);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.moveTo(HX - 6, 25);
      ctx.lineTo(HX + 6, 30);
      ctx.moveTo(HX + 6, 25);
      ctx.lineTo(HX - 6, 30);
      ctx.lineCap = 'round';
      line(ctx, lw() * 1.4);
      ctx.beginPath();
      ctx.moveTo(HX - 6, 25);
      ctx.lineTo(HX + 6, 30);
      ctx.moveTo(HX + 6, 25);
      ctx.lineTo(HX - 6, 30);
      line(ctx, lw() * 0.6, '#ffffff');
      break;
    }
    case 'headphones': {
      ctx.beginPath();
      ctx.arc(HX, 48, 25, Math.PI * 1.08, Math.PI * 1.92);
      ctx.lineCap = 'round';
      line(ctx, 7 + lw() * 1.6);
      ctx.beginPath();
      ctx.arc(HX, 48, 25, Math.PI * 1.08, Math.PI * 1.92);
      line(ctx, 7, c);
      ctx.beginPath();
      ctx.arc(HX, 48, 25, Math.PI * 1.25, Math.PI * 1.55);
      line(ctx, 1.6, 'rgba(255,255,255,0.5)');
      for (const s of [-1, 1]) {
        rrect(ctx, HX + s * 23 - 5.5, 45, 11, 18, 5);
        paint(ctx, shade(ctx, c2, HX + s * 23 - 5.5, 45, HX + s * 23 + 5.5, 63));
        rrect(ctx, HX + s * 23 - 2, 48, 4, 12, 2);
        fillOnly(ctx, rgba('#ffffff', 0.35));
      }
      break;
    }
    case 'helmet': {
      // steel helmet with the face showing, a plume on top
      ctx.beginPath();
      ctx.moveTo(HX - 2, 22);
      ctx.bezierCurveTo(HX + 2, 6, HX + 20, 2, HX + 28, 10);
      ctx.bezierCurveTo(HX + 18, 10, HX + 10, 14, HX + 8, 24);
      ctx.closePath();
      paint(ctx, lin(ctx, 0, 4, 0, 24, ['#ff6b6b', '#e8202f']));
      const shellPath = () => {
        ctx.beginPath();
        ctx.moveTo(HX - 25, 72);
        ctx.bezierCurveTo(HX - 28, 30, HX - 18, 20, HX, 20);
        ctx.bezierCurveTo(HX + 18, 20, HX + 28, 30, HX + 25, 72);
        ctx.lineTo(HX + 15, 72);
        ctx.bezierCurveTo(HX + 17, 60, HX + 18, 50, HX + 16, 42);
        ctx.quadraticCurveTo(HX, 37, HX - 16, 42);
        ctx.bezierCurveTo(HX - 18, 50, HX - 17, 60, HX - 15, 72);
        ctx.closePath();
      };
      shellPath();
      paint(ctx, shade(ctx, c, HX - 28, 20, HX + 28, 72));
      ctx.beginPath();
      ctx.moveTo(HX, 21);
      ctx.lineTo(HX, 38);
      line(ctx, lw() * 0.6, rgba(INK, 0.6));
      ctx.fillStyle = INK;
      for (const [x, y] of [[HX - 21, 50], [HX - 21, 58], [HX + 21, 50], [HX + 21, 58]]) {
        circle(ctx, x, y, 1.2);
        ctx.fill();
      }
      gloss(ctx, HX - 13, 30, 6, 2.4, -0.7, 0.55);
      break;
    }
    case 'astro': {
      // the glass bubble over the head and the collar ring
      ellipse(ctx, HX, 50, 33, 33);
      ctx.fillStyle = 'rgba(190,230,255,0.16)';
      ctx.fill();
      ctx.lineWidth = lw() * 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = lw() * 0.7;
      ctx.strokeStyle = '#e8f2ff';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(HX, 50, 28, Math.PI * 1.1, Math.PI * 1.45);
      ctx.lineCap = 'round';
      line(ctx, 3.4, 'rgba(255,255,255,0.75)');
      ctx.beginPath();
      ctx.arc(HX, 50, 28, Math.PI * 1.52, Math.PI * 1.58);
      line(ctx, 3.4, 'rgba(255,255,255,0.75)');
      rrect(ctx, HX - 24, 78, 48, 9, 4.5);
      paint(ctx, lin(ctx, 0, 78, 0, 87, ['#ffffff', '#b8c4d8']));
      break;
    }
    default:
      break;
  }
}

function hijabBack(ctx: Ctx, c: string) {
  ctx.beginPath();
  ctx.moveTo(HX - 28, 96);
  ctx.bezierCurveTo(HX - 34, 70, HX - 32, 20, HX, 20);
  ctx.bezierCurveTo(HX + 32, 20, HX + 34, 70, HX + 28, 96);
  ctx.closePath();
  paint(ctx, shade(ctx, c, HX - 34, 20, HX + 34, 96));
}

function hijabFront(ctx: Ctx, c: string) {
  // the folded edge framing the face, and a drape across the chest
  ctx.beginPath();
  ctx.moveTo(HX - 23, 62);
  ctx.bezierCurveTo(HX - 26, 30, HX - 12, 24, HX, 24);
  ctx.bezierCurveTo(HX + 12, 24, HX + 26, 30, HX + 23, 62);
  ctx.bezierCurveTo(HX + 21, 50, HX + 20, 38, HX, 33);
  ctx.bezierCurveTo(HX - 20, 38, HX - 21, 50, HX - 23, 62);
  ctx.closePath();
  paint(ctx, shade(ctx, lite(c, 0.12), HX - 26, 24, HX + 26, 62));
  ctx.beginPath();
  ctx.moveTo(HX - 23, 60);
  ctx.bezierCurveTo(HX - 16, 80, HX + 6, 80, HX + 26, 70);
  ctx.bezierCurveTo(HX + 30, 82, HX + 20, 90, HX + 4, 92);
  ctx.bezierCurveTo(HX - 12, 92, HX - 24, 82, HX - 23, 60);
  ctx.closePath();
  paint(ctx, shade(ctx, c, HX - 24, 60, HX + 30, 92));
  ctx.beginPath();
  ctx.moveTo(HX - 12, 80);
  ctx.quadraticCurveTo(HX + 2, 86, HX + 18, 80);
  line(ctx, lw() * 0.5, rgba(deep(c, 0.4), 0.7));
  // a pin
  circle(ctx, HX + 20, 58, 2.2);
  paint(ctx, '#ffd84a', lw() * 0.5);
}
