/**
 * Robot portraits for the bots, built from parts: head shape, screen face, eyes, mouth, antenna, ears.
 */
import { blush, bust, bustPath, cased, circle, type Ctx, deep, ellipse, fillOnly, gloss, inside, INK, lin, line, lite, lw, paint, poly, rad, rgba, rrect, shade, star } from './kit';

export interface RobotLook {
  body: string;
  /** the screen */
  face: string;
  /** what glows (eyes, mouth, lights) */
  eye: string;
  head: 'round' | 'square' | 'dome' | 'tv' | 'capsule' | 'trapezoid' | 'bucket' | 'hex';
  eyes: 'round' | 'visor' | 'cyclops' | 'happy' | 'hearts' | 'square' | 'wide' | 'sleepy' | 'star';
  mouth: 'smile' | 'grille' | 'teeth' | 'zigzag' | 'o' | 'meter' | 'none';
  antenna: 'ball' | 'bolt' | 'twin' | 'dish' | 'propeller' | 'spring' | 'none';
  ears: 'bolt' | 'disc' | 'fin' | 'none';
  cheeks?: boolean;
}

const CX = 50;
const CY = 48;

function headPath(ctx: Ctx, h: RobotLook['head']) {
  switch (h) {
    case 'round':
      circle(ctx, CX, CY, 26);
      break;
    case 'square':
      rrect(ctx, 23, 23, 54, 48, 11);
      break;
    case 'dome':
      ctx.beginPath();
      ctx.moveTo(22, 68);
      ctx.lineTo(22, 50);
      ctx.bezierCurveTo(22, 30, 34, 20, 50, 20);
      ctx.bezierCurveTo(66, 20, 78, 30, 78, 50);
      ctx.lineTo(78, 68);
      ctx.quadraticCurveTo(78, 72, 74, 72);
      ctx.lineTo(26, 72);
      ctx.quadraticCurveTo(22, 72, 22, 68);
      ctx.closePath();
      break;
    case 'tv':
      rrect(ctx, 17, 27, 66, 44, 9);
      break;
    case 'capsule':
      rrect(ctx, 28, 18, 44, 56, 22);
      break;
    case 'trapezoid':
      ctx.beginPath();
      ctx.moveTo(32, 22);
      ctx.lineTo(68, 22);
      ctx.quadraticCurveTo(74, 22, 75, 28);
      ctx.lineTo(80, 66);
      ctx.quadraticCurveTo(80, 72, 74, 72);
      ctx.lineTo(26, 72);
      ctx.quadraticCurveTo(20, 72, 20, 66);
      ctx.lineTo(25, 28);
      ctx.quadraticCurveTo(26, 22, 32, 22);
      ctx.closePath();
      break;
    case 'bucket':
      ctx.beginPath();
      ctx.moveTo(24, 22);
      ctx.lineTo(76, 22);
      ctx.quadraticCurveTo(80, 22, 79, 27);
      ctx.lineTo(73, 68);
      ctx.quadraticCurveTo(72, 72, 68, 72);
      ctx.lineTo(32, 72);
      ctx.quadraticCurveTo(28, 72, 27, 68);
      ctx.lineTo(21, 27);
      ctx.quadraticCurveTo(20, 22, 24, 22);
      ctx.closePath();
      break;
    case 'hex': {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.lineTo(CX + Math.cos(a) * 30, CY + Math.sin(a) * 27);
      }
      ctx.closePath();
      break;
    }
  }
}

/** the screen inside the head: x, y, w, h, radius */
function screenBox(h: RobotLook['head']): [number, number, number, number, number] {
  switch (h) {
    case 'round':
      return [30, 34, 40, 27, 13];
    case 'square':
      return [29, 33, 42, 28, 9];
    case 'dome':
      return [29, 36, 42, 26, 10];
    case 'tv':
      return [23, 33, 46, 32, 7];
    case 'capsule':
      return [33, 30, 34, 32, 15];
    case 'trapezoid':
      return [29, 34, 42, 28, 8];
    case 'bucket':
      return [28, 32, 44, 27, 8];
    case 'hex':
      return [29, 35, 42, 26, 10];
  }
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, c: string) {
  circle(ctx, x, y, r * 2.2);
  fillOnly(ctx, rad(ctx, x, y, r * 2.2, [rgba(c, 0.5), rgba(c, 0)]));
}

