/**
 * Animals, fantasy creatures, food mascots and card characters, each drawn by hand from the shared kit.
 */
import {
  blobs, blush, bust, bustPath, cased, circle, type Ctx, deep, ellipse, eyes, fillOnly, gloss, head, inside, INK, lin, line, lite, lw, merged,
  mouth, paint, poly, rad, rgba, rrect, shade, snout, star,
} from './kit';

type Draw = (ctx: Ctx) => void;

/** pointed ear with a coloured inside */
function pointyEar(ctx: Ctx, base1: [number, number], tip: [number, number], base2: [number, number], c: string, inner: string) {
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...base1);
  ctx.quadraticCurveTo((base1[0] + tip[0]) / 2 - 2, (base1[1] + tip[1]) / 2, ...tip);
  ctx.quadraticCurveTo((base2[0] + tip[0]) / 2 + 2, (base2[1] + tip[1]) / 2, ...base2);
  ctx.closePath();
  paint(ctx, shade(ctx, c, Math.min(base1[0], tip[0]), tip[1], Math.max(base2[0], tip[0]), base1[1]));
  const cx = (base1[0] + base2[0] + tip[0]) / 3;
  const cy = (base1[1] + base2[1] + tip[1]) / 3;
  const k = 0.55;
  ctx.beginPath();
  ctx.moveTo(cx + (base1[0] - cx) * k, cy + (base1[1] - cy) * k + 2);
  ctx.lineTo(cx + (tip[0] - cx) * k, cy + (tip[1] - cy) * k);
  ctx.lineTo(cx + (base2[0] - cx) * k, cy + (base2[1] - cy) * k + 2);
  ctx.closePath();
  ctx.fillStyle = inner;
  ctx.fill();
}

function roundEar(ctx: Ctx, x: number, y: number, r: number, c: string, inner: string) {
  circle(ctx, x, y, r);
  paint(ctx, shade(ctx, c, x - r, y - r, x + r, y + r));
  circle(ctx, x + (x < 50 ? 1 : -1) * r * 0.12, y + r * 0.12, r * 0.55);
  fillOnly(ctx, inner);
}

function whiskers(ctx: Ctx, y: number, c = INK) {
  ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    for (const d of [-2.6, 1.4]) {
      ctx.beginPath();
      ctx.moveTo(50 + s * 13, y + d * 0.6);
      ctx.lineTo(50 + s * 26, y + d * 1.6);
      line(ctx, lw() * 0.45, c);
    }
  }
}

function bib(ctx: Ctx, c: string, color = '#fff6e8') {
  bust(ctx, c);
  inside(ctx, () => bustPath(ctx), () => {
    ellipse(ctx, 50, 96, 15, 18);
    fillOnly(ctx, color);
  });
}

/* ---------- animals ---------- */

const fox: Draw = ctx => {
  bib(ctx, '#f07a2a');
  pointyEar(ctx, [26, 44], [22, 12], [44, 30], '#f07a2a', '#3a1a24');
  pointyEar(ctx, [56, 30], [78, 12], [74, 44], '#f07a2a', '#3a1a24');
  const face = () => {
    ctx.beginPath();
    ctx.moveTo(50, 28);
    ctx.bezierCurveTo(66, 28, 76, 38, 79, 52);
    ctx.bezierCurveTo(74, 62, 62, 70, 50, 76);
    ctx.bezierCurveTo(38, 70, 26, 62, 21, 52);
    ctx.bezierCurveTo(24, 38, 34, 28, 50, 28);
    ctx.closePath();
  };
  face();
  paint(ctx, shade(ctx, '#f47b28', 21, 28, 79, 76));
  inside(ctx, face, () => {
    ctx.beginPath();
    ctx.moveTo(16, 52);
    ctx.bezierCurveTo(30, 52, 40, 54, 50, 62);
    ctx.bezierCurveTo(60, 54, 70, 52, 84, 52);
    ctx.lineTo(84, 90);
    ctx.lineTo(16, 90);
    ctx.closePath();
    fillOnly(ctx, lin(ctx, 0, 52, 0, 76, ['#ffffff', '#ffe8d6']));
  });
  face();
  line(ctx);
  eyes(ctx, 'oval', 40, 60, 47, 1.25);
  snout(ctx, 50, 62, 1.1);
  mouth(ctx, 'cat', 50, 66.6, 0.7);
  blush(ctx, 33, 67, 56, 3.6, 0.55);
};

const frog: Draw = ctx => {
  bust(ctx, '#4cbf4c');
  inside(ctx, () => bustPath(ctx), () => {
    ellipse(ctx, 50, 100, 20, 16);
    fillOnly(ctx, '#d9f7a0');
  });
  const c = '#5ccf4f';
  merged(ctx, [() => ellipse(ctx, 50, 58, 31, 20), () => circle(ctx, 34, 38, 11), () => circle(ctx, 66, 38, 11)], shade(ctx, c, 19, 26, 81, 78));
  gloss(ctx, 28, 31, 4, 2.2, -0.6, 0.5);
  eyes(ctx, 'big', 34, 66, 38, 1.15, { iris: '#2d6b1f' });
  ctx.fillStyle = deep(c, 0.5);
  for (const x of [46, 54]) {
    ellipse(ctx, x, 55, 1.3, 0.9);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(50, 50, 18, Math.PI * 0.18, Math.PI * 0.82);
  ctx.lineCap = 'round';
  line(ctx, lw() * 0.9);
  blush(ctx, 28, 72, 62, 4.6, 0.6);
};

const panda: Draw = ctx => {
  bust(ctx, '#f4f5fa');
  inside(ctx, () => bustPath(ctx), () => {
    for (const s of [-1, 1]) {
      ellipse(ctx, 50 + s * 38, 96, 20, 22);
      fillOnly(ctx, '#2b2838');
    }
  });
  for (const s of [-1, 1]) {
    circle(ctx, 50 + s * 20, 32, 9);
    paint(ctx, rad(ctx, 50 + s * 20, 32, 10, ['#5a5570', '#26222f'], 50 + s * 20 - 3, 29));
  }
  head(ctx, '#f6f7fb', 50, 54, 26, 23);
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 10, 52, 6.6, 8.6, s * -0.55);
    fillOnly(ctx, '#2b2838');
    circle(ctx, 50 + s * 10, 51.5, 3);
    fillOnly(ctx, '#ffffff');
    circle(ctx, 50 + s * 10 + 0.4, 52, 1.8);
    fillOnly(ctx, INK);
    circle(ctx, 50 + s * 10 - 0.6, 50.8, 0.7);
    fillOnly(ctx, '#fff');
  }
  snout(ctx, 50, 61, 0.95);
  mouth(ctx, 'cat', 50, 64.6, 0.6);
  blush(ctx, 34, 66, 63, 3.8, 0.55);
};

