import * as THREE from 'three';
import { SNOW, merge, paint } from './bits';

/** The snowman's three balls, coal face and buttons, carrot nose and his left stick arm. */
export function snowmanGeometry(lite: boolean, scarf: string | null) {
  const ws = lite ? 12 : 16;
  const hs = lite ? 9 : 12;
  const coal = '#1a1a22';
  const parts = [
    paint(new THREE.SphereGeometry(0.55, ws, hs).scale(1, 0.92, 1).translate(0, 0.5, 0), SNOW),
    paint(new THREE.SphereGeometry(0.42, ws, hs).translate(0, 1.2, 0), SNOW),
    paint(new THREE.SphereGeometry(0.3, ws, hs).translate(0, 1.74, 0), SNOW),
    paint(new THREE.ConeGeometry(0.05, 0.3, 6, 1).rotateX(Math.PI / 2).translate(0, 1.73, 0.4), '#ff8a1a'),
    paint(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5, 1).rotateZ(Math.PI / 2 - 0.5).translate(-0.62, 1.42, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 4, 1).rotateZ(-0.4).translate(-0.82, 1.6, 0), '#4a2c1c'),
  ];
  for (const x of [-0.1, 0.1]) parts.push(paint(new THREE.SphereGeometry(0.04, 6, 4).translate(x, 1.81, 0.26), coal));
  for (let i = 0; i < 5; i++) {
    const a = -0.5 + i * 0.25;
    parts.push(paint(new THREE.SphereGeometry(0.025, 5, 3).translate(Math.sin(a) * 0.14, 1.64 - Math.cos(a) * 0.04 + 0.02, 0.27), coal));
  }
  for (let i = 0; i < 3; i++) parts.push(paint(new THREE.SphereGeometry(0.045, 6, 4).translate(0, 1.08 + i * 0.14, 0.4 - Math.abs(i - 1) * 0.02), coal));
  if (scarf) parts.push(...scarfParts().map(g => paint(g, scarf)));
  return merge(parts);
}
const scarfParts = () => [new THREE.TorusGeometry(0.29, 0.075, 6, 16).rotateX(Math.PI / 2).translate(0, 1.47, 0), new THREE.BoxGeometry(0.14, 0.42, 0.05).rotateZ(0.18).translate(0.16, 1.26, 0.33)];
export const scarfGeometry = () => merge(scarfParts().map(g => g.toNonIndexed()).map(g => (g.deleteAttribute('uv'), g)));

/** The waving right arm: a stick with two twig fingers, reaching out along +x from the shoulder (the origin). */
export function armGeometry() {
  return merge([
    paint(new THREE.CylinderGeometry(0.025, 0.03, 0.62, 5, 1).rotateZ(Math.PI / 2).translate(0.31, 0, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 4, 1).rotateZ(-0.6).translate(0.62, 0.07, 0), '#4a2c1c'),
    paint(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 4, 1).rotateZ(0.9).translate(0.6, -0.05, 0), '#4a2c1c'),
  ]);
}

/** A top hat with a berry-red band, sitting on its brim at the origin. */
export function hatGeometry() {
  return merge([
    paint(new THREE.CylinderGeometry(0.33, 0.33, 0.03, 16, 1).translate(0, 0.015, 0), '#1c1c26'),
    paint(new THREE.CylinderGeometry(0.2, 0.21, 0.36, 14, 1).translate(0, 0.2, 0), '#1c1c26'),
    paint(new THREE.CylinderGeometry(0.215, 0.215, 0.08, 14, 1).translate(0, 0.07, 0), '#c22a3e'),
  ]);
}