export function drawRobot(ctx: Ctx, r: RobotLook) {
  const metal = (c: string, x0: number, y0: number, x1: number, y1: number) => shade(ctx, c, x0, y0, x1, y1);
  // body with a chest panel
  bust(ctx, deep(r.body, 0.12));
  inside(ctx, () => bustPath(ctx), () => {
    rrect(ctx, 38, 84, 24, 20, 5);
    fillOnly(ctx, r.face);
    for (const [i, c] of [[0, r.eye], [1, '#ff5a6a'], [2, '#ffd84a']] as const) {
      glowDot(ctx, 43 + i * 7, 90, 1.6, c);
      circle(ctx, 43 + i * 7, 90, 1.8);
      fillOnly(ctx, c);
    }
    ctx.fillStyle = rgba('#ffffff', 0.25);
    ctx.fillRect(41, 96, 18, 1.6);
  });
  // neck
  rrect(ctx, 43, 68, 14, 12, 3);
  paint(ctx, lin(ctx, 0, 68, 0, 80, [deep(r.body, 0.45), deep(r.body, 0.25)]), lw() * 0.8);
  ctx.beginPath();
  for (const y of [72, 76]) {
    ctx.moveTo(43, y);
    ctx.lineTo(57, y);
  }
  line(ctx, lw() * 0.45, rgba(INK, 0.6));

  antenna(ctx, r);
  ears(ctx, r);
  headPath(ctx, r.head);
  paint(ctx, metal(r.body, 18, 18, 82, 74));
  // a bright band of reflected light across the top
  inside(ctx, () => headPath(ctx, r.head), () => {
    ellipse(ctx, CX - 10, 24, 22, 8, -0.3);
    fillOnly(ctx, 'rgba(255,255,255,0.28)');
    ellipse(ctx, CX + 6, 76, 34, 8);
    fillOnly(ctx, rgba(deep(r.body, 0.5), 0.25));
  });
  if (r.head === 'tv') {
    // dials on the side of the telly
    for (const y of [40, 54]) {
      circle(ctx, 76, y, 3.6);
      paint(ctx, lin(ctx, 0, y - 4, 0, y + 4, ['#ffffff', '#b8c0d0']), lw() * 0.6);
    }
  }
  const [sx, sy, sw, sh, sr] = screenBox(r.head);
  rrect(ctx, sx, sy, sw, sh, sr);
  paint(ctx, lin(ctx, 0, sy, 0, sy + sh, [lite(r.face, 0.12), r.face, deep(r.face, 0.3)]), lw() * 0.85);
  inside(ctx, () => rrect(ctx, sx, sy, sw, sh, sr), () => {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = sy + 2; y < sy + sh; y += 3) ctx.fillRect(sx, y, sw, 1.2);
    ellipse(ctx, sx + sw * 0.28, sy + 3, sw * 0.32, 3, -0.15);
    fillOnly(ctx, 'rgba(255,255,255,0.14)');
  });
  const ey = sy + sh * 0.42;
  const ex = sw * 0.22;
  face(ctx, r, CX - (r.head === 'tv' ? 4 : 0), ey, ex, sy + sh * 0.76);
  if (r.cheeks) blush(ctx, sx + 3, sx + sw - 3, sy + sh * 0.68, 3.4, 0.7, '#ff6fa8');
  gloss(ctx, sx + 6, sy + 5, 3.4, 1.3, -0.4, 0.4);
}