const cat: Draw = ctx => {
  bib(ctx, '#f39a3c');
  pointyEar(ctx, [26, 46], [24, 16], [44, 32], '#f5a04a', '#ffb3c2');
  pointyEar(ctx, [56, 32], [76, 16], [74, 46], '#f5a04a', '#ffb3c2');
  head(ctx, '#f7a24a', 50, 55, 27, 22);
  inside(ctx, () => ellipse(ctx, 50, 55, 27, 22), () => {
    ctx.fillStyle = '#d96f1c';
    for (const [x, w] of [[44, 3], [50, 3.4], [56, 3]]) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 32);
      ctx.lineTo(x + w / 2, 32);
      ctx.lineTo(x, 42);
      ctx.closePath();
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      for (const y of [50, 56]) {
        ctx.beginPath();
        ctx.moveTo(50 + s * 28, y - 2);
        ctx.lineTo(50 + s * 20, y);
        ctx.lineTo(50 + s * 28, y + 2);
        ctx.fill();
      }
    }
    ellipse(ctx, 50, 66, 11, 7.5);
    fillOnly(ctx, '#fff6ea');
  });
  eyes(ctx, 'big', 40, 60, 51, 1, { iris: '#3fbf6a', look: 0.6 });
  poly(ctx, [47.6, 60, 52.4, 60, 50, 62.6]);
  paint(ctx, '#ff7aa0', lw() * 0.6);
  mouth(ctx, 'cat', 50, 63.4, 0.7);
  whiskers(ctx, 63);
};

const tiger: Draw = ctx => {
  bib(ctx, '#ff9324');
  roundEar(ctx, 29, 34, 8, '#ff9a2a', '#ffe3c4');
  roundEar(ctx, 71, 34, 8, '#ff9a2a', '#ffe3c4');
  const hp = () => ellipse(ctx, 50, 55, 27, 23);
  head(ctx, '#ff9a2a', 50, 55, 27, 23);
  inside(ctx, hp, () => {
    ctx.fillStyle = INK;
    for (const s of [-1, 1]) {
      for (const [y, l] of [[46, 9], [53, 11], [60, 8]]) {
        ctx.beginPath();
        ctx.moveTo(50 + s * 28, y - 2.4);
        ctx.quadraticCurveTo(50 + s * (28 - l), y, 50 + s * (28 - l - 2), y + 0.6);
        ctx.quadraticCurveTo(50 + s * (28 - l), y + 1.4, 50 + s * 28, y + 2.4);
        ctx.fill();
      }
    }
    for (const [y, w] of [[34, 10], [38.5, 7], [42.5, 4]]) {
      rrect(ctx, 50 - w / 2, y, w, 2.2, 1.1);
      ctx.fill();
    }
    for (const s of [-1, 1]) {
      ellipse(ctx, 50 + s * 7, 65, 10, 8);
      fillOnly(ctx, '#fff6ea');
    }
  });
  hp();
  line(ctx);
  eyes(ctx, 'dot', 40, 60, 51, 1.05);
  snout(ctx, 50, 60, 1, '#ff7a9a');
  mouth(ctx, 'grin', 50, 64, 0.6);
  blush(ctx, 33, 67, 59, 3.4, 0.4);
};

const penguin: Draw = ctx => {
  bust(ctx, '#2b3a6b');
  inside(ctx, () => bustPath(ctx), () => {
    ellipse(ctx, 50, 100, 17, 18);
    fillOnly(ctx, '#ffffff');
  });
  // red scarf
  rrect(ctx, 30, 72, 40, 9, 4.5);
  paint(ctx, lin(ctx, 0, 72, 0, 81, ['#ff6b6b', '#d9263a']));
  rrect(ctx, 56, 76, 9, 20, 3);
  paint(ctx, lin(ctx, 0, 76, 0, 96, ['#ff6b6b', '#d9263a']));
  head(ctx, '#2f3f74', 50, 48, 25, 25);
  ctx.beginPath();
  ctx.moveTo(50, 42);
  ctx.bezierCurveTo(44, 32, 27, 36, 28, 52);
  ctx.bezierCurveTo(29, 64, 42, 70, 50, 71);
  ctx.bezierCurveTo(58, 70, 71, 64, 72, 52);
  ctx.bezierCurveTo(73, 36, 56, 32, 50, 42);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 34, 0, 71, ['#ffffff', '#e6ecf8']), lw() * 0.7);
  eyes(ctx, 'dot', 41, 59, 50, 1.05);
  ctx.beginPath();
  ctx.moveTo(43, 57);
  ctx.quadraticCurveTo(50, 54, 57, 57);
  ctx.quadraticCurveTo(54, 64, 50, 65);
  ctx.quadraticCurveTo(46, 64, 43, 57);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 55, 0, 65, ['#ffd25a', '#ff9a1a']), lw() * 0.8);
  blush(ctx, 34, 66, 58, 4, 0.6);
};

const monkey: Draw = ctx => {
  bust(ctx, '#2fa7ff');
  inside(ctx, () => bustPath(ctx), () => {
    ctx.fillStyle = '#ffd84a';
    for (let x = 0; x < 100; x += 12) {
      circle(ctx, x + 6, 92, 2.4);
      ctx.fill();
    }
  });
  roundEar(ctx, 24, 52, 9, '#9a5c34', '#ffcf9e');
  roundEar(ctx, 76, 52, 9, '#9a5c34', '#ffcf9e');
  head(ctx, '#a0613a', 50, 51, 25, 24);
  // tuft
  ctx.beginPath();
  ctx.moveTo(44, 28);
  ctx.quadraticCurveTo(46, 18, 52, 20);
  ctx.quadraticCurveTo(48, 22, 50, 27);
  ctx.quadraticCurveTo(54, 20, 59, 23);
  ctx.quadraticCurveTo(55, 25, 56, 29);
  ctx.closePath();
  paint(ctx, '#a0613a', lw() * 0.7);
  merged(ctx, [() => circle(ctx, 42, 49, 9.4), () => circle(ctx, 58, 49, 9.4), () => ellipse(ctx, 50, 62, 15, 11)], lin(ctx, 0, 40, 0, 73, ['#ffe1bf', '#f5c08f']), lw() * 0.7);
  eyes(ctx, 'dot', 42.5, 57.5, 49.5, 1);
  ctx.fillStyle = INK;
  for (const x of [47.6, 52.4]) {
    ellipse(ctx, x, 57.4, 1.1, 1.5, x < 50 ? 0.3 : -0.3);
    ctx.fill();
  }
  mouth(ctx, 'grin', 50, 62, 0.75);
};

