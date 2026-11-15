import * as THREE from 'three';
import { CARD_H, CARD_W } from '../cards/cardShape';
import { CAMERA, PARALLAX_X, cameraFov } from './camera';
import { arena, handScale } from './table';
import type { Insets, Target, View } from './types';

/*
 * Fitting the table to the screen: where things land in screen pixels, seen through the camera at rest, and how much
 * of the screen the HUD keeps for itself. The hand (and the card you hold up) are placed from these numbers, so they
 * stay whole and clear of the HUD on any screen, instead of from a guess per device.
 */

const NO_INSETS: Insets = { t: 0, r: 0, b: 0, l: 0 };
export const insetsOf = (v: View): Insets => v.insets ?? NO_INSETS;

/**
 * The view of a canvas `w` × `h` CSS pixels: tall screens get the portrait table, short wide ones (a phone on its
 * side) the compact one. Rounded, so resizing a window does not rebuild the layout on every pixel.
 */
export function makeView(w: number, h: number, insets: Insets = NO_INSETS): View {
  const portrait = w / h < 0.9;
  return {
    portrait,
    compact: !portrait && h < 520,
    aspect: Math.round((w / h) * 50) / 50,
    h: Math.round(h / 10) * 10,
    insets,
  };
}

/** The canvas size in CSS pixels. */
export function viewSize(v: View) {
  const h = v.h ?? 800;
  return { w: (v.aspect ?? 1.6) * h, h };
}

/** how far the mouse parallax moves the camera up and down (CameraRig) */
export const PARALLAX_Y = 0.2;

const cam = new THREE.PerspectiveCamera();
/** The camera where CameraRig keeps it during play, moved by (dx, dy) (the mouse parallax). */
export function restCamera(v: View, dx = 0, dy = 0) {
  const c = v.portrait ? CAMERA.portrait : CAMERA.landscape;
  cam.fov = cameraFov(v);
  cam.aspect = v.aspect ?? c.fitAspect;
  cam.near = 0.1;
  cam.far = 200;
  cam.updateProjectionMatrix();
  cam.position.set(c.pos[0] + dx, c.pos[1] + dy, c.pos[2]);
  // CameraRig keeps looking at the same point while the parallax moves the camera
  cam.lookAt(c.look[0], c.look[1], c.look[2]);
  cam.updateMatrixWorld();
  return cam;
}

/** The parallax offsets to check: every extreme of the mouse (none on a phone, where there is no mouse). */
function parallaxes(v: View): [number, number][] {
  return v.compact
    ? [[0, 0]]
    : [[-PARALLAX_X, -PARALLAX_Y], [PARALLAX_X, -PARALLAX_Y], [-PARALLAX_X, PARALLAX_Y], [PARALLAX_X, PARALLAX_Y]];
}

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const eul = new THREE.Euler(0, 0, 0, 'YXZ');
const q = new THREE.Quaternion();
const p = new THREE.Vector3();
const CORNERS = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];

/**
 * The screen rectangle (CSS pixels) that these cards cover, wherever the mouse parallax takes the camera.
 * `grow` counts a card a little bigger than it is (a hovered card grows by 12%, the hand bobs on some tables).
 */
export function cardsRect(v: View, ts: Iterable<Target>, grow = 1): Rect {
  const { w, h } = viewSize(v);
  const r: Rect = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const list = [...ts];
  for (const [dx, dy] of parallaxes(v)) {
    const c = restCamera(v, dx, dy);
    for (const t of list) {
      const s = (t.scale ?? 1) * grow;
      eul.set(t.rot[0], t.rot[1], t.rot[2]);
      q.setFromEuler(eul);
      for (const [cx, cy] of CORNERS) {
        p.set(cx * CARD_W * s, cy * CARD_H * s, 0).applyQuaternion(q);
        p.x += t.pos[0];
        p.y += t.pos[1];
        p.z += t.pos[2];
        p.project(c);
        const x = ((p.x + 1) / 2) * w;
        const y = ((1 - p.y) / 2) * h;
        if (x < r.x0) r.x0 = x;
        if (x > r.x1) r.x1 = x;
        if (y < r.y0) r.y0 = y;
        if (y > r.y1) r.y1 = y;
      }
    }
  }
  return r;
}