function face(ctx: Ctx, r: RobotLook, cx: number, ey: number, ex: number, my: number) {
  const c = r.eye;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const glowLine = (path: () => void, w: number) => {
    path();
    ctx.lineWidth = w * 2.6;
    ctx.strokeStyle = rgba(c, 0.25);
    ctx.stroke();
    path();
    ctx.lineWidth = w;
    ctx.strokeStyle = c;
    ctx.stroke();
  };
  switch (r.eyes) {
    case 'round':
      for (const s of [-1, 1]) {
        glowDot(ctx, cx + s * ex, ey, 4.6, c);
        circle(ctx, cx + s * ex, ey, 4.6);
        fillOnly(ctx, rad(ctx, cx + s * ex, ey, 4.6, ['#ffffff', c, c]));
        circle(ctx, cx + s * ex - 1.4, ey - 1.4, 1.4);
        fillOnly(ctx, '#ffffff');
      }
      break;
    case 'square':
      for (const s of [-1, 1]) {
        glowDot(ctx, cx + s * ex, ey, 4, c);
        rrect(ctx, cx + s * ex - 4, ey - 4.4, 8, 8.8, 1.6);
        fillOnly(ctx, c);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx + s * ex - 2.8, ey - 3.2, 2.2, 2.2);
      }
      break;
    case 'wide':
      for (const s of [-1, 1]) {
        glowDot(ctx, cx + s * ex, ey, 4, c);
        ellipse(ctx, cx + s * ex, ey, 5.6, 3.4);
        fillOnly(ctx, c);
        ellipse(ctx, cx + s * ex - 1.6, ey - 1, 1.8, 1.1);
        fillOnly(ctx, '#ffffff');
      }
      break;
    case 'visor': {
      const w = ex * 2 + 12;
      ctx.save();
      rrect(ctx, cx - w / 2, ey - 3.6, w, 7.2, 3.6);
      ctx.fillStyle = rgba(c, 0.25);
      ctx.fill();
      ctx.restore();
      rrect(ctx, cx - w / 2 + 2, ey - 2.4, w - 4, 4.8, 2.4);
      fillOnly(ctx, lin(ctx, cx - w / 2, 0, cx + w / 2, 0, [rgba(c, 0.5), c, '#ffffff', c, rgba(c, 0.5)]));
      break;
    }
    case 'cyclops':
      glowDot(ctx, cx, ey + 1, 7, c);
      circle(ctx, cx, ey + 1, 7);
      fillOnly(ctx, rad(ctx, cx, ey + 1, 7, ['#ffffff', c, deep(c, 0.2)]));
      circle(ctx, cx, ey + 1, 3);
      fillOnly(ctx, r.face);
      circle(ctx, cx - 2.4, ey - 1.4, 1.6);
      fillOnly(ctx, '#ffffff');
      break;
    case 'happy':
      for (const s of [-1, 1]) glowLine(() => {
        ctx.beginPath();
        ctx.arc(cx + s * ex, ey + 2.4, 4.4, Math.PI * 1.1, Math.PI * 1.9);
      }, 2.6);
      break;
    case 'sleepy':
      for (const s of [-1, 1]) glowLine(() => {
        ctx.beginPath();
        ctx.arc(cx + s * ex, ey - 1.6, 4.2, Math.PI * 0.15, Math.PI * 0.85);
      }, 2.4);
      break;
    case 'hearts':
      for (const s of [-1, 1]) {
        const x = cx + s * ex;
        glowDot(ctx, x, ey, 4.6, c);
        ctx.beginPath();
        ctx.moveTo(x, ey + 4.4);
        ctx.bezierCurveTo(x - 7, ey - 0.6, x - 3.6, ey - 6.4, x, ey - 2.6);
        ctx.bezierCurveTo(x + 3.6, ey - 6.4, x + 7, ey - 0.6, x, ey + 4.4);
        ctx.closePath();
        fillOnly(ctx, c);
        circle(ctx, x - 2, ey - 2.2, 1);
        fillOnly(ctx, '#ffffff');
      }
      break;
    case 'star':
      for (const s of [-1, 1]) {
        glowDot(ctx, cx + s * ex, ey, 4.6, c);
        star(ctx, cx + s * ex, ey, 5.4, 2.4, 5);
        fillOnly(ctx, c);
      }
      break;
  }
  const mw = ex * 0.9;
  switch (r.mouth) {
    case 'smile':
      glowLine(() => {
        ctx.beginPath();
        ctx.arc(cx, my - 5, 5.6, Math.PI * 0.22, Math.PI * 0.78);
      }, 2.2);
      break;
    case 'o':
      circle(ctx, cx, my, 2.6);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = c;
      ctx.stroke();
      break;
    case 'zigzag':
      glowLine(() => {
        ctx.beginPath();
        for (let i = 0; i <= 6; i++) ctx.lineTo(cx - mw + (i * mw * 2) / 6, my + (i % 2 ? 1.6 : -1.6));
      }, 1.8);
      break;
    case 'grille':
      rrect(ctx, cx - mw, my - 2.6, mw * 2, 5.2, 2);
      fillOnly(ctx, rgba(c, 0.25));
      ctx.fillStyle = c;
      for (let i = 0; i < 5; i++) ctx.fillRect(cx - mw + 1.4 + i * ((mw * 2 - 2.8) / 5), my - 1.6, 1.4, 3.2);
      break;
    case 'teeth':
      rrect(ctx, cx - mw, my - 3, mw * 2, 6, 2);
      fillOnly(ctx, c);
      ctx.fillStyle = rgba(INK, 0.55);
      for (let i = 1; i < 4; i++) ctx.fillRect(cx - mw + (i * mw * 2) / 4 - 0.4, my - 3, 0.8, 6);
      ctx.fillRect(cx - mw, my - 0.3, mw * 2, 0.6);
      break;
    case 'meter':
      ctx.fillStyle = c;
      [3, 5, 2.4, 6, 3.6, 4.4, 2].forEach((h, i) => {
        rrect(ctx, cx - mw + i * ((mw * 2) / 7), my - h / 2, mw * 0.18, h, 0.6);
        ctx.fill();
      });
      break;
    case 'none':
      break;
  }
}