const capybara: Draw = ctx => {
  bust(ctx, '#9b6b44');
  const c = '#b58050';
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 19, 29, 5, 4.4);
    paint(ctx, shade(ctx, deep(c, 0.1), 50 + s * 19 - 5, 25, 50 + s * 19 + 5, 33));
  }
  rrect(ctx, 27, 26, 46, 52, [21, 21, 24, 24]);
  paint(ctx, shade(ctx, c, 27, 26, 73, 78));
  rrect(ctx, 32, 50, 36, 25, 12);
  paint(ctx, shade(ctx, '#c9935e', 32, 50, 68, 75), lw() * 0.75);
  rrect(ctx, 41, 53, 18, 8, 4);
  paint(ctx, lin(ctx, 0, 53, 0, 61, ['#5a3a26', '#2e1c14']), lw() * 0.6);
  gloss(ctx, 46, 55, 2.6, 1, 0, 0.5);
  ctx.beginPath();
  ctx.moveTo(50, 61);
  ctx.lineTo(50, 65);
  ctx.moveTo(44, 66);
  ctx.quadraticCurveTo(50, 69, 56, 66);
  ctx.lineCap = 'round';
  line(ctx, lw() * 0.7);
  eyes(ctx, 'sleepy', 38, 62, 43, 1);
  blush(ctx, 32, 68, 52, 3.6, 0.4);
  // a tangerine balanced on top
  circle(ctx, 50, 18, 8.4);
  paint(ctx, rad(ctx, 50, 18, 9, ['#ffd27a', '#ff9a1a', '#e06a00'], 47, 15));
  ctx.beginPath();
  ctx.moveTo(50, 10);
  ctx.quadraticCurveTo(56, 4, 60, 8);
  ctx.quadraticCurveTo(56, 12, 50, 10);
  ctx.closePath();
  paint(ctx, '#4cbf4c', lw() * 0.6);
  gloss(ctx, 46.6, 15, 2.2, 1.4, -0.5, 0.7);
};

const owl: Draw = ctx => {
  bust(ctx, '#7a55c8');
  inside(ctx, () => bustPath(ctx), () => {
    ctx.strokeStyle = rgba('#ffffff', 0.4);
    ctx.lineWidth = lw() * 0.5;
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(26 + i * 7 + (row % 2) * 3.5, 86 + row * 6, 3.4, 0, Math.PI);
        ctx.stroke();
      }
    }
  });
  const c = '#8c63d8';
  merged(ctx, [
    () => ellipse(ctx, 50, 51, 28, 25),
    () => poly(ctx, [24, 40, 22, 20, 38, 30]),
    () => poly(ctx, [76, 40, 78, 20, 62, 30]),
  ], shade(ctx, c, 22, 20, 78, 76));
  for (const s of [-1, 1]) {
    circle(ctx, 50 + s * 11, 50, 11.5);
    paint(ctx, rad(ctx, 50 + s * 11, 50, 12, ['#ffffff', '#fff3d6', '#f2d6a8']), lw() * 0.75);
  }
  eyes(ctx, 'big', 39, 61, 50, 1.2, { iris: '#ffae1a' });
  poly(ctx, [45.6, 59, 54.4, 59, 50, 67]);
  ctx.lineJoin = 'round';
  paint(ctx, lin(ctx, 0, 59, 0, 67, ['#ffd25a', '#ff9a1a']), lw() * 0.75);
  ctx.beginPath();
  ctx.moveTo(30, 37);
  ctx.quadraticCurveTo(40, 33, 48, 40);
  ctx.moveTo(70, 37);
  ctx.quadraticCurveTo(60, 33, 52, 40);
  ctx.lineCap = 'round';
  line(ctx, lw() * 0.9);
};

const bear: Draw = ctx => {
  bust(ctx, '#ff6b6b');
  inside(ctx, () => bustPath(ctx), () => {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 86, 100, 4);
    ctx.fillRect(0, 96, 100, 4);
  });
  roundEar(ctx, 28, 33, 9, '#9a6238', '#e8b88a');
  roundEar(ctx, 72, 33, 9, '#9a6238', '#e8b88a');
  head(ctx, '#a26a3e', 50, 54, 26, 23);
  ellipse(ctx, 50, 63, 11.5, 8.4);
  paint(ctx, lin(ctx, 0, 55, 0, 72, ['#f2d1a8', '#e2b384']), lw() * 0.7);
  eyes(ctx, 'dot', 40, 60, 50, 1.05);
  snout(ctx, 50, 59.6, 1.05);
  mouth(ctx, 'smile', 50, 66.4, 0.5);
  blush(ctx, 32, 68, 59, 3.8, 0.5);
};

const bunny: Draw = ctx => {
  bust(ctx, '#b48cff');
  inside(ctx, () => bustPath(ctx), () => {
    ellipse(ctx, 50, 80, 22, 7);
    fillOnly(ctx, deep('#b48cff', 0.15));
  });
  const c = '#f5f2fb';
  // one ear up, one flopped
  ellipse(ctx, 39, 22, 7.4, 18, -0.12);
  paint(ctx, shade(ctx, c, 31, 4, 47, 40));
  ellipse(ctx, 39, 23, 3.6, 13, -0.12);
  fillOnly(ctx, '#ffb3c8');
  ellipse(ctx, 60, 24, 7, 14, 0.3);
  paint(ctx, shade(ctx, c, 52, 10, 68, 38));
  ellipse(ctx, 60.6, 25, 3.4, 9.6, 0.3);
  fillOnly(ctx, '#ffb3c8');
  ellipse(ctx, 73, 17, 6.4, 10, 1.75);
  paint(ctx, shade(ctx, c, 63, 10, 83, 24));
  ellipse(ctx, 73.6, 17.6, 2.8, 6.4, 1.75);
  fillOnly(ctx, '#ffb3c8');
  head(ctx, c, 50, 56, 24, 21);
  eyes(ctx, 'dot', 40, 60, 53, 1.05);
  snout(ctx, 50, 61, 0.8, '#ff8fb0');
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(50, 63);
  ctx.lineTo(50, 65.4);
  line(ctx, lw() * 0.6);
  rrect(ctx, 46.6, 65.4, 6.8, 5.4, [0, 0, 2, 2]);
  paint(ctx, '#ffffff', lw() * 0.6);
  ctx.beginPath();
  ctx.moveTo(50, 65.4);
  ctx.lineTo(50, 70.6);
  line(ctx, lw() * 0.45);
  mouth(ctx, 'cat', 50, 64.6, 0.62);
  blush(ctx, 33, 67, 61, 4, 0.6);
};

