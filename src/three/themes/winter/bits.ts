import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from '../decorKit';
import { snowflake } from './face';

/** the white of fresh snow on the decor */
export const SNOW = '#f2f7ff';

/** A crisp white six-armed snowflake with a faint frosted heart (takes any tint). Mipmapped, so it stays clean small. */
export const flakeTexture = () => {
  const t = canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 22);
    g.addColorStop(0, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    snowflake(ctx, 64, 64, 50, '#ffffff', 7);
  });
  t.anisotropy = 8;
  return t;
};

/** A warm round pool of light, bright in the middle and fading to nothing at the edge (for lamp light on snow). */
export const glowTexture = () =>
  canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 63);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

/** A lumpy puff of powder snow, with firm-ish edges so it reads as powder rather than a blur. */
export const puffTexture = () =>
  canvasTex(128, 128, ctx => {
    for (const [x, y, r] of [[64, 68, 42], [42, 58, 28], [86, 58, 28], [62, 42, 26], [48, 84, 24], [82, 84, 24]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.6)');
      g.addColorStop(0.7, 'rgba(255,255,255,.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    }
  });

/**
 * GLSL for points that keep a size in world units: `float pointPx(vec4 mv, float size)`.
 * uViewH is the drawing buffer's height in pixels.
 */
export const POINT_SIZE = /* glsl */ `
  uniform float uViewH;
  float pointPx(vec4 mv, float size) { return size * projectionMatrix[1][1] * 0.5 * uViewH / max(0.1, -mv.z); }
`;

/** Rotates a point sprite's coordinate about its centre. */
export const ROTATE_PC = /* glsl */ `
  vec2 rotPC(vec2 pc, float a) { vec2 d = pc - 0.5; float c = cos(a), s = sin(a); return vec2(c * d.x - s * d.y, s * d.x + c * d.y) + 0.5; }
`;

/** Paints a whole geometry one colour (as a vertex colour) and makes it non-indexed so parts merge. */
export function paint(g: THREE.BufferGeometry, c: string) {
  const col = new THREE.Color(c);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  // merged parts must share the same attributes
  out.deleteAttribute('uv');
  return out;
}

export function merge(parts: THREE.BufferGeometry[]) {
  // nothing to merge (every piece left out on this screen): an empty geometry draws nothing
  if (!parts.length) return new THREE.BufferGeometry();
  const g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return g;
}