function antenna(ctx: Ctx, r: RobotLook) {
  const top = r.head === 'tv' ? 27 : r.head === 'round' ? 22 : r.head === 'hex' ? 22 : r.head === 'capsule' ? 18 : 21;
  const pole = deep(r.body, 0.35);
  switch (r.antenna) {
    case 'ball':
      cased(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(CX, top + 2);
        ctx.lineTo(CX, 9);
      }, pole, 2.2);
      glowDot(ctx, CX, 8, 4.6, r.eye);
      circle(ctx, CX, 8, 4.6);
      paint(ctx, rad(ctx, CX, 8, 5, ['#ffffff', r.eye, deep(r.eye, 0.2)], CX - 1.6, 6.4), lw() * 0.7);
      break;
    case 'twin':
      for (const s of [-1, 1]) {
        cased(ctx, () => {
          ctx.beginPath();
          ctx.moveTo(CX + s * 10, top + 3);
          ctx.lineTo(CX + s * 17, 8);
        }, pole, 2);
        circle(ctx, CX + s * 17, 8, 3.8);
        paint(ctx, rad(ctx, CX + s * 17, 8, 4, ['#ffffff', r.eye], CX + s * 17 - 1.2, 6.6), lw() * 0.7);
      }
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(CX + 2, top + 2);
      ctx.lineTo(CX - 4, 13);
      ctx.lineTo(CX + 3, 13);
      ctx.lineTo(CX - 2, 2);
      ctx.lineTo(CX + 9, 15);
      ctx.lineTo(CX + 2, 15);
      ctx.lineTo(CX + 7, top + 2);
      ctx.closePath();
      ctx.lineJoin = 'round';
      paint(ctx, lin(ctx, 0, 2, 0, top, ['#fff6a0', '#ffd23a', '#ff9a1a']), lw() * 0.75);
      break;
    case 'dish':
      cased(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(CX + 8, top + 2);
        ctx.lineTo(CX + 14, 14);
      }, pole, 2);
      ctx.beginPath();
      ctx.ellipse(CX + 14, 12, 10, 4.4, -0.5, 0, Math.PI);
      ctx.closePath();
      paint(ctx, lin(ctx, 0, 6, 0, 18, ['#ffffff', '#b8c4d8']), lw() * 0.75);
      circle(ctx, CX + 18, 5, 2.2);
      paint(ctx, r.eye, lw() * 0.5);
      break;
    case 'propeller':
      cased(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(CX, top + 2);
        ctx.lineTo(CX, 10);
      }, pole, 2.2);
      for (const s of [-1, 1]) {
        ellipse(ctx, CX + s * 9, 9, 9, 3, s * 0.12);
        paint(ctx, s < 0 ? '#ff5a6a' : '#3aa0ff', lw() * 0.7);
      }
      circle(ctx, CX, 9.4, 2.6);
      paint(ctx, '#ffd84a', lw() * 0.6);
      break;
    case 'spring':
      cased(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(CX, top + 2);
        for (let i = 0; i < 5; i++) {
          const y = top - i * 3;
          ctx.quadraticCurveTo(CX + (i % 2 ? -6 : 6), y - 1.5, CX, y - 3);
        }
      }, '#d8deea', 1.6);
      circle(ctx, CX, top - 18, 4.4);
      paint(ctx, rad(ctx, CX, top - 18, 5, ['#ffffff', r.eye], CX - 1.4, top - 19.6), lw() * 0.7);
      break;
    case 'none':
      break;
  }
}

function ears(ctx: Ctx, r: RobotLook) {
  const half = r.head === 'tv' ? 34 : r.head === 'capsule' ? 23 : r.head === 'hex' ? 30 : r.head === 'trapezoid' ? 29 : 27;
  for (const s of [-1, 1]) {
    const x = CX + s * half;
    switch (r.ears) {
      case 'bolt':
        rrect(ctx, x - 4, 40, 8, 16, 3);
        paint(ctx, lin(ctx, 0, 40, 0, 56, [lite(r.face, 0.3), r.face]), lw() * 0.75);
        circle(ctx, x + s * 3, 48, 3.2);
        paint(ctx, lin(ctx, 0, 45, 0, 51, ['#ffffff', '#b8c0d0']), lw() * 0.6);
        break;
      case 'disc':
        circle(ctx, x + s * 2, 48, 7.4);
        paint(ctx, shade(ctx, lite(r.body, 0.15), x - 7, 41, x + 7, 55), lw() * 0.8);
        circle(ctx, x + s * 2, 48, 3.4);
        paint(ctx, r.eye, lw() * 0.55);
        break;
      case 'fin':
        poly(ctx, [x - s * 2, 36, x + s * 10, 30, x + s * 8, 60, x - s * 2, 58]);
        ctx.lineJoin = 'round';
        paint(ctx, lin(ctx, 0, 30, 0, 60, [lite(r.eye, 0.2), deep(r.eye, 0.2)]), lw() * 0.75);
        break;
      case 'none':
        break;
    }
  }
}