const axolotl: Draw = ctx => {
  bust(ctx, '#ff9ec7');
  const gill = '#e8448a';
  for (const s of [-1, 1]) {
    for (const [dy, a] of [[-10, -0.55], [0, -0.1], [10, 0.35]]) {
      const x = 50 + s * 30;
      const y = 50 + dy;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(s * a);
      ellipse(ctx, s * 7, 0, 10, 4.2);
      paint(ctx, lin(ctx, 0, -4, 0, 4, [lite(gill, 0.3), gill]), lw() * 0.8);
      ctx.fillStyle = lite(gill, 0.45);
      for (const k of [3, 7, 11]) {
        circle(ctx, s * k, -2.8, 1.6);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  head(ctx, '#ffb3d4', 50, 56, 29, 21);
  ctx.fillStyle = rgba('#ffffff', 0.5);
  for (const [x, y, r] of [[38, 42, 1.8], [62, 41, 1.4], [56, 44, 1.1], [43, 45, 1]]) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
  eyes(ctx, 'dot', 34, 66, 54, 1.1);
  ctx.beginPath();
  ctx.moveTo(40, 61);
  ctx.quadraticCurveTo(50, 69, 60, 61);
  ctx.lineCap = 'round';
  line(ctx, lw() * 0.85);
  blush(ctx, 30, 70, 62, 4.4, 0.65);
};

const raccoon: Draw = ctx => {
  bust(ctx, '#3fbf8f');
  pointyEar(ctx, [27, 44], [25, 20], [43, 32], '#8d8aa0', '#3a3548');
  pointyEar(ctx, [57, 32], [75, 20], [73, 44], '#8d8aa0', '#3a3548');
  const hp = () => ellipse(ctx, 50, 55, 27, 22);
  head(ctx, '#9a97ad', 50, 55, 27, 22);
  inside(ctx, hp, () => {
    ellipse(ctx, 50, 69, 14, 10);
    fillOnly(ctx, '#f4f2fa');
    for (const s of [-1, 1]) {
      ellipse(ctx, 50 + s * 9, 40, 6, 3);
      fillOnly(ctx, '#f4f2fa');
    }
    ctx.fillStyle = '#5c586e';
    rrect(ctx, 48.6, 30, 2.8, 12, 1.4);
    ctx.fill();
  });
  ctx.beginPath();
  ctx.moveTo(22, 50);
  ctx.bezierCurveTo(30, 42, 42, 44, 50, 49);
  ctx.bezierCurveTo(58, 44, 70, 42, 78, 50);
  ctx.bezierCurveTo(72, 59, 60, 61, 50, 56);
  ctx.bezierCurveTo(40, 61, 28, 59, 22, 50);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 44, 0, 60, ['#3a3548', '#24202f']), lw() * 0.6);
  for (const s of [-1, 1]) {
    circle(ctx, 50 + s * 11, 51.6, 3.2);
    fillOnly(ctx, '#ffffff');
    circle(ctx, 50 + s * 11 + 0.4, 52, 1.9);
    fillOnly(ctx, INK);
    circle(ctx, 50 + s * 11 - 0.5, 51, 0.7);
    fillOnly(ctx, '#ffffff');
  }
  snout(ctx, 50, 63, 1);
  mouth(ctx, 'cat', 50, 66.6, 0.6);
};

const lion: Draw = ctx => {
  bust(ctx, '#ffb62e');
  const cs: [number, number, number][] = [];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    cs.push([50 + Math.cos(a) * 28, 52 + Math.sin(a) * 27, 10]);
  }
  cs.push([50, 52, 28]);
  blobs(ctx, cs, rad(ctx, 50, 52, 40, ['#ff9a2a', '#e8641c', '#b8420e'], 40, 40));
  roundEar(ctx, 33, 34, 6.4, '#ffc24a', '#ff9a5a');
  roundEar(ctx, 67, 34, 6.4, '#ffc24a', '#ff9a5a');
  head(ctx, '#ffc853', 50, 54, 22, 21);
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 5.4, 64, 7, 5.4);
    fillOnly(ctx, '#fff1d0');
  }
  eyes(ctx, 'dot', 41, 59, 51, 1);
  snout(ctx, 50, 60, 1.25, '#a04a2a');
  mouth(ctx, 'smile', 50, 68.4, 0.55);
  blush(ctx, 35, 65, 60, 3.6, 0.45);
};

const pig: Draw = ctx => {
  bust(ctx, '#55c4ff');
  const c = '#ffa9c4';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(50 + s * 12, 34);
    ctx.lineTo(50 + s * 30, 22);
    ctx.quadraticCurveTo(50 + s * 32, 38, 50 + s * 24, 44);
    ctx.closePath();
    paint(ctx, shade(ctx, deep(c, 0.05), 50 + s * 12 - 10, 22, 50 + s * 32 + 10, 44));
  }
  head(ctx, c, 50, 55, 26, 23);
  ellipse(ctx, 50, 62, 9.4, 6.8);
  paint(ctx, lin(ctx, 0, 55, 0, 69, ['#ffc6d6', '#ff8fb0']), lw() * 0.8);
  ctx.fillStyle = '#b8406a';
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 3.4, 62, 1.6, 2.6);
    ctx.fill();
  }
  eyes(ctx, 'happy', 39, 61, 49, 1.05);
  mouth(ctx, 'smile', 50, 71.6, 0.45);
  blush(ctx, 32, 68, 58, 4.4, 0.6, '#ff5a8a');
};

/* ---------- fantasy ---------- */

const unicorn: Draw = ctx => {
  bust(ctx, '#d9c8ff');
  const rainbow = ['#ff6b8b', '#ffb03a', '#ffe14a', '#5fe08a', '#4ab6ff', '#9a7bff'];
  // mane down the back
  const mane: [number, number][] = [[64, 26], [71, 33], [75, 42], [76, 52], [74, 62], [69, 71]];
  rainbow.forEach((c, i) => {
    circle(ctx, mane[i][0], mane[i][1], 8.4);
    paint(ctx, rad(ctx, mane[i][0], mane[i][1], 9, [lite(c, 0.35), c], mane[i][0] - 3, mane[i][1] - 3), lw() * 0.8);
  });
  pointyEar(ctx, [30, 40], [30, 18], [42, 30], '#f7f2ff', '#ffb3d8');
  pointyEar(ctx, [58, 30], [70, 18], [70, 40], '#f7f2ff', '#ffb3d8');
  head(ctx, '#f8f4ff', 50, 50, 22, 24);
  ellipse(ctx, 50, 65, 14, 10);
  paint(ctx, lin(ctx, 0, 56, 0, 75, ['#ffd6ec', '#f7b0d4']), lw() * 0.75);
  // horn
  ctx.beginPath();
  ctx.moveTo(44, 30);
  ctx.lineTo(51, 2);
  ctx.lineTo(57, 30);
  ctx.closePath();
  ctx.lineJoin = 'round';
  paint(ctx, lin(ctx, 44, 4, 57, 30, ['#fff6b0', '#ffcc33', '#e89a0c']));
  ctx.beginPath();
  for (const y of [9, 16, 23]) {
    ctx.moveTo(51 - (y / 30) * 6, y + 2);
    ctx.lineTo(51 + (y / 30) * 6, y - 1);
  }
  line(ctx, lw() * 0.5);
  // forelock
  rainbow.slice(0, 3).forEach((c, i) => {
    ellipse(ctx, 36 + i * 5, 32 + i * 2, 6, 4, -0.5);
    paint(ctx, c, lw() * 0.6);
  });
  eyes(ctx, 'big', 41, 59, 48, 0.85, { iris: '#9a5cff', lash: true });
  ctx.fillStyle = '#b8406a';
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 4.4, 64, 1.2, 1.8, s * 0.3);
    ctx.fill();
  }
  mouth(ctx, 'smile', 50, 72, 0.5);
  blush(ctx, 35, 65, 57, 3.6, 0.6);
};

