import type { Vec3, View } from './types';

/* The camera: where it sits and looks, its field of view, and how wide the table looks from it. */

/**
 * Where the camera sits during play. The vertical field of view widens on screens narrower than
 * `fitAspect`, so the table keeps its full width on screen (4:3 monitors, narrow windows).
 */
export const CAMERA = {
  landscape: { pos: [0, 7.6, 9.8] as Vec3, look: [0, 0, 0.55] as Vec3, fov: 42, fitAspect: 1.72 },
  portrait: { pos: [0, 15, 10.6] as Vec3, look: [0, 0, 1.4] as Vec3, fov: 50, fitAspect: 0.56 },
};
/** how far the mouse parallax moves the camera sideways */
export const PARALLAX_X = 0.35;

export function cameraFov(v: View) {
  const c = v.portrait ? CAMERA.portrait : CAMERA.landscape;
  const aspect = v.aspect ?? c.fitAspect;
  if (aspect >= c.fitAspect) return c.fov;
  const half = Math.atan((Math.tan((c.fov * Math.PI) / 360) * c.fitAspect) / aspect);
  return Math.min(75, (half * 360) / Math.PI);
}

/** Half the width the camera sees at a point straight ahead of it (table units), at rest. */
export function visibleHalfWidth(v: View, y: number, z: number) {
  const c = v.portrait ? CAMERA.portrait : CAMERA.landscape;
  const [px, py, pz] = c.pos;
  const [lx, ly, lz] = c.look;
  const dx = lx - px, dy = ly - py, dz = lz - pz;
  const len = Math.hypot(dx, dy, dz);
  const depth = ((0 - px) * dx + (y - py) * dy + (z - pz) * dz) / len;
  const aspect = v.aspect ?? c.fitAspect;
  return depth * Math.tan((cameraFov(v) * Math.PI) / 360) * aspect;
}
