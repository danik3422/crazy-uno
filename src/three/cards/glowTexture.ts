import * as THREE from 'three';

let tex: THREE.CanvasTexture | null = null;

/** A soft round glow (white, fading out to the edge), tinted by the material colour. Shared by all effects. */
export function glowTexture(): THREE.CanvasTexture {
  if (tex) return tex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Fills a path drawn by `path` with a soft (Gaussian) edge of `radius` canvas pixels: the canvas version of a CSS
 * `blur()`. Safari has no `ctx.filter`, so there the glow would come out as a hard shape; a shadow cast by the shape
 * drawn far off the canvas gives the same blur everywhere (shadowBlur is twice the blur's standard deviation).
 * Done once when a texture is made, never per frame.
 */
export function fillSoft(ctx: CanvasRenderingContext2D, radius: number, path: (c: CanvasRenderingContext2D) => void) {
  ctx.save();
  if (typeof (ctx as { filter?: unknown }).filter === 'string') {
    ctx.filter = `blur(${radius}px)`;
    path(ctx);
    ctx.fill();
  } else {
    const off = ctx.canvas.width + 4 * radius + 100;
    ctx.shadowColor = typeof ctx.fillStyle === 'string' ? ctx.fillStyle : '#fff';
    ctx.shadowBlur = radius * 2;
    // shadow offsets ignore the transform: move the shape in canvas pixels, then cast its shadow back
    ctx.setTransform(new DOMMatrix().translate(off, 0).multiply(ctx.getTransform()));
    ctx.shadowOffsetX = -off;
    path(ctx);
    ctx.fill();
  }
  ctx.restore();
}