const dragon: Draw = ctx => {
  bust(ctx, '#3fbf6a');
  inside(ctx, () => bustPath(ctx), () => {
    ctx.fillStyle = '#ffe07a';
    rrect(ctx, 38, 78, 24, 30, 8);
    ctx.fill();
    ctx.fillStyle = rgba('#c98a1a', 0.5);
    for (const y of [86, 93, 100]) ctx.fillRect(38, y, 24, 1.6);
  });
  // horns
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(50 + s * 10, 32);
    ctx.quadraticCurveTo(50 + s * 18, 12, 50 + s * 28, 8);
    ctx.quadraticCurveTo(50 + s * 22, 20, 50 + s * 19, 34);
    ctx.closePath();
    paint(ctx, lin(ctx, 0, 8, 0, 34, ['#fff6d8', '#e8c88a']), lw() * 0.8);
  }
  // fins at the cheeks
  for (const s of [-1, 1]) {
    poly(ctx, [50 + s * 22, 44, 50 + s * 34, 38, 50 + s * 31, 48, 50 + s * 36, 52, 50 + s * 23, 58]);
    ctx.lineJoin = 'round';
    paint(ctx, '#2a9e8a', lw() * 0.8);
  }
  head(ctx, '#4fcf6f', 50, 50, 23, 21);
  // crest spikes
  for (const [x, y, h] of [[44, 31, 7], [50, 29.4, 9], [56, 31, 7]]) {
    poly(ctx, [x - 3.4, y + 1, x, y - h, x + 3.4, y + 1]);
    paint(ctx, '#ff8a3a', lw() * 0.6);
  }
  ellipse(ctx, 50, 64, 17, 11);
  paint(ctx, shade(ctx, '#7fe08a', 33, 53, 67, 75), lw() * 0.85);
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 5, 59, 1.6, 1.1, s * 0.4);
    ctx.fill();
  }
  eyes(ctx, 'big', 40, 60, 46, 0.85, { iris: '#ffb000' });
  mouth(ctx, 'fangs', 50, 66, 0.8);
  blush(ctx, 34, 66, 64, 3.4, 0.5);
};

const dino: Draw = ctx => {
  bust(ctx, '#ffcf3a');
  const c = '#3cc8b4';
  // back spikes
  for (const [x, y, r] of [[34, 30, 0.9], [50, 25, 1.05], [66, 30, 0.9], [76, 41, 0.75]]) {
    poly(ctx, [x - 6 * r, y + 5, x, y - 9 * r, x + 6 * r, y + 5]);
    ctx.lineJoin = 'round';
    paint(ctx, lin(ctx, 0, y - 9, 0, y + 5, ['#ffb24a', '#ff7a2a']), lw() * 0.8);
  }
  head(ctx, c, 50, 54, 28, 25);
  ctx.fillStyle = rgba(deep(c, 0.3), 0.45);
  for (const [x, y, r] of [[30, 46, 2.6], [34, 40, 1.6], [70, 44, 2.2], [66, 38, 1.4]]) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
  eyes(ctx, 'dot', 39, 61, 45, 1.15);
  ctx.fillStyle = INK;
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 4, 54, 1.4, 1, 0);
    ctx.fill();
  }
  // big toothy grin
  const mp = () => {
    ctx.beginPath();
    ctx.moveTo(32, 59);
    ctx.quadraticCurveTo(50, 62, 68, 59);
    ctx.quadraticCurveTo(64, 74, 50, 74);
    ctx.quadraticCurveTo(36, 74, 32, 59);
    ctx.closePath();
  };
  mp();
  fillOnly(ctx, '#6e1634');
  inside(ctx, mp, () => {
    ellipse(ctx, 52, 75, 9, 6);
    fillOnly(ctx, '#ff6f87');
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const x = 35 + i * 6;
      poly(ctx, [x, 59, x + 6, 59.4, x + 3, 64]);
      ctx.fill();
    }
  });
  mp();
  line(ctx, lw() * 0.85);
  blush(ctx, 30, 70, 60, 4, 0.5);
};

const alien: Draw = ctx => {
  bust(ctx, '#b8c4d8');
  inside(ctx, () => bustPath(ctx), () => {
    rrect(ctx, 20, 78, 60, 6, 3);
    fillOnly(ctx, '#7a5cff');
  });
  const c = '#8ef06a';
  for (const s of [-1, 1]) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(50 + s * 10, 24);
      ctx.quadraticCurveTo(50 + s * 14, 12, 50 + s * 20, 8);
    }, c, 2.4);
    circle(ctx, 50 + s * 20, 8, 4.4);
    paint(ctx, rad(ctx, 50 + s * 20, 8, 5, ['#ffffff', '#ff6bd2'], 50 + s * 20 - 1.5, 6.5), lw() * 0.7);
  }
  ctx.beginPath();
  ctx.moveTo(50, 20);
  ctx.bezierCurveTo(76, 20, 82, 42, 75, 58);
  ctx.bezierCurveTo(69, 70, 58, 78, 50, 78);
  ctx.bezierCurveTo(42, 78, 31, 70, 25, 58);
  ctx.bezierCurveTo(18, 42, 24, 20, 50, 20);
  ctx.closePath();
  paint(ctx, shade(ctx, c, 20, 20, 80, 78));
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 12, 51, 8, 11, s * -0.55);
    paint(ctx, lin(ctx, 0, 40, 0, 62, ['#3a2a5a', '#120a1c']), lw() * 0.6);
    ellipse(ctx, 50 + s * 12 - 2.4, 47, 2.4, 3.6, s * -0.55);
    fillOnly(ctx, 'rgba(255,255,255,0.85)');
    circle(ctx, 50 + s * 12 + 2, 55, 1.2);
    fillOnly(ctx, 'rgba(255,255,255,0.6)');
  }
  mouth(ctx, 'smile', 50, 72, 0.55);
  blush(ctx, 32, 68, 64, 3.6, 0.5);
};