/** A point on the table, in CSS pixels through the camera at rest. */
export function toScreen(v: View, x: number, y: number, z: number) {
  const { w, h } = viewSize(v);
  p.set(x, y, z).project(restCamera(v));
  return { x: ((p.x + 1) / 2) * w, y: ((1 - p.y) / 2) * h };
}

/**
 * The HUD at the bottom of the screen (src/ui/game/hud/Hud.css): your card on the left and the action button on the
 * right. `side` is how wide each of the two may get (the page gets it as --dock-side, so the CSS and the layout agree),
 * `edge` their gap to the screen's side, `top` how far up from the bottom edge (above the safe area) they reach.
 * A narrow window (≤ 560 px) has one full-width bar instead.
 */
export function dockSize(v: View) {
  const { w } = viewSize(v);
  if (v.compact) return { side: Math.round(Math.min(190, Math.max(124, w * 0.18))), edge: 8, top: 52, bar: false };
  if (w <= 560) return { side: Math.round(w), edge: 8, top: 68, bar: true };
  return { side: Math.round(Math.min(300, w * 0.21)), edge: 16, top: 86, bar: false };
}

/** Where your hand may lie on the screen (CSS pixels): between x0 and x1, its lowest corner no lower than `bottom`. */
export interface HandRoom extends Rect {
  bottom: number;
  /** true: the hand sits beside the corner panels; false: above them (a narrow or squarish screen) */
  beside: boolean;
}

/**
 * The room for your hand. Beside the corner panels when that leaves it room for a usual 7-card hand at its full size
 * (and always on a phone on its side, which has no height to spare), otherwise above them, with the whole width.
 */
export function handRoom(v: View): HandRoom {
  const { w, h } = viewSize(v);
  const ins = insetsOf(v);
  // a small gap to the screen edge, a bit more on a big screen
  const margin = Math.round(Math.max(8, h * 0.014));
  const gap = 10;
  const dock = dockSize(v);
  const A = arena(v);
  // a usual hand (7 cards at their natural spacing) at its resting depth, in pixels
  const big = handScale(v);
  const half = (6 * A.hand.sp * big + CARD_W * big) / 2;
  const natural = toScreen(v, half, A.hand.y, A.hand.z).x - toScreen(v, -half, A.hand.y, A.hand.z).x;
  const sideL = Math.max(ins.l, ins.r, dock.edge) + dock.side + gap;
  const besideW = w - 2 * sideL;
  // a phone on its side is too short to stack the hand over the panels: there it always goes between them
  if (!dock.bar && (v.compact || besideW >= natural * 0.9)) {
    return { x0: sideL, x1: w - sideL, y0: margin + ins.t, y1: h - margin - ins.b, bottom: h - margin - ins.b, beside: true };
  }
  const edge = Math.max(ins.l, ins.r) + margin;
  const bottom = h - ins.b - dock.top - gap;
  return { x0: edge, x1: w - edge, y0: margin + ins.t, y1: bottom, bottom, beside: false };
}

/**
 * How high up the screen (CSS pixels) a usual one-row hand reaches on your turn: its cards stand on the room's
 * bottom, risen, the playable ones lifted and hovered. The deck keeps above this line (deck.ts), so the two never meet.
 */
export function handTop(v: View) {
  const A = arena(v);
  const big = handScale(v);
  const { tilt, y, z } = A.hand;
  // a card's height on screen, standing in the hand
  const k = CARD_H * big;
  const cardPx = Math.abs(toScreen(v, 0, y, z).y - toScreen(v, 0, y + Math.cos(tilt) * k, z + Math.sin(tilt) * k).y);
  // risen on your turn (0.4), a playable card lifted (0.3) and hovered (0.3 more, 12% bigger): about 1.7 card heights
  return handRoom(v).bottom - cardPx * 1.7 - 6;
}

/**
 * The furthest a point on the table may come toward the camera (largest z, at x = 0) and still show above `py`
 * pixels on the screen.
 */
export function zAbove(v: View, py: number, lo = -6, hi = 12) {
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (toScreen(v, 0, 0, mid).y <= py) lo = mid;
    else hi = mid;
  }
  return lo;
}
