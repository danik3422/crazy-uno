import * as THREE from 'three';
import { HEX } from '../../../game/content';
import { drawEventIcon, drawFxShape } from '../../themes/eventIcons';
import { drawIcon } from '../../themes/icons';

/**
 * One texture with every small shape the card effects use, on an 8×8 grid.
 * Shapes are white (tinted per particle); emoji and the colour wheel keep their own colours.
 */
export const GRID = 8;
const CELL = 128;

export const CELL_ID = {
  glow: 0,
  ring: 1,
  spark: 2,
  dot: 3,
  arrow: 4,
  streak: 5,
  splat: 6,
  shock: 7,
  barrier: 8,
  drop: 9,
  shard: 10,
  swirl: 11,
  wheel: 12,
  pointer: 13,
  cardGlow: 14,
  plus: 15,
  gift: 16,
  bomb: 17,
  mask: 18,
  broom: 19,
  cloud: 20,
  tornado: 21,
  fire: 22,
  question: 23,
  bin: 24,
  skull: 25,
  // random events (three/effects/eventFx)
  evMeteor: 26,
  pumpkin: 27,
  bat: 28,
  star: 29,
  coin: 30,
  dart: 31,
  bolt: 32,
  snowball: 33,
  flake: 34,
} as const;
export type Cell = (typeof CELL_ID)[keyof typeof CELL_ID];

/** order of the colour wheel's segments, clockwise from the top (the wheel's angle 0) */
export const WHEEL_ORDER = ['red', 'yellow', 'green', 'blue'] as const;

let tex: THREE.CanvasTexture | null = null;