const ghost: Draw = ctx => {
  // floating shadow
  ellipse(ctx, 50, 95, 22, 3.6);
  fillOnly(ctx, 'rgba(30,10,60,0.25)');
  const body = () => {
    ctx.beginPath();
    ctx.moveTo(20, 86);
    ctx.lineTo(20, 46);
    ctx.bezierCurveTo(20, 24, 34, 12, 50, 12);
    ctx.bezierCurveTo(66, 12, 80, 24, 80, 46);
    ctx.lineTo(80, 86);
    for (let i = 0; i < 5; i++) {
      const x = 80 - i * 12;
      ctx.quadraticCurveTo(x - 3, 92, x - 6, 86);
      ctx.quadraticCurveTo(x - 9, 80, x - 12, 86);
    }
    ctx.closePath();
  };
  // arms
  for (const s of [-1, 1]) {
    ellipse(ctx, 50 + s * 31, 58, 6, 9, s * -0.7);
    paint(ctx, '#f2eeff', lw());
  }
  body();
  paint(ctx, lin(ctx, 20, 12, 80, 92, ['#ffffff', '#f2eeff', '#c8bff0']));
  gloss(ctx, 34, 26, 7, 3, -0.6, 0.8);
  eyes(ctx, 'oval', 41, 59, 44, 1.5);
  mouth(ctx, 'open', 50, 52, 0.95);
  blush(ctx, 34, 66, 54, 4.2, 0.6);
};

const octopus: Draw = ctx => {
  const c = '#ff7a9e';
  // tentacles
  const tips: [number, number, number, number][] = [[22, 92, 12, 70], [34, 98, 30, 82], [46, 100, 42, 88], [58, 100, 60, 86], [70, 96, 74, 80], [80, 88, 90, 70]];
  for (const [x, y, cx, cy] of tips) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(50 + (x - 50) * 0.4, 62);
      ctx.quadraticCurveTo(cx, cy, x, y);
    }, lin(ctx, 0, 62, 0, 100, [c, deep(c, 0.2)]), 8);
    ctx.fillStyle = '#ffd6e2';
    circle(ctx, (x + cx) / 2 + (x < 50 ? 1.4 : -1.4), (y + cy) / 2 + 2, 1.5);
    ctx.fill();
  }
  ellipse(ctx, 50, 44, 27, 28);
  paint(ctx, shade(ctx, c, 23, 16, 77, 72));
  ctx.fillStyle = rgba(deep(c, 0.3), 0.4);
  for (const [x, y, r] of [[36, 28, 3], [44, 22, 1.8], [64, 26, 2.4], [70, 36, 1.6]]) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
  gloss(ctx, 38, 26, 6, 2.6, -0.6, 0.5);
  eyes(ctx, 'big', 40, 60, 46, 1.05, { iris: '#2f6bd8' });
  mouth(ctx, 'smile', 50, 61, 0.55);
  blush(ctx, 32, 68, 56, 4, 0.6, '#ff3a6a');
};

/* ---------- food & objects ---------- */

const pizza: Draw = ctx => {
  const slice = () => {
    ctx.beginPath();
    ctx.moveTo(16, 26);
    ctx.quadraticCurveTo(50, 18, 84, 26);
    ctx.lineTo(54, 92);
    ctx.quadraticCurveTo(50, 98, 46, 92);
    ctx.closePath();
  };
  slice();
  paint(ctx, lin(ctx, 0, 20, 0, 96, ['#fff1a0', '#ffd23f', '#f5a81c']));
  inside(ctx, slice, () => {
    for (const [x, y, r] of [[30, 36, 5.4], [70, 36, 5], [62, 66, 4.2], [38, 64, 3.6]]) {
      circle(ctx, x, y, r);
      paint(ctx, rad(ctx, x, y, r, ['#ff7a5a', '#e0342a', '#b81d1d'], x - r * 0.4, y - r * 0.4), lw() * 0.55);
      ctx.fillStyle = 'rgba(255,220,200,0.6)';
      for (const [dx, dy] of [[-1.4, -0.6], [1.6, 1.2]]) {
        circle(ctx, x + dx, y + dy, 0.7);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#3fae4a';
    for (const [x, y, a] of [[56, 34, 0.5], [44, 78, -0.4], [26, 46, 1]]) {
      ellipse(ctx, x, y, 2.6, 1.3, a);
      ctx.fill();
    }
  });
  // cheese drip
  ctx.beginPath();
  ctx.moveTo(58, 80);
  ctx.quadraticCurveTo(60, 90, 62, 88);
  ctx.quadraticCurveTo(64, 86, 62, 78);
  ctx.closePath();
  paint(ctx, '#ffd23f', lw() * 0.6);
  rrect(ctx, 12, 16, 76, 14, 7);
  paint(ctx, lin(ctx, 0, 16, 0, 30, ['#f2b06a', '#c9762e', '#a85a1e']));
  gloss(ctx, 30, 20, 9, 1.8, -0.05, 0.5);
  eyes(ctx, 'dot', 43, 57, 46, 1);
  mouth(ctx, 'grin', 50, 52, 0.6);
  blush(ctx, 37, 63, 52, 3.2, 0.6);
};

const cactus: Draw = ctx => {
  const c = '#4cc070';
  // arms
  for (const s of [-1, 1]) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(50 + s * 12, 58 - (s > 0 ? 8 : 0));
      ctx.lineTo(50 + s * 24, 58 - (s > 0 ? 8 : 0));
      ctx.lineTo(50 + s * 24, 40 - (s > 0 ? 10 : 0));
    }, lin(ctx, 0, 30, 0, 60, [lite(c, 0.2), c]), 10);
  }
  rrect(ctx, 34, 22, 32, 62, 16);
  paint(ctx, shade(ctx, c, 34, 22, 66, 84));
  ctx.beginPath();
  for (const x of [42, 58]) {
    ctx.moveTo(x, 28);
    ctx.lineTo(x, 80);
  }
  line(ctx, lw() * 0.45, rgba(deep(c, 0.35), 0.7));
  ctx.strokeStyle = '#fffbe0';
  ctx.lineWidth = lw() * 0.4;
  for (const [x, y] of [[37, 32], [63, 36], [37, 72], [63, 70], [50, 27], [26, 46], [74, 34]]) {
    ctx.beginPath();
    ctx.moveTo(x - 1.4, y - 1.4);
    ctx.lineTo(x + 1.4, y + 1.4);
    ctx.moveTo(x + 1.4, y - 1.4);
    ctx.lineTo(x - 1.4, y + 1.4);
    ctx.stroke();
  }
  // flower
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ellipse(ctx, 56 + Math.cos(a) * 4.4, 21 + Math.sin(a) * 4.4, 3.6, 2.6, a);
    paint(ctx, '#ff6fae', lw() * 0.55);
  }
  circle(ctx, 56, 21, 2.4);
  paint(ctx, '#ffd84a', lw() * 0.5);
  eyes(ctx, 'dot', 43, 57, 48, 1);
  mouth(ctx, 'smile', 50, 58, 0.6);
  blush(ctx, 38, 62, 55, 3, 0.6);
  // pot
  poly(ctx, [26, 80, 74, 80, 68, 102, 32, 102]);
  ctx.lineJoin = 'round';
  paint(ctx, lin(ctx, 26, 80, 74, 100, ['#ff9a6a', '#e0603a', '#b8442a']));
  rrect(ctx, 22, 76, 56, 9, 3);
  paint(ctx, lin(ctx, 0, 76, 0, 85, ['#ffb08a', '#e86e44']));
};

