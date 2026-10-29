import * as THREE from 'three';
import { canvasTex } from '../decorKit';

let glow: THREE.Texture | null = null;
/** a soft round glow, white (tinted by the material), shared by every neon sprite */
export function glowTex() {
  return (glow ??= canvasTex(128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.55)');
    g.addColorStop(0.5, 'rgba(255,255,255,.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
  }));
}

let laser: THREE.Texture | null = null;
/** a laser beam: a hot core across its width, fading in from the source and out toward the floor */
export function laserTex() {
  return (laser ??= canvasTex(32, 128, (c) => {
    const across = c.createLinearGradient(0, 0, 32, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.42, 'rgba(255,255,255,.5)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(0.58, 'rgba(255,255,255,.5)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = across;
    c.fillRect(0, 0, 32, 128);
    // canvas y=0 is the top of the texture = the far end (v = 1, the floor)
    c.globalCompositeOperation = 'destination-in';
    const along = c.createLinearGradient(0, 0, 0, 128);
    along.addColorStop(0, 'rgba(0,0,0,.9)');
    along.addColorStop(0.7, 'rgba(0,0,0,.6)');
    along.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = along;
    c.fillRect(0, 0, 32, 128);
  }));
}
