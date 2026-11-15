import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { Rect } from '../layout';

/** A texture painted once on a canvas (used by the Halloween table's decor and landing). */
export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- keeping the decor out from under the HUD ---------- */

/**
 * What the decor keeps clear of, measured on the page: the colour pill and the game log (top left), the reaction and
 * menu buttons (top right), your card and the action buttons (the dock at the bottom) and every opponent's plate.
 * The HTML sits over the canvas, so anything drawn under it would only muddy it.
 */
const HUD = '.hud-top .status, .log, .corner-btns, .hud-bottom .me, .actions, .oplate';
/**
 * The log grows to three entries (Hud.css: 12.5 px lines × 1.35, 3 px gaps, 8 px padding, at most min(320 px, 22vw)
 * wide): its box is counted that big from the start, room for one entry running onto a second line included, so
 * nothing ends up under it as the game goes on. A longer log is measured as it is.
 */
const LOG_FULL = { h: 4 * 12.5 * 1.35 + 2 * 3 + 16, w: (vw: number) => Math.min(320, 0.22 * vw) };
/** how often the page is measured (ms): the HUD moves with a resize, a seat change or the log growing */
const EVERY = 400;
/** a change smaller than this (px) is not worth moving the decor for */
const JITTER = 6;

export interface HudZones {
  /** the rectangles, in CSS pixels from the canvas' top-left corner */
  rects: Rect[];
  /** bumps whenever the rectangles move: compare it to redo a placement only when needed */
  version: number;
}

/** The HUD rectangles over the canvas (see HUD), measured a few times a second. Read `.current` in the render loop. */
export function useHudZones() {
  const canvas = useThree(s => s.gl.domElement);
  const zones = useRef<HudZones>({ rects: [], version: 0 });
  useEffect(() => {
    const measure = () => {
      const c = canvas.getBoundingClientRect();
      const next: Rect[] = [];
      for (const el of document.querySelectorAll(HUD)) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue; // not shown on this screen
        // (a log squeezed by the plates under it shows only what fits: it is measured as it is)
        const log = el.classList.contains('log') && !el.classList.contains('cramped');
        const x1 = log ? Math.max(r.right, r.left + LOG_FULL.w(window.innerWidth)) : r.right;
        const y1 = log ? Math.max(r.bottom, r.top + LOG_FULL.h) : r.bottom;
        next.push({ x0: r.left - c.left, y0: r.top - c.top, x1: x1 - c.left, y1: y1 - c.top });
      }
      const prev = zones.current.rects;
      const same = prev.length === next.length && prev.every((p, i) => {
        const q = next[i];
        return Math.abs(p.x0 - q.x0) < JITTER && Math.abs(p.y0 - q.y0) < JITTER && Math.abs(p.x1 - q.x1) < JITTER && Math.abs(p.y1 - q.y1) < JITTER;
      });
      if (!same) zones.current = { rects: next, version: zones.current.version + 1 };
    };
    measure();
    const id = setInterval(measure, EVERY);
    return () => clearInterval(id);
  }, [canvas]);
  return zones;
}

const tmpV = new THREE.Vector3();
const fwd = new THREE.Vector3();

/**
 * The screen rectangle (CSS pixels, canvas `w` × `h`) a ball of radius `r` around a point covers, seen by `cam`.
 * Behind the camera: an empty rectangle (x0 > x1).
 */
export function ballOnScreen(cam: THREE.PerspectiveCamera, w: number, h: number, x: number, y: number, z: number, r: number, out: Rect): Rect {
  cam.getWorldDirection(fwd);
  const depth = tmpV.set(x, y, z).sub(cam.position).dot(fwd);
  if (depth <= 0.01) {
    out.x0 = out.y0 = 1;
    out.x1 = out.y1 = 0;
    return out;
  }
  tmpV.set(x, y, z).project(cam);
  const cx = ((tmpV.x + 1) / 2) * w;
  const cy = ((1 - tmpV.y) / 2) * h;
  const rp = (r * h) / (2 * depth * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
  out.x0 = cx - rp;
  out.x1 = cx + rp;
  out.y0 = cy - rp;
  out.y1 = cy + rp;
  return out;
}

/** Does `r`, grown by `pad` px, touch any of the rectangles? (An empty or off-screen `r` touches none.) */
export function underHud(r: Rect, rects: Rect[], pad = 0) {
  if (r.x0 > r.x1) return false;
  for (const q of rects) if (r.x0 - pad < q.x1 && r.x1 + pad > q.x0 && r.y0 - pad < q.y1 && r.y1 + pad > q.y0) return true;
  return false;
}
