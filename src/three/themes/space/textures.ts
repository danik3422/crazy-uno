import * as THREE from 'three';
import { canvasTex } from '../decorKit';

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