const pumpkin: Draw = ctx => {
  const c = '#ff8a1f';
  ctx.beginPath();
  ctx.moveTo(48, 30);
  ctx.quadraticCurveTo(46, 18, 54, 12);
  ctx.lineTo(58, 16);
  ctx.quadraticCurveTo(53, 22, 55, 30);
  ctx.closePath();
  paint(ctx, lin(ctx, 0, 12, 0, 30, ['#8fd06a', '#3f8a2a']), lw() * 0.8);
  for (const [x, rx] of [[28, 14], [72, 14], [38, 15], [62, 15], [50, 16]]) {
    ellipse(ctx, x, 60, rx, 30);
    paint(ctx, shade(ctx, c, x - rx, 30, x + rx, 90), lw() * 0.85);
  }
  ctx.beginPath();
  ctx.moveTo(58, 18);
  ctx.bezierCurveTo(70, 8, 80, 18, 72, 24);
  ctx.bezierCurveTo(70, 18, 64, 18, 58, 18);
  ctx.closePath();
  paint(ctx, '#5cbf4a', lw() * 0.6);
  gloss(ctx, 42, 40, 3, 6, 0.2, 0.4);
  // a friendly carved face, glowing
  const glow = lin(ctx, 0, 46, 0, 80, ['#fff6a0', '#ffd23a', '#ff9a1a']);
  for (const s of [-1, 1]) {
    poly(ctx, [50 + s * 7, 56, 50 + s * 19, 56, 50 + s * 13, 46]);
    ctx.lineJoin = 'round';
    paint(ctx, glow, lw() * 0.8);
  }
  poly(ctx, [47, 63, 53, 63, 50, 59]);
  paint(ctx, glow, lw() * 0.7);
  ctx.beginPath();
  ctx.moveTo(31, 66);
  ctx.quadraticCurveTo(50, 72, 69, 66);
  ctx.quadraticCurveTo(66, 82, 50, 83);
  ctx.quadraticCurveTo(34, 82, 31, 66);
  ctx.closePath();
  paint(ctx, glow, lw() * 0.8);
  ctx.fillStyle = c;
  for (const x of [42, 56]) {
    rrect(ctx, x, 67, 5, 5, 1);
    ctx.fill();
  }
  rrect(ctx, 48, 77, 5, 6, 1);
  ctx.fill();
};

const taco: Draw = ctx => {
  // fillings peeking out of the top
  blobs(ctx, [[22, 52, 8], [32, 40, 9], [44, 33, 9], [56, 32, 9], [68, 38, 9], [78, 50, 8]], lin(ctx, 0, 24, 0, 56, ['#b8f070', '#4cbf3a']), lw() * 0.8);
  for (const [x, y] of [[36, 38], [62, 36]]) {
    circle(ctx, x, y, 5);
    paint(ctx, rad(ctx, x, y, 5, ['#ff8a7a', '#e0342a'], x - 1.6, y - 1.6), lw() * 0.6);
  }
  ctx.fillStyle = '#ffe14a';
  for (const [x, y, a] of [[48, 30, 0.5], [26, 46, -0.4], [72, 44, 0.8]]) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    rrect(ctx, -4, -1.2, 8, 2.4, 1.2);
    paint(ctx, '#ffe14a', lw() * 0.4);
    ctx.restore();
  }
  const shell = () => {
    ctx.beginPath();
    ctx.moveTo(10, 84);
    ctx.bezierCurveTo(10, 46, 30, 34, 50, 34);
    ctx.bezierCurveTo(70, 34, 90, 46, 90, 84);
    ctx.quadraticCurveTo(50, 92, 10, 84);
    ctx.closePath();
  };
  shell();
  paint(ctx, shade(ctx, '#ffc84a', 10, 34, 90, 90));
  inside(ctx, shell, () => {
    ctx.fillStyle = rgba('#c97a1a', 0.45);
    for (const [x, y] of [[24, 70], [30, 58], [70, 60], [76, 72], [62, 80], [38, 80], [50, 44]]) {
      circle(ctx, x, y, 1.6);
      ctx.fill();
    }
  });
  gloss(ctx, 30, 46, 8, 2.4, -0.6, 0.45);
  eyes(ctx, 'dot', 41, 59, 59, 1.05);
  mouth(ctx, 'grin', 50, 65, 0.62);
  blush(ctx, 33, 67, 66, 3.6, 0.6);
};

const donut: Draw = ctx => {
  circle(ctx, 50, 54, 34);
  paint(ctx, shade(ctx, '#e8a65a', 16, 20, 84, 88));
  const icing = () => {
    ctx.beginPath();
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 28 + (i % 2 ? 3.2 : 0) + (i % 3 === 0 ? 2.4 : 0);
      const x = 50 + Math.cos(a) * r;
      const y = 52 + Math.sin(a) * r * 0.95;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const pa = ((i - 0.5) / n) * Math.PI * 2;
        ctx.quadraticCurveTo(50 + Math.cos(pa) * 26, 52 + Math.sin(pa) * 26 * 0.95, x, y);
      }
    }
    ctx.closePath();
  };
  icing();
  paint(ctx, shade(ctx, '#ff7fc0', 20, 22, 80, 84));
  inside(ctx, icing, () => {
    const cols = ['#ffffff', '#ffe14a', '#4ab6ff', '#5fe08a', '#9a7bff'];
    let k = 0;
    for (const [x, y, a] of [[30, 38, 0.6], [40, 28, -0.4], [62, 28, 0.9], [72, 40, -0.6], [76, 56, 0.3], [26, 58, -0.9], [34, 72, 0.4], [66, 72, -0.3], [56, 82, 1.1], [44, 82, -1]]) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      rrect(ctx, -2.8, -1, 5.6, 2, 1);
      ctx.fillStyle = cols[k++ % cols.length];
      ctx.fill();
      ctx.restore();
    }
  });
  gloss(ctx, 32, 32, 7, 2.6, -0.7, 0.5);
  ellipse(ctx, 50, 44, 8.4, 6);
  paint(ctx, lin(ctx, 0, 38, 0, 50, ['#8a4a1a', '#c98a4a']), lw() * 0.8);
  eyes(ctx, 'dot', 39, 61, 59, 1.05);
  mouth(ctx, 'smile', 50, 68, 0.62);
  blush(ctx, 32, 68, 66, 3.6, 0.5, '#ff3a8a');
};

