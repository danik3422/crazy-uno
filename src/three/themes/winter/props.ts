import * as THREE from 'three';
import { SNOW, merge, paint } from './bits';

/** A snowy pine: four tiers with snow on each, a trunk and a little mound at its foot (one geometry). */
export function pineGeometry(lite: boolean) {
  const seg = lite ? 7 : 10;
  const parts: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(0.09, 0.12, 0.45, 6, 1).translate(0, 0.22, 0), '#4a2c1c')];
  TIERS.forEach(([r, h, y], i) => {
    // dark, cool greens: the trees frame the scene without competing with the cards
    parts.push(paint(new THREE.ConeGeometry(r, h, seg, 1).rotateY(i * 0.4).translate(0, y + h / 2, 0), i % 2 ? '#1c5e4e' : '#174f44'));
    const sh = h * 0.4;
    parts.push(paint(new THREE.ConeGeometry(r * 0.52, sh, seg, 1).rotateY(0.3 + i * 0.4).translate(0, y + h - sh / 2 + 0.03, 0), SNOW));
  });
  parts.push(paint(new THREE.SphereGeometry(0.85, seg + 1, 4, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.22, 1), '#dfe9fa'));
  return merge(parts);
}
/** [radius, height, base] of each tier */
const TIERS: [number, number, number][] = [[0.95, 0.9, 0.3], [0.78, 0.8, 0.72], [0.6, 0.72, 1.1], [0.4, 0.62, 1.46]];
/** radius of a pine's surface at height y (for winding lights round it): the widest tier at that height */
export function pineRadius(y: number) {
  let best = 0;
  for (const [r, h, b] of TIERS) if (y >= b && y <= b + h) best = Math.max(best, r * (1 - (y - b) / h));
  return best;
}

/** Low, rounded snow banks (flattened domes), merged into one geometry. */
export function bankGeometry(spots: { x: number; z: number; s: number; a: number }[], lite: boolean) {
  const seg = lite ? 14 : 20;
  const parts = spots.flatMap(({ x, z, s, a }, i) => [
    paint(new THREE.SphereGeometry(1, seg, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.3 * s, 0.3 * s, 0.75 * s).rotateY(a).translate(x, -0.02, z), i % 2 ? '#c4d2ec' : '#b6c6e4'),
    // a smaller lump on its shoulder breaks the outline
    paint(new THREE.SphereGeometry(0.6, seg, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.2 * s, 0.42 * s, 0.9 * s).translate(x + Math.cos(a) * 0.7 * s, -0.02, z - Math.sin(a) * 0.5 * s), '#d2def4'),
  ]);
  return merge(parts);
}

/** height of a lantern's flame above its foot */
export const LANTERN_GLOW_Y = 0.94;

/** An iron lantern on a post: a square cage of warm glass under a snowy roof, on a little mound of snow. */
export function lanternGeometry(lite: boolean) {
  const iron = '#262c38';
  const parts = [
    paint(new THREE.SphereGeometry(0.34, lite ? 8 : 12, 3, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1), '#e6eefc'),
    paint(new THREE.CylinderGeometry(0.035, 0.05, 0.8, 6, 1).translate(0, 0.4, 0), iron),
    paint(new THREE.BoxGeometry(0.24, 0.03, 0.24).translate(0, 0.8, 0), iron),
    paint(new THREE.BoxGeometry(0.2, 0.26, 0.2).translate(0, LANTERN_GLOW_Y, 0), '#ffd58a'),
    paint(new THREE.BoxGeometry(0.26, 0.03, 0.26).translate(0, 1.08, 0), iron),
    paint(new THREE.ConeGeometry(0.22, 0.18, 4, 1).rotateY(Math.PI / 4).translate(0, 1.18, 0), iron),
    paint(new THREE.ConeGeometry(0.17, 0.08, 4, 1).rotateY(Math.PI / 4).translate(0, 1.24, 0), SNOW),
    paint(new THREE.SphereGeometry(0.035, 6, 4).translate(0, 1.3, 0), iron),
  ];
  // the four corner bars of the cage
  for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) parts.push(paint(new THREE.BoxGeometry(0.025, 0.27, 0.025).translate(x * 0.105, LANTERN_GLOW_Y, z * 0.105), iron));
  return merge(parts);
}
