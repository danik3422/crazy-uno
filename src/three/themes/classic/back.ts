import { DISPLAY, EDGE, H, W, oval, rr } from '../kit';

/**
 * The classic back, polished: a black field with faint game-show sunburst rays, a glossy bevelled red oval
 * and the yellow UNO logo with a solid black extrusion. High contrast, so it reads in a tiny opponent fan.
 */
export function drawBack(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = EDGE;
  ctx.fillRect(0, 0, W, H);

  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.save();
  ctx.clip();
  const field = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, H * 0.62);
  field.addColorStop(0, '#2a2a31');
  field.addColorStop(1, '#0b0b0e');
  ctx.fillStyle = field;
  ctx.fillRect(0, 0, W, H);
  // sunburst rays from the centre, barely lighter than the black
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  ctx.fillStyle = 'rgba(255,255,255,.045)';
  ctx.beginPath();
  const N = 28;
  for (let i = 0; i < N; i += 2) {
    const a0 = (i / N) * Math.PI * 2;
    const a1 = ((i + 1) / N) * Math.PI * 2;
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a0) * 300, Math.sin(a0) * 300);
    ctx.lineTo(Math.cos(a1) * 300, Math.sin(a1) * 300);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
  // top-left light and an embossed rim, the same as the faces so a fan of backs matches them
  const light = ctx.createRadialGradient(W * 0.18, H * 0.1, 8, W * 0.4, H * 0.4, H * 0.9);
  light.addColorStop(0, 'rgba(255,255,255,.16)');
  light.addColorStop(1, 'rgba(0,0,0,.25)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,.1)';
  rr(ctx, 19, 19, W - 38, H - 38, 16);
  ctx.stroke();
  ctx.restore();

  // the red oval: deep shadow, a domed radial fill, a bevel and a gloss crescent
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  ctx.shadowColor = 'rgba(0,0,0,.6)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  oval(ctx);
  const red = ctx.createRadialGradient(-18, -36, 10, 0, 0, 165);
  red.addColorStop(0, '#ff6a52');
  red.addColorStop(0.55, '#e3271c');
  red.addColorStop(1, '#a3110b');
  ctx.fillStyle = red;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  oval(ctx);
  ctx.clip();
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(70,0,0,.35)';
  ctx.beginPath();
  ctx.ellipse(4, 6, 84, 150, 0, 0, Math.PI * 2);
  ctx.stroke();
  const gloss = ctx.createLinearGradient(-70, -150, 10, 0);
  gloss.addColorStop(0, 'rgba(255,255,255,.55)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(-24, -56, 50, 88, 0, 0, Math.PI * 2);
  ctx.fill();
  // a little reflected light on the lower-right rim
  const bounce = ctx.createLinearGradient(40, 150, 20, 60);
  bounce.addColorStop(0, 'rgba(255,170,140,.35)');
  bounce.addColorStop(1, 'rgba(255,170,140,0)');
  ctx.fillStyle = bounce;
  ctx.beginPath();
  ctx.ellipse(30, 100, 40, 60, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,140,120,.7)';
  oval(ctx);
  ctx.stroke();
  ctx.restore();

  // the logo: black extrusion, thick black rim, a lit bevel, a yellow gradient
  ctx.save();
  ctx.translate(W / 2, H / 2 + 4);
  ctx.rotate(-0.42);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.font = `900 66px ${DISPLAY}`;
  ctx.lineWidth = 11;
  ctx.fillStyle = ctx.strokeStyle = '#000';
  for (let k = 6; k >= 1; k--) {
    ctx.strokeText('UNO', k * 0.8, k * 1.2);
    ctx.fillText('UNO', k * 0.8, k * 1.2);
  }
  ctx.strokeStyle = '#0d0d10';
  ctx.strokeText('UNO', 0, 0);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fff6c2';
  ctx.strokeText('UNO', -1.6, -2);
  const y = ctx.createLinearGradient(0, -30, 0, 30);
  y.addColorStop(0, '#fff07a');
  y.addColorStop(0.5, '#ffd21f');
  y.addColorStop(1, '#f59d00');
  ctx.fillStyle = y;
  ctx.fillText('UNO', 0, 0);
  ctx.restore();

  // the same laminated sheen as the faces
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.18, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.3, 'rgba(255,255,255,.1)');
  sheen.addColorStop(0.36, 'rgba(255,255,255,.03)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
}