const mushroom: Draw = ctx => {
  rrect(ctx, 33, 50, 34, 46, [10, 10, 16, 16]);
  paint(ctx, shade(ctx, '#fff1dc', 33, 50, 67, 96));
  const capPath = () => {
    ctx.beginPath();
    ctx.moveTo(12, 56);
    ctx.bezierCurveTo(10, 26, 32, 12, 50, 12);
    ctx.bezierCurveTo(68, 12, 90, 26, 88, 56);
    ctx.bezierCurveTo(70, 64, 30, 64, 12, 56);
    ctx.closePath();
  };
  capPath();
  paint(ctx, shade(ctx, '#ff4a4a', 12, 12, 88, 62));
  inside(ctx, capPath, () => {
    for (const [x, y, r] of [[30, 30, 6], [54, 22, 5], [72, 36, 6.4], [44, 44, 4], [20, 48, 3.4], [80, 52, 3]]) {
      ellipse(ctx, x, y, r, r * 0.86);
      fillOnly(ctx, '#ffffff');
    }
  });
  capPath();
  line(ctx);
  gloss(ctx, 28, 22, 6, 2.4, -0.7, 0.45);
  eyes(ctx, 'dot', 43, 57, 71, 1);
  mouth(ctx, 'smile', 50, 80, 0.55);
  blush(ctx, 38, 62, 78, 3.2, 0.6);
};

/* ---------- card characters ---------- */

const cardy: Draw = ctx => {
  ctx.save();
  ctx.translate(50, 54);
  ctx.rotate(-0.12);
  // waving arms
  for (const s of [-1, 1]) {
    cased(ctx, () => {
      ctx.beginPath();
      ctx.moveTo(s * 22, 8);
      ctx.quadraticCurveTo(s * 34, 2, s * 34, -10);
    }, '#ffffff', 2.6);
    circle(ctx, s * 34, -12, 4.6);
    paint(ctx, '#ffffff', lw() * 0.75);
  }
  rrect(ctx, -25, -38, 50, 76, 9);
  paint(ctx, '#ffffff');
  rrect(ctx, -21, -34, 42, 68, 6);
  fillOnly(ctx, lin(ctx, -21, -34, 21, 34, ['#ff6b5e', '#e8202f', '#b8101f']));
  ellipse(ctx, 0, 0, 16, 28, 0.5);
  fillOnly(ctx, '#ffffff');
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 10px "Unbounded", "Arial Black", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('1', -15, -26);
  gloss(ctx, -14, -20, 3, 9, 0.3, 0.3);
  ctx.translate(-50, -54);
  eyes(ctx, 'big', 42, 58, 49, 0.85, { iris: '#e8202f' });
  mouth(ctx, 'grin', 50, 57, 0.6);
  blush(ctx, 37, 63, 58, 3, 0.6);
  ctx.restore();
};

const plus4: Draw = ctx => {
  const fur = '#3a3156';
  const cs: [number, number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    cs.push([50 + Math.cos(a) * 31, 56 + Math.sin(a) * 30, 7]);
  }
  cs.push([50, 56, 31]);
  // horns in the four card colours
  const horns: [number, string][] = [[-24, '#ff4a4a'], [-9, '#ffd23f'], [9, '#3fd06b'], [24, '#3aa0ff']];
  for (const [x, c] of horns) {
    poly(ctx, [50 + x - 5.4, 30 + Math.abs(x) * 0.2, 50 + x * 1.2, 4 + Math.abs(x) * 0.35, 50 + x + 5.4, 30 + Math.abs(x) * 0.2]);
    ctx.lineJoin = 'round';
    paint(ctx, lin(ctx, 0, 4, 0, 30, [lite(c, 0.35), c]), lw() * 0.8);
  }
  blobs(ctx, cs, rad(ctx, 50, 56, 40, ['#5a4f80', fur, '#1f1a30'], 40, 42));
  eyes(ctx, 'big', 50, 50, 46, 1.6, { iris: '#ff4a8a' });
  // grin
  const mp = () => {
    ctx.beginPath();
    ctx.moveTo(34, 60);
    ctx.quadraticCurveTo(50, 64, 66, 60);
    ctx.quadraticCurveTo(62, 74, 50, 74);
    ctx.quadraticCurveTo(38, 74, 34, 60);
    ctx.closePath();
  };
  mp();
  fillOnly(ctx, '#6e1634');
  inside(ctx, mp, () => {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const x = 37 + i * 5.6;
      poly(ctx, [x, 60.4, x + 5.6, 61, x + 2.8, 65]);
      ctx.fill();
    }
  });
  mp();
  line(ctx, lw() * 0.8);
  // the "+4" badge
  rrect(ctx, 38, 78, 24, 15, 5);
  paint(ctx, '#ffffff', lw() * 0.8);
  ctx.fillStyle = INK;
  ctx.font = '900 11px "Unbounded", "Arial Black", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+4', 50, 86);
};

const wildstar: Draw = ctx => {
  const sp = () => star(ctx, 50, 54, 42, 21, 5);
  ctx.lineJoin = 'round';
  sp();
  ctx.lineWidth = lw() * 2.4;
  ctx.strokeStyle = INK;
  ctx.stroke();
  inside(ctx, sp, () => {
    const q: [number, number, string][] = [[0, 0, '#ff4a4a'], [50, 0, '#3aa0ff'], [0, 54, '#ffd23f'], [50, 54, '#3fd06b']];
    for (const [x, y, c] of q) {
      ctx.fillStyle = lin(ctx, x, y, x + 50, y + 50, [lite(c, 0.3), c, deep(c, 0.15)]);
      ctx.fillRect(x, y, 50, 50);
    }
    circle(ctx, 50, 56, 15);
    fillOnly(ctx, rgba('#ffffff', 0.35));
  });
  sp();
  ctx.lineWidth = lw() * 0.8;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();
  gloss(ctx, 40, 34, 4, 2, -0.6, 0.6);
  eyes(ctx, 'big', 43, 57, 52, 0.75, { iris: '#7a3cff' });
  mouth(ctx, 'grin', 50, 60, 0.55);
  for (const [x, y, r] of [[14, 20, 4], [86, 22, 3.2], [84, 86, 3.6]]) {
    star(ctx, x, y, r, r * 0.32, 4);
    fillOnly(ctx, '#ffffff');
  }
};

export const CREATURES: Record<string, Draw> = {
  fox, frog, panda, cat, tiger, penguin, monkey, capybara, owl, bear, bunny, axolotl, raccoon, lion, pig,
  unicorn, dragon, dino, alien, ghost, octopus,
  pizza, cactus, pumpkin, taco, donut, mushroom,
  cardy, plus4, wildstar,
};
