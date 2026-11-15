import * as THREE from 'three';
import { canvasTex } from '../decorKit';

/** A bat drawn once (both wings); each wing quad shows one half of it. */
export const batTexture = () =>
  canvasTex(128, 64, ctx => {
    ctx.fillStyle = '#0d0410';
    ctx.translate(64, 30);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(-26, -26, -62, -8);
    ctx.quadraticCurveTo(-46, -2, -42, 14);
    ctx.quadraticCurveTo(-30, 2, -20, 14);
    ctx.quadraticCurveTo(-10, 2, 0, 12);
    ctx.quadraticCurveTo(10, 2, 20, 14);
    ctx.quadraticCurveTo(30, 2, 42, 14);
    ctx.quadraticCurveTo(46, -2, 62, -8);
    ctx.quadraticCurveTo(26, -26, 0, -6);
    ctx.fill();
    // body and ears
    ctx.beginPath();
    ctx.ellipse(0, 2, 7, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-6, -6);
    ctx.lineTo(-5, -18);
    ctx.lineTo(0, -9);
    ctx.lineTo(5, -18);
    ctx.lineTo(6, -6);
    ctx.fill();
    ctx.fillStyle = '#ffcf4a';
    ctx.fillRect(-4, -4, 2.6, 2.6);
    ctx.fillRect(1.6, -4, 2.6, 2.6);
  });

/**
 * One wing: a quad hinged at the body (x = 0) reaching out to x = 1, showing the right half of the bat.
 * The left wing is the same quad mirrored (scale.x = -1), so a bat is two instances that flap about the body.
 */
export function wingGeometry() {
  const g = new THREE.PlaneGeometry(1, 1);
  g.translate(0.5, 0, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 0.5 + uv.getX(i) * 0.5);
  return g;
}

/** Gives every vertex of `g` a colour from `f(x, y, z)`; returns a non-indexed copy ready to merge. */
export function paintVertices(g: THREE.BufferGeometry, f: (x: number, y: number, z: number, out: THREE.Color) => void) {
  const src = g.index ? g.toNonIndexed() : g;
  const p = src.attributes.position;
  const arr = new Float32Array(p.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    f(p.getX(i), p.getY(i), p.getZ(i), c);
    c.toArray(arr, i * 3);
  }
  src.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (src !== g) g.dispose();
  return src;
}

/** A soft round dot, white so it takes any tint (will-o'-wisps). Small and mipmapped: crisp at any size. */
export const dotTexture = () =>
  canvasTex(64, 64, ctx => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.18, 'rgba(255,255,255,.85)');
    g.addColorStop(0.45, 'rgba(255,255,255,.22)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
