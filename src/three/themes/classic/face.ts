import { HEX, SPECIAL } from '../../../game/content';
import type { Card } from '../../../game/types';
import {
  ARROW_ICONS, BODY, DISPLAY, EDGE, H, W, drawArrowIcon, drawEmoji, hasLabel, isEmoji, oval, rr, shade, symbolOf,
  type ArrowIcon,
} from '../kit';

const QUADS = ['red', 'yellow', 'green', 'blue'] as const;
/** wildRev4 has the reverse symbol: draw it with the real arrows, not a font glyph */
const arrowOf = (card: Card): ArrowIcon | null =>
  ARROW_ICONS.includes(card.type) ? (card.type as ArrowIcon) : card.type === 'wildRev4' ? 'rev' : null;

/** Skip as real shapes (the font's ⊘ is thin and small): a thick ring with a bar. Skip-all adds a ring of
 * eight segments around it, one for every player, so the two cards never look alike. */
function skipPaths(r: number, all: boolean): { p: Path2D; rule: CanvasFillRule }[] {
  const R = all ? r * 0.62 : r * 0.8;
  const t = R * 0.26;
  const ring = new Path2D();
  ring.arc(0, 0, R, 0, Math.PI * 2);
  ring.moveTo(R - t, 0);
  ring.arc(0, 0, R - t, 0, Math.PI * 2, true);
  const bar = new Path2D();
  const c = Math.cos(-Math.PI / 4);
  const sn = Math.sin(-Math.PI / 4);
  const L = R - t * 0.5;
  const w = t * 0.5;
  const pt = (x: number, y: number): [number, number] => [x * c - y * sn, x * sn + y * c];
  bar.moveTo(...pt(-L, -w));
  bar.lineTo(...pt(L, -w));
  bar.lineTo(...pt(L, w));
  bar.lineTo(...pt(-L, w));
  bar.closePath();
  const out: { p: Path2D; rule: CanvasFillRule }[] = [{ p: ring, rule: 'evenodd' }, { p: bar, rule: 'nonzero' }];
  if (all) {
    const r0 = r * 0.8;
    const r1 = r * 0.98;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const seg = new Path2D();
      seg.arc(0, 0, r1, a - 0.24, a + 0.24);
      seg.arc(0, 0, r0, a + 0.24, a - 0.24, true);
      seg.closePath();
      out.push({ p: seg, rule: 'nonzero' });
    }
  }
  return out;
}

/** draws the skip icon in layers like the numbers: optional extrusion, rim, fill */
function drawSkip(
  ctx: CanvasRenderingContext2D, all: boolean, r: number,
  o: { fill: string | CanvasGradient; rim: string; rimW: number; deep?: string; depth?: number },
) {
  const paths = skipPaths(r, all);
  ctx.save();
  ctx.lineJoin = 'round';
  const solid = (color: string | CanvasGradient, rim: number) => {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = rim * 2;
    for (const { p, rule } of paths) {
      if (rim > 0) ctx.stroke(p);
      ctx.fill(p, rule);
    }
  };
  for (let k = o.depth ?? 0; k >= 1; k--) {
    ctx.save();
    ctx.translate(k * 0.8, k * 1.1);
    solid(o.deep!, o.rimW);
    ctx.restore();
  }
  solid(o.rim, o.rimW);
  solid(o.fill, 0);
  ctx.restore();
}

/** Fine diagonal print lines over the colour field: you feel them more than see them. */
function printTexture(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let x = -H; x < W; x += 7) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x + H, H);
  }
  ctx.stroke();
  ctx.restore();
}

/** Text with a short solid extrusion toward the bottom-right, a thick rim, a lit bevel and a gradient fill. */
function chunkyText(
  ctx: CanvasRenderingContext2D, s: string, size: number,
  o: { fill: string | CanvasGradient; rim: string; deep: string; rimW: number; depth: number; bevel: string },
) {
  ctx.font = `900 ${size}px ${DISPLAY}`;
  ctx.lineWidth = o.rimW;
  ctx.strokeStyle = o.deep;
  ctx.fillStyle = o.deep;
  for (let k = o.depth; k >= 1; k--) {
    ctx.strokeText(s, k * 0.8, k * 1.1);
    ctx.fillText(s, k * 0.8, k * 1.1);
  }
  ctx.strokeStyle = o.rim;
  ctx.strokeText(s, 0, 0);
  // a light sliver on the top-left edge of each glyph, left visible by the fill drawn just below it
  ctx.lineWidth = 4;
  ctx.strokeStyle = o.bevel;
  ctx.strokeText(s, -1.6, -2);
  ctx.fillStyle = o.fill;
  ctx.fillText(s, 0, 0);
}

