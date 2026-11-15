import * as THREE from 'three';
import { canvasTex } from '../decorKit';
import { SNOW, merge, paint } from './bits';

export const CAB = { w: 2.0, d: 1.5, wall: 1.05, gable: 0.8 };

/** A log cabin with a snowy gable roof and a chimney; its front faces +z. */
export function cabinGeometry() {
  const { w, d, wall, gable } = CAB;
  const parts: THREE.BufferGeometry[] = [paint(new THREE.BoxGeometry(w - 0.1, wall, d - 0.1).translate(0, wall / 2, 0), '#5a341e')];
  const logs = 6;
  const step = wall / logs;
  for (let i = 0; i < logs; i++) {
    const c = i % 2 ? '#7c4c2c' : '#6a3e24';
    for (const z of [-d / 2, d / 2]) parts.push(paint(new THREE.CylinderGeometry(0.09, 0.09, w + 0.22, 7, 1).rotateZ(Math.PI / 2).translate(0, step * (i + 0.5), z), c));
    for (const x of [-w / 2, w / 2]) parts.push(paint(new THREE.CylinderGeometry(0.09, 0.09, d + 0.22, 7, 1).rotateX(Math.PI / 2).translate(x, step * (i + 0.5) + step * 0.5, 0), c));
  }
  // the gables
  const tri = new THREE.Shape();
  tri.moveTo(-w / 2 - 0.05, 0);
  tri.lineTo(0, gable);
  tri.lineTo(w / 2 + 0.05, 0);
  tri.closePath();
  for (const z of [-d / 2, d / 2 - 0.06]) parts.push(paint(new THREE.ExtrudeGeometry(tri, { depth: 0.06, bevelEnabled: false }).translate(0, wall, z), '#6a3e24'));
  // roof panels, each with a thick layer of snow
  const half = w / 2 + 0.3;
  const ang = Math.atan2(gable + 0.1, half);
  const len = Math.hypot(half, gable + 0.1) + 0.1;
  for (const s of [-1, 1]) {
    const panel = new THREE.BoxGeometry(len, 0.08, d + 0.45).rotateZ(-s * ang).translate((s * half) / 2, wall + (gable + 0.1) / 2 - 0.02, 0);
    parts.push(paint(panel, '#4a2a1c'));
    const nx = Math.sin(ang) * s;
    const ny = Math.cos(ang);
    const snow = new THREE.BoxGeometry(len + 0.06, 0.13, d + 0.52).rotateZ(-s * ang).translate((s * half) / 2 + nx * 0.1, wall + (gable + 0.1) / 2 - 0.02 + ny * 0.1, 0);
    parts.push(paint(snow, SNOW));
  }
  // chimney with a snow cap
  parts.push(paint(new THREE.BoxGeometry(0.26, 0.7, 0.26).translate(0.52, wall + gable * 0.55 + 0.2, -0.25), '#7a5a50'));
  parts.push(paint(new THREE.BoxGeometry(0.34, 0.1, 0.34).translate(0.52, wall + gable * 0.55 + 0.58, -0.25), SNOW));
  // door and window frames
  parts.push(paint(new THREE.BoxGeometry(0.44, 0.72, 0.05).translate(0, 0.36, d / 2 + 0.1), '#3a2014'));
  for (const x of [-0.62, 0.62]) parts.push(paint(new THREE.BoxGeometry(0.5, 0.5, 0.04).translate(x, 0.58, d / 2 + 0.1), '#efe4cf'));
  // a snow drift round the foot
  parts.push(paint(new THREE.SphereGeometry(1, 14, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.7, 0.2, 1.25), '#e4eefc'));
  return merge(parts);
}

/** Two warm window panes and a door lamp's glow on the snow, sharing one texture (left: panes, right: glow). */
export function windowGeometry() {
  const { d } = CAB;
  const quad = (w: number, h: number, u0: number, u1: number) => {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * (u1 - u0));
    return g;
  };
  const parts = [
    quad(0.4, 0.4, 0, 0.5).translate(-0.62, 0.58, d / 2 + 0.125),
    quad(0.4, 0.4, 0, 0.5).translate(0.62, 0.58, d / 2 + 0.125),
    quad(3.2, 2.0, 0.5, 1).rotateX(-Math.PI / 2).translate(0, 0.03, d / 2 + 1.0),
  ];
  return merge(parts.map(p => p.toNonIndexed()));
}

export const windowTexture = () =>
  canvasTex(128, 64, ctx => {
    const g = ctx.createRadialGradient(32, 36, 2, 32, 32, 40);
    g.addColorStop(0, '#fff3c8');
    g.addColorStop(0.6, '#ffc060');
    g.addColorStop(1, '#e0802a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#4a2a18';
    ctx.fillRect(29, 0, 6, 64);
    ctx.fillRect(0, 29, 64, 6);
    const p = ctx.createRadialGradient(96, 32, 0, 96, 32, 31);
    p.addColorStop(0, 'rgba(255,200,120,.55)');
    p.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = p;
    ctx.fillRect(64, 0, 64, 64);
  });
