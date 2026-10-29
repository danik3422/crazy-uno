import { DISPLAY, H, W, backFrame, rr, seeded } from '../kit';

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

/** Two little constellations, stars joined by thin lines. */
const CONSTELLATIONS: [number, number][][] = [
  [[34, 40], [62, 62], [58, 98], [88, 112], [104, 84]],
  [[150, 300], [178, 318], [206, 304], [222, 336], [196, 352]],
];

/** The card back: a deep-space nebula, constellations, a big orbit and a round UNO mission patch with a ringed planet. */
export function drawBack(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.5, 10, W / 2, H / 2, H * 0.62);
  bg.addColorStop(0, '#2a1a6a');
  bg.addColorStop(0.55, '#110a36');
  bg.addColorStop(1, '#04030e');
  backFrame(ctx, '#e6eaff', bg);

  ctx.save();
  rr(ctx, 13, 13, W - 26, H - 26, 20);
  ctx.clip();
  // nebula clouds
  ctx.globalCompositeOperation = 'lighter';
  blob(ctx, W * 0.1, H * 0.15, 130, '#c03aff', 0.45);
  blob(ctx, W * 0.95, H * 0.85, 150, '#2ab8ff', 0.45);
  blob(ctx, W * 0.85, H * 0.12, 80, '#ff5a8a', 0.25);
  blob(ctx, W * 0.1, H * 0.92, 90, '#3affd0', 0.2);
  ctx.globalCompositeOperation = 'source-over';
  // stars
  const rnd = seeded(11);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 90; i++) {
    const x = 13 + rnd() * (W - 26);
    const y = 13 + rnd() * (H - 26);
    const s = rnd();
    ctx.globalAlpha = 0.35 + rnd() * 0.65;
    ctx.beginPath();
    ctx.arc(x, y, s * 1.6 + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // constellations
  ctx.strokeStyle = 'rgba(170,210,255,.55)';
  ctx.lineWidth = 1.2;
  for (const c of CONSTELLATIONS) {
    ctx.beginPath();
    c.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    for (const [x, y] of c) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 6, y - 0.6, 12, 1.2);
      ctx.fillRect(x - 0.6, y - 6, 1.2, 12);
    }
  }
  // a big tilted orbit, the space version of the UNO oval
  ctx.translate(W / 2, H / 2);
  ctx.rotate(-0.42);
  ctx.strokeStyle = 'rgba(120,220,255,.7)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(0, 0, 96, 168, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9ff0ff';
  ctx.beginPath();
  ctx.arc(0, -168, 6, 0, Math.PI * 2);
  ctx.arc(0, 168, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // the mission patch
  ctx.save();
  ctx.translate(W / 2, H / 2);
  const R = 80;
  ctx.shadowColor = 'rgba(0,0,0,.55)';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, 0, R + 9, 0, Math.PI * 2);
  const rim = ctx.createLinearGradient(-R, -R, R, R);
  rim.addColorStop(0, '#fff2b8');
  rim.addColorStop(0.5, '#ffc444');
  rim.addColorStop(1, '#b86a10');
  ctx.fillStyle = rim;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  const sky = ctx.createRadialGradient(0, -20, 5, 0, 0, R);
  sky.addColorStop(0, '#2a3a9a');
  sky.addColorStop(1, '#070a2a');
  ctx.fillStyle = sky;
  ctx.fillRect(-R, -R, R * 2, R * 2);
  // a ringed planet rising behind the logo
  const pl = ctx.createRadialGradient(18, 14, 4, 30, 40, 70);
  pl.addColorStop(0, '#ffd2a0');
  pl.addColorStop(0.5, '#ff6a4a');
  pl.addColorStop(1, '#5a1a6a');
  ctx.fillStyle = pl;
  ctx.beginPath();
  ctx.arc(34, 46, 58, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(34, 46);
  ctx.rotate(-0.35);
  ctx.strokeStyle = 'rgba(255,236,200,.85)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(0, 0, 92, 18, 0, Math.PI * 1.04, Math.PI * 1.96);
  ctx.stroke();
  ctx.restore();
  const r2 = seeded(5);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 18; i++) {
    ctx.globalAlpha = 0.5 + r2() * 0.5;
    ctx.beginPath();
    ctx.arc(-R + r2() * R * 1.4, -R + r2() * R, r2() * 1.4 + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = '#7a4a08';
  ctx.beginPath();
  ctx.arc(0, 0, R, 0, Math.PI * 2);
  ctx.stroke();
  // four stars on the rim
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 2;
    star(ctx, Math.cos(a) * (R + 4.5), Math.sin(a) * (R + 4.5), 5.5);
  }
  // UNO
  ctx.rotate(-0.22);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 58px ${DISPLAY}`;
  ctx.lineJoin = 'round';
  ctx.shadowColor = '#5ad8ff';
  ctx.shadowBlur = 16;
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#0a0a2a';
  ctx.strokeText('UNO', 0, 2);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('UNO', 0, 2);
  ctx.restore();
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const d = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fill();
}
