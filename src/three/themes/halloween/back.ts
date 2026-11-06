import { H, W, rr, seeded } from '../kit';
import { bat, cornerWeb, drippyText } from './face';

const PUMPKIN = '#f07a1c';

/** A little glowing jack-o'-lantern centred at (x, y), `s` its half width. */
function jackOLantern(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 40, s / 40);
  ctx.save();
  ctx.shadowColor = 'rgba(255,140,30,.9)';
  ctx.shadowBlur = 22;
  for (const [dx, rx] of [[-20, 22], [20, 22], [-8, 26], [8, 26]] as const) {
    const g = ctx.createRadialGradient(dx - 6, -10, 3, dx, 0, 36);
    g.addColorStop(0, '#ffb04a');
    g.addColorStop(1, '#c4460a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(dx, 0, rx, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,35,0,.5)';
  ctx.lineWidth = 2;
  for (const dx of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(dx, 0, 12, 29, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#3a6b1a';
  rr(ctx, -4, -38, 8, 12, 3);
  ctx.fill();
  // the carved face, lit from inside
  ctx.fillStyle = '#fff09a';
  ctx.shadowColor = '#ffcf4a';
  ctx.shadowBlur = 10;
  for (const ex of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(ex - 8, -2);
    ctx.lineTo(ex, -14);
    ctx.lineTo(ex + 8, -2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-22, 6);
  for (let i = 0; i <= 6; i++) ctx.lineTo(-22 + i * 7.3, 6 + (i % 2 ? 6 : 0));
  ctx.quadraticCurveTo(0, 30, -22, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The card back: a haunted house on a hill under a huge moon, bats, a web, a jack-o'-lantern and a dripping "UNO". */
export function drawBack(ctx: CanvasRenderingContext2D) {
  // a pumpkin-orange rim: reads at a glance in an opponent's fan
  rr(ctx, 0, 0, W, H, 30);
  ctx.fillStyle = PUMPKIN;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rimShade = ctx.createLinearGradient(0, 0, W, H);
  rimShade.addColorStop(0, 'rgba(255,220,140,.35)');
  rimShade.addColorStop(1, 'rgba(90,20,0,.35)');
  ctx.fillStyle = rimShade;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.save();
  ctx.clip();
  // night sky
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2a0f45');
  sky.addColorStop(0.55, '#4a1a5a');
  sky.addColorStop(1, '#14061c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // stars
  const rnd = seeded(31);
  ctx.fillStyle = 'rgba(255,240,210,.8)';
  for (let i = 0; i < 26; i++) ctx.fillRect(14 + rnd() * (W - 28), 14 + rnd() * 200, 1.6, 1.6);
  // the moon with its halo
  const mx = W / 2 + 18;
  const my = 108;
  const halo = ctx.createRadialGradient(mx, my, 40, mx, my, 130);
  halo.addColorStop(0, 'rgba(255,230,150,.55)');
  halo.addColorStop(1, 'rgba(255,230,150,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, W, H);
  const moon = ctx.createRadialGradient(mx - 16, my - 16, 6, mx, my, 62);
  moon.addColorStop(0, '#fffbe0');
  moon.addColorStop(1, '#f2cf7a');
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(mx, my, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,150,70,.25)';
  for (const [cx, cy, r] of [[-18, -10, 12], [20, 16, 9], [4, -30, 6], [-8, 26, 7]]) {
    ctx.beginPath();
    ctx.arc(mx + cx, my + cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // bats across the moon
  ctx.fillStyle = '#12061a';
  bat(ctx, mx - 30, my + 6, 20, -0.15);
  bat(ctx, mx + 34, my - 26, 13, 0.2);
  bat(ctx, mx - 70, my - 50, 10, -0.3);
  // the hill and the haunted house
  ctx.fillStyle = '#0c0412';
  ctx.beginPath();
  ctx.moveTo(0, H);
  ctx.lineTo(0, 300);
  ctx.quadraticCurveTo(70, 268, 140, 282);
  ctx.quadraticCurveTo(210, 296, W, 286);
  ctx.lineTo(W, H);
  ctx.fill();
  ctx.save();
  ctx.translate(150, 286);
  ctx.beginPath();
  // main block, roof, tower
  ctx.rect(-38, -54, 66, 58);
  ctx.moveTo(-46, -52);
  ctx.lineTo(-5, -92);
  ctx.lineTo(36, -52);
  ctx.rect(26, -96, 26, 100);
  ctx.moveTo(22, -94);
  ctx.lineTo(39, -134);
  ctx.lineTo(56, -94);
  ctx.rect(-12, -110, 8, 30);
  ctx.fill();
  // lit windows
  ctx.fillStyle = '#ffc63a';
  ctx.shadowColor = '#ffb020';
  ctx.shadowBlur = 8;
  for (const [x, y, w, h] of [[-28, -42, 12, 14], [-2, -42, 12, 14], [33, -78, 12, 16], [-12, -16, 14, 20], [33, -44, 12, 14]]) ctx.fillRect(x, y, w, h);
  ctx.beginPath();
  ctx.arc(-5, -70, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // a crooked dead tree on the left
  ctx.strokeStyle = '#0c0412';
  ctx.lineCap = 'round';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(40, 300);
  ctx.quadraticCurveTo(46, 260, 34, 228);
  ctx.stroke();
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(38, 246);
  ctx.quadraticCurveTo(58, 236, 70, 214);
  ctx.moveTo(35, 232);
  ctx.quadraticCurveTo(22, 220, 18, 204);
  ctx.moveTo(60, 228);
  ctx.lineTo(74, 230);
  ctx.stroke();
  // a web in the top-left corner
  cornerWeb(ctx, 12, 12, 1, 1, 104, 'rgba(240,230,255,.45)', 1.5);
  // a dangling spider
  ctx.strokeStyle = 'rgba(240,230,255,.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(70, 12);
  ctx.lineTo(70, 74);
  ctx.stroke();
  ctx.fillStyle = '#0c0412';
  ctx.beginPath();
  ctx.arc(70, 80, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#0c0412';
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
    ctx.beginPath();
    ctx.moveTo(70, 80);
    ctx.quadraticCurveTo(70 + s * 10, 72 + k * 5, 70 + s * 13, 84 + k * 5);
    ctx.stroke();
  }
  // a jack-o'-lantern at the foot
  ctx.restore();
  ctx.save();
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.clip();
  jackOLantern(ctx, 62, 330, 34);
  ctx.restore();

  // the dripping logo, tilted like the classic one
  ctx.save();
  ctx.translate(W / 2, H / 2 + 14);
  ctx.rotate(-0.32);
  const g = ctx.createLinearGradient(0, -34, 0, 30);
  g.addColorStop(0, '#d6ff7a');
  g.addColorStop(1, '#4fd12a');
  ctx.shadowColor = 'rgba(120,255,70,.85)';
  ctx.shadowBlur = 20;
  drippyText(ctx, 'UNO', 66, { fill: g, ink: '#1a0626', rim: 11, seed: 77, drops: 4 });
  ctx.restore();
  // the inner edge
  rr(ctx, 12, 12, W - 24, H - 24, 20);
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(40,8,20,.7)';
  ctx.stroke();
}
