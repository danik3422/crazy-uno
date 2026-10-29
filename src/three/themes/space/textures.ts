import * as THREE from 'three';
import { canvasTex } from '../decorKit';
import { seeded } from '../kit';

let glow: THREE.Texture | null = null;
/** A soft white round glow (tinted by the material colour), shared by the decor and the landing effect. */
export function glowTex() {
  return (glow ??= canvasTex(128, 128, c => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }));
}

/** Gas-giant bands with a storm spot. */
export function planetTex() {
  return canvasTex(256, 128, c => {
    const rnd = seeded(3);
    const bands = ['#f2c48a', '#d9805a', '#b8503e', '#f0d2a8', '#c86a4a', '#8a3a4a', '#e8a070', '#f6dcb4'];
    let y = 0;
    while (y < 128) {
      const h = 4 + rnd() * 14;
      c.fillStyle = bands[Math.floor(rnd() * bands.length)];
      c.fillRect(0, y, 256, h + 1);
      y += h;
    }
    // soften the bands with thin wavy streaks
    for (let i = 0; i < 40; i++) {
      c.strokeStyle = `rgba(255,240,220,${0.05 + rnd() * 0.12})`;
      c.lineWidth = 1 + rnd() * 2;
      const yy = rnd() * 128;
      c.beginPath();
      for (let x = 0; x <= 256; x += 16) c.lineTo(x, yy + Math.sin(x * 0.05 + i) * 2);
      c.stroke();
    }
    c.fillStyle = 'rgba(140,40,40,.75)';
    c.beginPath();
    c.ellipse(170, 78, 18, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,200,170,.5)';
    c.beginPath();
    c.ellipse(168, 77, 9, 4, 0, 0, Math.PI * 2);
    c.fill();
  });
}

/** Concentric ring bands (RingGeometry maps its UVs flat, so circles on a square canvas line up). */
export function ringTex() {
  return canvasTex(256, 256, c => {
    const rnd = seeded(9);
    const inner = (1.9 / 3.1) * 128;
    for (let r = inner; r < 128; r += 1.5) {
      const edge = Math.min(1, (r - inner) / 6, (128 - r) / 5);
      c.strokeStyle = `rgba(255,255,255,${(0.25 + rnd() * 0.75) * edge * (r > 100 && r < 106 ? 0.15 : 1)})`;
      c.lineWidth = 1.6;
      c.beginPath();
      c.arc(128, 128, r, 0, Math.PI * 2);
      c.stroke();
    }
  });
}

/** A shooting star: a bright head on the right fading into a long tail. */
export function streakTex() {
  return canvasTex(256, 32, c => {
    const g = c.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,255,255,.55)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 16);
    c.lineTo(240, 8);
    c.arc(240, 16, 8, -Math.PI / 2, Math.PI / 2);
    c.closePath();
    c.fill();
    const h = c.createRadialGradient(240, 16, 0, 240, 16, 16);
    h.addColorStop(0, 'rgba(255,255,255,1)');
    h.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = h;
    c.fillRect(220, 0, 36, 32);
  });
}