export function fxAtlas(): THREE.CanvasTexture {
  if (tex) return tex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = GRID * CELL;
  const ctx = cv.getContext('2d')!;
  const at = (id: number, draw: (c: CanvasRenderingContext2D) => void) => {
    ctx.save();
    ctx.translate((id % GRID) * CELL + CELL / 2, Math.floor(id / GRID) * CELL + CELL / 2);
    // keep a margin so neighbouring cells never bleed in
    ctx.beginPath();
    ctx.rect(-CELL / 2 + 2, -CELL / 2 + 2, CELL - 4, CELL - 4);
    ctx.clip();
    draw(ctx);
    ctx.restore();
  };
  const W = '#ffffff';
  const radial = (c: CanvasRenderingContext2D, stops: [number, string][], r = 60) => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
    for (const [k, col] of stops) g.addColorStop(k, col);
    c.fillStyle = g;
    c.fillRect(-64, -64, 128, 128);
  };
  const emoji = (c: CanvasRenderingContext2D, e: string, size = 92) => {
    // the cards' own drawn icons where there is one (gift, bomb, masks, broom, tornado, bin); emoji otherwise
    if (drawIcon(c, e, 0, 0, size * 0.85)) return;
    c.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(e, 0, 6);
  };

  at(CELL_ID.glow, c => radial(c, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,.45)'], [1, 'rgba(255,255,255,0)']]));
  at(CELL_ID.ring, c => radial(c, [[0.7, 'rgba(255,255,255,0)'], [0.84, 'rgba(255,255,255,1)'], [0.9, 'rgba(255,255,255,.9)'], [1, 'rgba(255,255,255,0)']]));
  at(CELL_ID.shock, c => radial(c, [[0.35, 'rgba(255,255,255,0)'], [0.8, 'rgba(255,255,255,.55)'], [0.9, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']]));
  at(CELL_ID.spark, c => {
    radial(c, [[0, 'rgba(255,255,255,.8)'], [0.3, 'rgba(255,255,255,.15)'], [1, 'rgba(255,255,255,0)']], 50);
    c.fillStyle = W;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const d = i % 2 ? 9 : 58;
      c.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    }
    c.fill();
  });
  at(CELL_ID.dot, c => radial(c, [[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 40));
  at(CELL_ID.arrow, c => {
    // a thick arc with a head, pointing clockwise
    c.strokeStyle = W;
    c.lineWidth = 18;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, 40, Math.PI * 0.95, Math.PI * 1.85);
    c.stroke();
    const a = Math.PI * 1.85;
    const x = Math.cos(a) * 40;
    const y = Math.sin(a) * 40;
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(x - 22, y - 16);
    c.lineTo(x + 26, y + 6);
    c.lineTo(x - 8, y + 30);
    c.fill();
  });
  at(CELL_ID.streak, c => {
    const g = c.createLinearGradient(-64, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.75, 'rgba(255,255,255,.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    c.ellipse(0, 0, 62, 10, 0, 0, Math.PI * 2);
    c.fill();
  });
  at(CELL_ID.splat, c => {
    c.fillStyle = W;
    c.beginPath();
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 38 + Math.sin(a * 5) * 7 + Math.sin(a * 9 + 1) * 6 + (i % 7 === 0 ? 14 : 0);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.fill();
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9 + 0.4;
      c.beginPath();
      c.arc(Math.cos(a) * 54, Math.sin(a) * 54, 4 + (i % 3) * 2, 0, Math.PI * 2);
      c.fill();
    }
  });
  at(CELL_ID.barrier, c => {
    c.strokeStyle = 'rgba(0,0,0,.45)';
    c.lineWidth = 22;
    c.beginPath();
    c.arc(0, 3, 44, 0, Math.PI * 2);
    c.moveTo(-31, 34);
    c.lineTo(31, -28);
    c.stroke();
    c.strokeStyle = W;
    c.lineWidth = 15;
    c.lineCap = 'round';
    c.beginPath();
    c.arc(0, 0, 44, 0, Math.PI * 2);
    c.moveTo(-31, 31);
    c.lineTo(31, -31);
    c.stroke();
  });
  at(CELL_ID.drop, c => {
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(0, -48);
    c.bezierCurveTo(14, -18, 30, 6, 30, 22);
    c.arc(0, 22, 30, 0, Math.PI);
    c.bezierCurveTo(-30, 6, -14, -18, 0, -48);
    c.fill();
  });
  at(CELL_ID.shard, c => {
    const g = c.createLinearGradient(-40, -50, 40, 50);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(190,220,255,.7)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-8, -56);
    c.lineTo(34, -6);
    c.lineTo(6, 56);
    c.lineTo(-30, 10);
    c.fill();
  });
  at(CELL_ID.swirl, c => {
    c.strokeStyle = W;
    c.lineCap = 'round';
    for (let arm = 0; arm < 3; arm++) {
      c.lineWidth = 9;
      c.beginPath();
      for (let i = 0; i <= 30; i++) {
        const k = i / 30;
        const a = arm * ((Math.PI * 2) / 3) + k * Math.PI * 1.6;
        c.lineTo(Math.cos(a) * (8 + k * 50), Math.sin(a) * (8 + k * 50));
      }
      c.stroke();
    }
  });
  at(CELL_ID.wheel, c => {
    // four segments clockwise from the top: red, yellow, green, blue
    WHEEL_ORDER.forEach((col, i) => {
      c.fillStyle = HEX[col];
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, 58, -Math.PI / 2 - Math.PI / 4 + (i * Math.PI) / 2, -Math.PI / 2 + Math.PI / 4 + (i * Math.PI) / 2);
      c.fill();
    });
    c.strokeStyle = W;
    c.lineWidth = 6;
    c.beginPath();
    c.arc(0, 0, 58, 0, Math.PI * 2);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 4 + (i * Math.PI) / 2 - Math.PI / 2;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 58, Math.sin(a) * 58);
      c.stroke();
    }
    c.fillStyle = W;
    c.beginPath();
    c.arc(0, 0, 11, 0, Math.PI * 2);
    c.fill();
  });
  at(CELL_ID.pointer, c => {
    c.fillStyle = 'rgba(0,0,0,.4)';
    c.beginPath();
    c.moveTo(-28, -40);
    c.lineTo(28, -40);
    c.lineTo(0, 36);
    c.fill();
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(-24, -44);
    c.lineTo(24, -44);
    c.lineTo(0, 28);
    c.fill();
  });
  at(CELL_ID.cardGlow, c => {
    c.filter = 'blur(8px)';
    c.fillStyle = W;
    c.beginPath();
    c.roundRect(-30, -46, 60, 92, 10);
    c.fill();
  });
  at(CELL_ID.plus, c => {
    c.fillStyle = W;
    c.fillRect(-11, -40, 22, 80);
    c.fillRect(-40, -11, 80, 22);
  });
  at(CELL_ID.question, c => {
    c.fillStyle = W;
    c.font = '900 104px "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('?', 0, 6);
  });
  at(CELL_ID.cloud, c => {
    c.filter = 'blur(3px)';
    c.fillStyle = W;
    for (const [x, y, r] of [[-30, 8, 26], [0, -8, 34], [30, 6, 26], [0, 16, 24]] as const) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
  });
  at(CELL_ID.gift, c => emoji(c, '🎁'));
  at(CELL_ID.bomb, c => emoji(c, '💣'));
  at(CELL_ID.mask, c => emoji(c, '🎭'));
  at(CELL_ID.broom, c => emoji(c, '🧹'));
  at(CELL_ID.tornado, c => emoji(c, '🌪️'));
  at(CELL_ID.fire, c => emoji(c, '🔥'));
  at(CELL_ID.bin, c => emoji(c, '🗑️'));
  at(CELL_ID.skull, c => emoji(c, '💀'));
  // the event effects' own pieces: drawn icons keep their colours, silhouettes are white (tinted per particle)
  at(CELL_ID.evMeteor, c => drawEventIcon(c, 'meteor', 0, 0, 100));
  at(CELL_ID.coin, c => drawEventIcon(c, 'coin', 0, 0, 100));
  at(CELL_ID.pumpkin, c => drawFxShape(c, 'pumpkin', 0, 0, 96));
  at(CELL_ID.dart, c => drawFxShape(c, 'dart', 0, 0, 100));
  at(CELL_ID.bat, c => {
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(0, -6);
    // left wing: three scallops along the bottom edge
    c.quadraticCurveTo(-20, -30, -58, -18);
    c.quadraticCurveTo(-46, -8, -44, 8);
    c.quadraticCurveTo(-36, -2, -26, 6);
    c.quadraticCurveTo(-20, -4, -10, 8);
    c.lineTo(0, 16);
    c.lineTo(10, 8);
    c.quadraticCurveTo(20, -4, 26, 6);
    c.quadraticCurveTo(36, -2, 44, 8);
    c.quadraticCurveTo(46, -8, 58, -18);
    c.quadraticCurveTo(20, -30, 0, -6);
    c.fill();
    // head with ears
    c.beginPath();
    c.moveTo(-9, -8);
    c.lineTo(-10, -24);
    c.lineTo(-4, -16);
    c.lineTo(4, -16);
    c.lineTo(10, -24);
    c.lineTo(9, -8);
    c.arc(0, -6, 9, 0, Math.PI);
    c.fill();
  });
  at(CELL_ID.star, c => {
    radial(c, [[0, 'rgba(255,255,255,.7)'], [0.35, 'rgba(255,255,255,.12)'], [1, 'rgba(255,255,255,0)']], 62);
    c.fillStyle = W;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? 17 : 42;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
  });
  at(CELL_ID.bolt, c => {
    c.fillStyle = W;
    c.beginPath();
    c.moveTo(8, -58);
    c.lineTo(-26, 6);
    c.lineTo(-2, 6);
    c.lineTo(-14, 58);
    c.lineTo(30, -12);
    c.lineTo(6, -12);
    c.lineTo(22, -58);
    c.closePath();
    c.fill();
  });

  // winter: a lumpy snowball (keeps its colours) and a white snowflake
  at(CELL_ID.snowball, c => {
    const g = c.createRadialGradient(-16, -18, 4, 0, 0, 50);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.6, '#e2eefc');
    g.addColorStop(1, '#8fb0dc');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = 44 + Math.sin(i * 2.7) * 3;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(140,175,225,.45)';
    for (const [x, y, r] of [[14, 10, 8], [-8, 22, 6], [22, -12, 5], [-20, 4, 5]]) {
      c.beginPath();
      c.arc(x, y, r, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = 'rgba(255,255,255,.95)';
    c.beginPath();
    c.ellipse(-16, -18, 11, 7, -0.6, 0, Math.PI * 2);
    c.fill();
  });
  at(CELL_ID.flake, c => {
    radial(c, [[0, 'rgba(255,255,255,.55)'], [0.4, 'rgba(255,255,255,.1)'], [1, 'rgba(255,255,255,0)']], 62);
    c.strokeStyle = W;
    c.lineCap = 'round';
    c.lineWidth = 7;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      const x = Math.cos(a);
      const y = Math.sin(a);
      c.moveTo(0, 0);
      c.lineTo(x * 46, y * 46);
      for (const [k, l] of [[0.45, 15], [0.72, 10]]) {
        for (const sg of [1, -1]) {
          const b = a + sg * 0.75;
          c.moveTo(x * 46 * k, y * 46 * k);
          c.lineTo(x * 46 * k + Math.cos(b) * l, y * 46 * k + Math.sin(b) * l);
        }
      }
    }
    c.stroke();
  });

  tex = new THREE.CanvasTexture(cv);
  // the shader writes colours as they are (no colour-space conversion), so the texture is read raw too
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  return tex;
}