/**
 * The classic face, game-show polished: white frame, printed colour field, a bevelled tilted oval,
 * an extruded glossy symbol, crisp corner indices and a soft sheen across the whole card.
 */
export function drawFace(ctx: CanvasRenderingContext2D, card: Card) {
  const wild = card.color === 'wild';
  const col = wild ? HEX.black : HEX[card.color as keyof typeof HEX];
  const ink = wild ? '#060608' : shade(col, -0.5);
  const deep = wild ? '#000' : shade(col, -0.62);

  // the frame, edge to edge (the 3D card cuts its own outline): pearly white, a touch warmer at the bottom
  const frame = ctx.createLinearGradient(0, 0, W * 0.3, H);
  frame.addColorStop(0, '#ffffff');
  frame.addColorStop(1, '#f1ebdd');
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, W, H);

  // the colour field
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, W, H);
  if (wild) {
    // a black field with the four colours glowing faintly from its corners
    const spots: [number, number, string][] = [[0, 0, HEX.red], [W, 0, HEX.blue], [0, H, HEX.yellow], [W, H, HEX.green]];
    for (const [x, y, c] of spots) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, 170);
      g.addColorStop(0, c + '66');
      g.addColorStop(1, c + '00');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }
  const light = ctx.createRadialGradient(W * 0.18, H * 0.1, 8, W * 0.4, H * 0.4, H * 0.9);
  light.addColorStop(0, 'rgba(255,255,255,.32)');
  light.addColorStop(0.4, 'rgba(255,255,255,.05)');
  light.addColorStop(1, 'rgba(0,0,0,.26)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, W, H);
  printTexture(ctx, wild ? 0.035 : 0.06);
  // embossed rim: a soft inner shadow and a thin light line just inside it
  ctx.lineWidth = 12;
  ctx.strokeStyle = 'rgba(0,0,0,.2)';
  rr(ctx, 13, 13, W - 26, H - 26, 21);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  rr(ctx, 19, 19, W - 38, H - 38, 16);
  ctx.stroke();
  ctx.restore();

  // the tilted oval, bevelled
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(0.42);
  ctx.shadowColor = 'rgba(0,0,0,.38)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 6;
  oval(ctx);
  ctx.fillStyle = wild ? '#000' : '#fff';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  oval(ctx);
  ctx.clip();
  if (wild) {
    QUADS.forEach((q, i) => {
      const a0 = -Math.PI / 2 + (i * Math.PI) / 2;
      const mid = a0 + Math.PI / 4;
      const g = ctx.createRadialGradient(Math.cos(mid) * 40, Math.sin(mid) * 70, 4, 0, 0, 170);
      g.addColorStop(0, shade(HEX[q], 0.25));
      g.addColorStop(1, shade(HEX[q], -0.15));
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 200, a0, a0 + Math.PI / 2);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    });
    // thin black seams between the quarters
    ctx.strokeStyle = 'rgba(0,0,0,.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -160);
    ctx.lineTo(0, 160);
    ctx.moveTo(-100, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();
  } else {
    const og = ctx.createRadialGradient(-20, -40, 10, 0, 0, 160);
    og.addColorStop(0, '#ffffff');
    og.addColorStop(0.75, '#f6f1e6');
    og.addColorStop(1, '#ddd3bf');
    ctx.fillStyle = og;
    ctx.fillRect(-120, -170, 240, 340);
  }
  // bevel: dark inside the lower-right rim, a gloss crescent on the upper-left
  ctx.lineWidth = 10;
  ctx.strokeStyle = wild ? 'rgba(0,0,0,.35)' : 'rgba(80,60,30,.12)';
  ctx.beginPath();
  ctx.ellipse(3, 5, 84, 150, 0, 0, Math.PI * 2);
  ctx.stroke();
  const gloss = ctx.createLinearGradient(-70, -150, 20, 10);
  gloss.addColorStop(0, `rgba(255,255,255,${wild ? 0.42 : 0.9})`);
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.ellipse(-22, -52, 52, 92, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // a crisp edge in the card's own darker colour
  ctx.lineWidth = 2;
  ctx.strokeStyle = wild ? 'rgba(255,255,255,.35)' : shade(col, -0.25);
  oval(ctx);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';

  const sym = symbolOf(card);
  const arrow = arrowOf(card);
  const skip = card.type === 'skip' || card.type === 'skipAll';
  const all = card.type === 'skipAll';
  const emoji = !arrow && !skip && isEmoji(sym);
  const label = hasLabel(card);

  // the big centre symbol
  ctx.save();
  ctx.translate(W / 2, H / 2 + 6);
  if (arrow) {
    ctx.rotate(-0.12);
    const g = ctx.createLinearGradient(0, -70, 0, 70);
    g.addColorStop(0, wild ? '#ffffff' : shade(col, 0.2));
    g.addColorStop(1, wild ? '#e9e4da' : shade(col, -0.06));
    for (let k = 5; k >= 1; k--) {
      ctx.save();
      ctx.translate(k * 0.8, k * 1.1);
      drawArrowIcon(ctx, arrow, 66, { fill: deep, rim: deep, rimWidth: 6 });
      ctx.restore();
    }
    drawArrowIcon(ctx, arrow, 66, { fill: g, rim: ink, rimWidth: wild ? 7 : 6 });
  } else if (skip) {
    const g = ctx.createLinearGradient(0, -70, 0, 70);
    g.addColorStop(0, wild ? '#ffffff' : shade(col, 0.2));
    g.addColorStop(1, wild ? '#e9e4da' : shade(col, -0.06));
    drawSkip(ctx, all, 70, { fill: g, rim: ink, rimW: 6, deep, depth: 5 });
  } else if (emoji) {
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 6;
    drawEmoji(ctx, sym, 0, 0, 108);
  } else {
    const size = sym.length > 2 ? 70 : sym.length > 1 ? 94 : 132;
    const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5);
    if (wild) {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#ebe5d8');
    } else {
      g.addColorStop(0, shade(col, 0.22));
      g.addColorStop(0.55, col);
      g.addColorStop(1, shade(col, -0.1));
    }
    chunkyText(ctx, sym, size, {
      fill: g, rim: ink, deep, rimW: wild ? 13 : 10, depth: 6,
      bevel: wild ? 'rgba(255,255,255,.5)' : shade(col, 0.55),
    });
  }
  ctx.restore();

  // corner indices: white with a dark rim and a small drop, readable when cards overlap in a fan
  const corner = (x: number, y: number, rot: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    if (arrow) {
      drawArrowIcon(ctx, arrow, 20, { fill: EDGE, rim: ink, rimWidth: 4, shadow: deep, shadowOffset: [1.5, 2.5] });
    } else if (skip) {
      drawSkip(ctx, all, all ? 22 : 19, { fill: EDGE, rim: ink, rimW: 3.5, deep, depth: 2 });
    } else if (emoji) {
      // a light disc keeps a small emoji readable on any field, the black of a wild too
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,253,246,.92)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = ink;
      ctx.stroke();
      drawEmoji(ctx, sym, 0, 0, 32);
    } else {
      ctx.font = `900 ${sym.length > 2 ? 25 : sym.length > 1 ? 31 : 42}px ${DISPLAY}`;
      ctx.lineWidth = 7;
      ctx.strokeStyle = deep;
      ctx.strokeText(sym, 1.5, 2.5);
      ctx.fillStyle = deep;
      ctx.fillText(sym, 1.5, 2.5);
      ctx.strokeStyle = ink;
      ctx.strokeText(sym, 0, 0);
      ctx.fillStyle = EDGE;
      ctx.fillText(sym, 0, 0);
    }
    ctx.restore();
  };
  corner(46, 52, 0);
  if (label) {
    const text = SPECIAL[card.type as keyof typeof SPECIAL].name.toUpperCase();
    let size = 28;
    ctx.font = `800 ${size}px ${BODY}`;
    const wText = ctx.measureText(text).width;
    if (wText > 196) {
      size = Math.floor((size * 196) / wText);
      ctx.font = `800 ${size}px ${BODY}`;
    }
    const tw = Math.min(196, wText) + 26;
    // a dark pill under the name, like a lower-third caption
    rr(ctx, W / 2 - tw / 2, H - 44 - 20, tw, 40, 20);
    ctx.fillStyle = 'rgba(0,0,0,.32)';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = ink;
    ctx.strokeText(text, W / 2, H - 43);
    ctx.fillStyle = EDGE;
    ctx.fillText(text, W / 2, H - 43);
  } else corner(W - 46, H - 52, Math.PI);

  // a soft diagonal sheen across the whole card, like light on a laminated finish
  const sheen = ctx.createLinearGradient(0, 0, W, H);
  sheen.addColorStop(0.18, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.3, 'rgba(255,255,255,.13)');
  sheen.addColorStop(0.36, 'rgba(255,255,255,.04)');
  sheen.addColorStop(0.42, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, W, H);
}
