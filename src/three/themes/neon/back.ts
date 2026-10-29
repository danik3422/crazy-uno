import { DISPLAY, H, W, rr } from '../kit';

/**
 * The neon back: a synthwave sunset over a perspective grid, framed by a pink tube,
 * with a cyan tube-lettered UNO across it. Big, bright shapes so it still reads in a small fan.
 */
export function drawBack(ctx: CanvasRenderingContext2D) {
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = '#07030f';
  ctx.fill();
  ctx.save();
  rr(ctx, 0, 0, W, H, 30);
  ctx.clip();

  // night sky fading to a purple horizon
  const HZ = H * 0.6;
  const sky = ctx.createLinearGradient(0, 0, 0, HZ);
  sky.addColorStop(0, '#0a0420');
  sky.addColorStop(0.7, '#2a0a4a');
  sky.addColorStop(1, '#5a0f6a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, HZ);

  // the striped sun sitting on the horizon
  const SR = 86;
  const sx = W / 2;
  const sy = HZ;
  ctx.save();
  ctx.beginPath();
  ctx.arc(sx, sy, SR, Math.PI, 0);
  ctx.closePath();
  ctx.clip();
  const sun = ctx.createLinearGradient(0, sy - SR, 0, sy);
  sun.addColorStop(0, '#ffe45a');
  sun.addColorStop(0.5, '#ff7a3d');
  sun.addColorStop(1, '#ff2a8a');
  ctx.fillStyle = sun;
  ctx.fillRect(sx - SR, sy - SR, SR * 2, SR);
  // the cut-out bands get thicker toward the horizon
  ctx.fillStyle = '#2a0a4a';
  for (let i = 0, y = sy - SR * 0.42; i < 5; i++) {
    const h = 2 + i * 2.2;
    ctx.fillRect(sx - SR, y, SR * 2, h);
    y += h + 8 - i;
  }
  ctx.restore();
  // its haze
  const haze = ctx.createRadialGradient(sx, sy, SR * 0.6, sx, sy, SR * 1.7);
  haze.addColorStop(0, 'rgba(255,60,160,.35)');
  haze.addColorStop(1, 'rgba(255,60,160,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, W, HZ);

  // the ground: a magenta perspective grid
  const ground = ctx.createLinearGradient(0, HZ, 0, H);
  ground.addColorStop(0, '#1a0430');
  ground.addColorStop(1, '#05020c');
  ctx.fillStyle = ground;
  ctx.fillRect(0, HZ, W, H - HZ);
  ctx.save();
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = 8;
  ctx.strokeStyle = '#ff4fc0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -6; i <= 6; i++) {
    ctx.moveTo(W / 2 + i * 14, HZ);
    ctx.lineTo(W / 2 + i * 70, H);
  }
  for (let k = 0; k < 7; k++) {
    const y = HZ + (H - HZ) * Math.pow(k / 6, 1.8);
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.restore();
  // a bright horizon line
  ctx.save();
  ctx.shadowColor = '#ff2ea6';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#ffd0f0';
  ctx.fillRect(0, HZ - 1.5, W, 3);
  ctx.restore();

  // stars
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  const stars = [[40, 60], [200, 48], [70, 140], [222, 120], [150, 34], [30, 200], [230, 196], [110, 92]];
  for (const [x, y] of stars) ctx.fillRect(x, y, 2, 2);

  // scanlines over everything
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.5);
  ctx.restore();

  // the double tube frame: pink outside, cyan inside
  ctx.save();
  ctx.lineJoin = 'round';
  const frame = (inset: number, r: number, color: string, glow: string, width: number) => {
    rr(ctx, inset, inset, W - inset * 2, H - inset * 2, r);
    ctx.shadowColor = glow;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.lineWidth = width * 0.3;
    ctx.stroke();
  };
  frame(12, 20, '#ff3fb4', '#ff2ea6', 5);
  frame(22, 13, '#33e8ff', '#00d0ff', 2.5);
  ctx.restore();

  // UNO in cyan tube letters, tilted like a sign
  ctx.save();
  ctx.translate(W / 2, H * 0.27);
  ctx.rotate(-0.16);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 60px ${DISPLAY}`;
  ctx.lineJoin = 'round';
  // dark backing so it pops off the sun
  ctx.lineWidth = 18;
  ctx.strokeStyle = 'rgba(10,2,24,.85)';
  ctx.strokeText('UNO', 0, 0);
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 24;
  ctx.lineWidth = 9;
  ctx.strokeStyle = '#2ee6ff';
  ctx.strokeText('UNO', 0, 0);
  ctx.shadowBlur = 8;
  ctx.strokeText('UNO', 0, 0);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#e8fdff';
  ctx.fillText('UNO', 0, 0);
  ctx.restore();
}
