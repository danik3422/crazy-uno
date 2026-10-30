import { H, W, rr, seeded } from '../kit';
import { snowflake, snowyText } from './face';

const BERRY = '#c22a3e';

/** A tiny pine silhouette standing on (x, y), `h` tall, with snow on its tiers. */
export function pine(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, color: string, snow = true) {
  const w = h * 0.42;
  for (let i = 0; i < 3; i++) {
    const top = y - h + i * h * 0.26;
    const bw = w * (0.55 + i * 0.25);
    const bot = top + h * 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x + bw, bot);
    ctx.lineTo(x - bw, bot);
    ctx.closePath();
    ctx.fill();
    if (snow) {
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.beginPath();
      ctx.moveTo(x, top);
      ctx.lineTo(x + bw * 0.45, top + h * 0.19);
      ctx.quadraticCurveTo(x, top + h * 0.24, x - bw * 0.45, top + h * 0.19);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(x - h * 0.04, y - h * 0.06, h * 0.08, h * 0.08);
}

/** The card back: a snowy night with an aurora, pines and a lit cabin, a knitted berry rim and a frosted "UNO" with icicles. */
export function drawBack(ctx: CanvasRenderingContext2D) {
  // a knitted berry-red rim with a white nordic stitch: reads at a glance in an opponent's fan
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = BERRY;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.85)';
  const stitch = (x: number, y: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - 2.6);
    ctx.lineTo(x + 2.6, y);
    ctx.lineTo(x, y + 2.6);
    ctx.lineTo(x - 2.6, y);
    ctx.fill();
  };
  for (let x = 30; x < W - 24; x += 11) {
    stitch(x, 6.5);
    stitch(x, H - 6.5);
  }
  for (let y = 30; y < H - 24; y += 11) {
    stitch(6.5, y);
    stitch(W - 6.5, y);
  }
  ctx.restore();

  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.save();
  ctx.clip();
  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#0a1440');
  sky.addColorStop(0.55, '#1b2e78');
  sky.addColorStop(1, '#2a4a9a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const rnd = seeded(77);
  for (let i = 0; i < 46; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
    ctx.beginPath();
    ctx.arc(14 + rnd() * (W - 28), 14 + rnd() * H * 0.6, 0.6 + rnd() * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  // the aurora: three soft ribbons sweeping across the sky
  ctx.globalCompositeOperation = 'lighter';
  const ribbon = (y: number, amp: number, c1: string, c2: string, hgt: number) => {
    for (let x = 0; x < W; x += 3) {
      const yy = y + Math.sin(x * 0.028 + y) * amp + Math.sin(x * 0.07) * amp * 0.3;
      const g = ctx.createLinearGradient(0, yy - hgt, 0, yy);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.7, c1);
      g.addColorStop(1, c2);
      ctx.fillStyle = g;
      ctx.fillRect(x, yy - hgt, 3.2, hgt);
    }
  };
  ribbon(110, 18, 'rgba(60,255,170,.32)', 'rgba(170,255,220,.6)', 80);
  ribbon(150, 22, 'rgba(140,90,255,.25)', 'rgba(220,180,255,.45)', 70);
  ribbon(80, 12, 'rgba(60,200,255,.2)', 'rgba(160,230,255,.35)', 50);
  ctx.globalCompositeOperation = 'source-over';
  // snowy hills
  ctx.fillStyle = '#c9dbf6';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 96);
  ctx.quadraticCurveTo(W * 0.35, H - 136, W * 0.65, H - 100);
  ctx.quadraticCurveTo(W * 0.85, H - 80, W, H - 104);
  ctx.lineTo(W, H);
  ctx.fill();
  // pines on the far hill
  for (const [x, h] of [[26, 54], [46, 40], [W - 34, 60], [W - 58, 42], [W - 14, 36]] as const) pine(ctx, x, H - 92 - (x > W / 2 ? 0 : 10), h, '#153a4a');
  // a little cabin with warm windows
  ctx.save();
  ctx.translate(W * 0.6, H - 104);
  ctx.fillStyle = '#5a3424';
  ctx.fillRect(-20, -18, 40, 22);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-26, -16);
  ctx.lineTo(0, -36);
  ctx.lineTo(26, -16);
  ctx.closePath();
  ctx.fill();
  ctx.shadowColor = '#ffb84a';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#ffd36a';
  ctx.fillRect(-14, -12, 8, 8);
  ctx.fillRect(6, -12, 8, 8);
  ctx.restore();
  // the near drift
  const near = ctx.createLinearGradient(0, H - 70, 0, H);
  near.addColorStop(0, '#ffffff');
  near.addColorStop(1, '#d6e4fa');
  ctx.fillStyle = near;
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, H - 56);
  ctx.quadraticCurveTo(W * 0.5, H - 92, W, H - 50);
  ctx.lineTo(W, H);
  ctx.fill();
  // falling snow
  for (let i = 0; i < 16; i++) {
    const x = 18 + rnd() * (W - 36);
    const y = 24 + rnd() * (H - 60);
    if (rnd() < 0.4) snowflake(ctx, x, y, 4 + rnd() * 4, 'rgba(255,255,255,.75)', 1.3, rnd());
    else {
      ctx.fillStyle = 'rgba(255,255,255,.8)';
      ctx.beginPath();
      ctx.arc(x, y, 1.2 + rnd() * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // frame shading
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0,0,30,.25)';
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.stroke();
  ctx.restore();

  // the frosted logo: an icy oval, the snow-capped "UNO" and icicles under it
  ctx.save();
  ctx.translate(W / 2, H / 2 - 6);
  ctx.rotate(-0.42);
  ctx.beginPath();
  ctx.ellipse(0, 0, 112, 58, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(8,20,70,.55)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(230,245,255,.75)';
  ctx.stroke();
  // icicles, drawn first so the letters cover their roots
  const ir = seeded(5);
  const ice = ctx.createLinearGradient(0, 20, 0, 62);
  ice.addColorStop(0, '#ffffff');
  ice.addColorStop(1, 'rgba(160,215,255,.6)');
  ctx.fillStyle = ice;
  for (let x = -82; x <= 82; x += 9 + ir() * 6) {
    const l = 10 + ir() * 22;
    ctx.beginPath();
    ctx.moveTo(x - 4, 22);
    ctx.lineTo(x, 22 + l);
    ctx.lineTo(x + 4, 22);
    ctx.fill();
  }
  const fill = ctx.createLinearGradient(0, -30, 0, 30);
  fill.addColorStop(0, '#ffffff');
  fill.addColorStop(1, '#a9d6ff');
  ctx.shadowColor = 'rgba(140,210,255,.8)';
  ctx.shadowBlur = 14;
  snowyText(ctx, 'UNO', 64, { fill, ink: '#0b1a4a', rim: 10, snow: 0 });
  ctx.shadowColor = 'transparent';
  ctx.restore();
}
