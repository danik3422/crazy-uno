import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { exposeDebug } from '../../lib/debug';
import { arena, dockSize, handRoom, handTop, insetsOf, makeView, restCamera, viewSize, visibleHalfWidth, type Rect, type View } from '../layout';
import { readSafeArea } from '../layout/safeArea';

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
/** a card that moved further than this (table units) since the last measure is still flying: not counted yet */
const SETTLED = 0.04;

export interface HudZones {
  /** the HUD rectangles, in CSS pixels from the canvas' top-left corner */
  rects: Rect[];
  /**
   * Everything the decor must never cover: the HUD rectangles, plus the cards lying still on the table (each
   * opponent's fan, the pile, the deck, your hand), plus, on a phone on its side, the room the layout keeps for
   * your hand and for the dock in the bottom corners (whether the buttons show right now or not), so a prop
   * placed between turns never ends up under the action buttons or the risen hand.
   */
  keep: Rect[];
  /** the view the zones were measured for (with the safe-area insets) */
  view: View;
  /** bumps whenever the rectangles move: compare it to redo a placement only when needed */
  version: number;
}

const sameRects = (a: Rect[], b: Rect[]) =>
  a.length === b.length &&
  a.every((p, i) => {
    const q = b[i];
    return Math.abs(p.x0 - q.x0) < JITTER && Math.abs(p.y0 - q.y0) < JITTER && Math.abs(p.x1 - q.x1) < JITTER && Math.abs(p.y1 - q.y1) < JITTER;
  });

/** Joins overlapping rectangles into one (a fan of cards becomes a single box), until none overlap. */
function mergeRects(list: Rect[]) {
  const out = list.map(r => ({ ...r }));
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < out.length && !changed; i++)
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        if (a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0) {
          a.x0 = Math.min(a.x0, b.x0);
          a.y0 = Math.min(a.y0, b.y0);
          a.x1 = Math.max(a.x1, b.x1);
          a.y1 = Math.max(a.y1, b.y1);
          out.splice(j, 1);
          changed = true;
          break;
        }
      }
  }
  // a stable order, so an unchanged table compares equal from one measure to the next
  return out.sort((a, b) => a.x0 - b.x0 || a.y0 - b.y0);
}

/** On a phone on its side: the room kept for your hand (on your turn, risen) and the two dock corners. */
export function reservedRects(v: View): Rect[] {
  if (!v.compact) return [];
  const { w, h } = viewSize(v);
  const ins = insetsOf(v);
  const dock = dockSize(v);
  const room = handRoom(v);
  const top = handTop(v);
  const dockTop = h - ins.b - dock.top - 6;
  return [
    { x0: room.x0 - 4, y0: top, x1: room.x1 + 4, y1: h },
    { x0: 0, y0: dockTop, x1: room.x0, y1: h },
    { x0: room.x1, y0: dockTop, x1: w, y1: h },
  ];
}

const wp = new THREE.Vector3();
const ws = new THREE.Vector3();
const cardBox: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

/** The HUD rectangles over the canvas (see HUD) and what else to keep clear of, measured a few times a second. Read `.current` in the render loop. */
export function useHudZones() {
  const canvas = useThree(s => s.gl.domElement);
  const scene = useThree(s => s.scene);
  const zones = useRef<HudZones>({ rects: [], keep: [], view: makeView(800, 600), version: 0 });
  useEffect(() => {
    // where each card was at the last measure (by card id): one that has not moved since has come to rest
    let seen = new Map<number, [number, number, number]>();
    // what the last measure found
    let last: { rects: Rect[]; keep: Rect[] } = { rects: [], keep: [] };
    const measure = () => {
      const c = canvas.getBoundingClientRect();
      if (c.width < 1 || c.height < 1) return;
      const next: Rect[] = [];
      const plates: Rect[] = [];
      for (const el of document.querySelectorAll(HUD)) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue; // not shown on this screen
        // (a log squeezed by the plates under it shows only what fits: it is measured as it is)
        const log = el.classList.contains('log') && !el.classList.contains('cramped');
        const x1 = log ? Math.max(r.right, r.left + LOG_FULL.w(window.innerWidth)) : r.right;
        const y1 = log ? Math.max(r.bottom, r.top + LOG_FULL.h) : r.bottom;
        next.push({ x0: r.left - c.left, y0: r.top - c.top, x1: x1 - c.left, y1: y1 - c.top });
        // a plate wears badges past its edges now and then (the turn tag under it, UNO! and the team over it):
        // the decor keeps clear of where they come, so it does not have to move every turn
        if (el.classList.contains('oplate')) plates.push({ x0: r.left - c.left - 8, y0: r.top - c.top - 14, x1: r.right - c.left + 8, y1: r.bottom - c.top + 18 });
      }
      const view = makeView(c.width, c.height, readSafeArea());
      // the cards at rest, through the camera at rest (the intro move and the parallax aside)
      const cam = restCamera(view);
      const cards: Rect[] = [];
      const now = new Map<number, [number, number, number]>();
      scene.traverse(o => {
        if (o.userData.fit !== 'card' || !o.visible) return;
        o.getWorldPosition(wp);
        o.getWorldScale(ws);
        const id = o.userData.id as number;
        now.set(id, [wp.x, wp.y, wp.z]);
        const was = seen.get(id);
        if (!was || Math.hypot(was[0] - wp.x, was[1] - wp.y, was[2] - wp.z) > SETTLED) return;
        // a ball round the card: half its diagonal (1 × 1.5)
        ballOnScreen(cam, c.width, c.height, wp.x, wp.y, wp.z, 0.9 * ws.x, cardBox);
        if (cardBox.x0 < cardBox.x1) cards.push({ ...cardBox });
      });
      seen = now;
      const keep = [...next, ...plates, ...reservedRects(view), ...mergeRects(cards)];
      // a change is passed on once it has held for a whole measure (the deal, a fan growing card by card): the decor
      // moves once, to where things end up, rather than at every step on the way
      const settled = sameRects(last.keep, keep) && sameRects(last.rects, next);
      last = { rects: next, keep };
      const z = zones.current;
      if ((settled || z.version === 0) && (!sameRects(z.rects, next) || !sameRects(z.keep, keep) || z.view.compact !== view.compact))
        zones.current = { rects: next, keep, view, version: z.version + 1 };
    };
    measure();
    const id = setInterval(measure, EVERY);
    return () => clearInterval(id);
  }, [canvas, scene]);
  exposeDebug('__decorZones', zones);
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

const rayDir = new THREE.Vector3();
/**
 * The point of the floor (y = 0) seen at screen pixel (px, py) of a canvas w × h through `cam`, written to `out`;
 * null when that pixel looks above the horizon.
 */
export function floorAt(cam: THREE.PerspectiveCamera, w: number, h: number, px: number, py: number, out: THREE.Vector3) {
  rayDir.set((px / w) * 2 - 1, 1 - (py / h) * 2, 0.5).unproject(cam).sub(cam.position);
  if (rayDir.y >= -1e-6) return null;
  return out.copy(cam.position).addScaledVector(rayDir, -cam.position.y / rayDir.y);
}

/** Does `r`, grown by `pad` px, touch any of the rectangles? (An empty or off-screen `r` touches none.) */
export function underHud(r: Rect, rects: Rect[], pad = 0) {
  if (r.x0 > r.x1) return false;
  for (const q of rects) if (r.x0 - pad < q.x1 && r.x1 + pad > q.x0 && r.y0 - pad < q.y1 && r.y1 + pad > q.y0) return true;
  return false;
}

/* ---------- placing props in the free room of a small screen ---------- */

/** A prop on the floor: where it stands and how big it is drawn. */
export interface Placed {
  x: number;
  z: number;
  s: number;
}

/** The size of a prop at scale 1, for checking it on the screen: a ball of radius `r` around height `y`. */
export interface Ball {
  r: number;
  y: number;
  /** half its width, when narrower or wider than `r` (a pine is tall and slim, a cabin wide and low) */
  rx?: number;
}

const bb = new THREE.Box3();
/**
 * A tight Ball round a prop's geometry for placing it (CSS-pixel boxes, so tighter than its bounding sphere):
 * half its height (seen from above, a deep prop looks taller), half its width, around its middle.
 * `top`: it reaches this high whatever its geometry says (a hat sits on the snowman).
 */
export function ballOf(g: THREE.BufferGeometry, top = 0): Ball {
  bb.setFromBufferAttribute(g.attributes.position as THREE.BufferAttribute);
  const y1 = Math.max(bb.max.y, top);
  const rx = Math.max(-bb.min.x, bb.max.x, -bb.min.z, bb.max.z);
  return { r: Math.max((y1 - bb.min.y) / 2, rx * 0.75), y: (y1 + bb.min.y) / 2, rx };
}

export interface PlaceOptions {
  /** the biggest the prop may look (its ball's radius, px) and the smallest still worth showing */
  maxPx: number;
  minPx: number;
  /** never bigger than this scale, however much room there is */
  maxScale?: number;
  /** the share of the prop (of its box's width and height) that must be on the screen: a background prop may hang past an edge */
  onScreen?: number;
  /** gap (px) kept to the HUD, the cards and the dock */
  pad?: number;
  /** may it stand in front of / behind props already placed (pines in a clump), or must it keep apart */
  overlap?: boolean;
}

/**
 * The table itself, which no prop stands on: within this radius of the pile, measured the way the floors measure it
 * (z stretched by RIM_Z, see classic/floor.ts, whose gold rim runs at 7.45). Every seat's fan lies inside it.
 */
const RIM_R = 7.6;
const RIM_Z = 1.45;

/** each size tried is this much smaller than the one before, from the biggest down to the smallest allowed */
const SHRINK = 0.86;

/**
 * Finds room for the decor on the actual screen: each prop tries its candidate spots, biggest size first, and takes
 * the first spot where it is clear of everything in `zones.keep` (HUD, plates, cards, the hand's and the dock's room),
 * of the props placed before it, and on the screen (inside the safe area). Spots are tried in the order given, so a
 * theme lists its favourite spots first. All in CSS pixels through the camera at rest.
 */
export class Placer {
  readonly view: View;
  readonly w: number;
  readonly h: number;
  private readonly cam: THREE.PerspectiveCamera;
  private readonly pile: [number, number];
  private readonly keep: Rect[];
  private readonly taken: Rect[] = [];
  private readonly box: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

  constructor(w: number, h: number, zones: HudZones) {
    this.w = w;
    this.h = h;
    this.view = makeView(w, h, zones.view.insets);
    this.cam = restCamera(this.view);
    const d = arena(this.view).discard;
    this.pile = [d[0], d[2]];
    this.keep = zones.keep;
  }

  /** the screen box of a ball radius r around (x, y, z); `rx`: its half-width, when not r */
  boxAt(x: number, y: number, z: number, r: number, rx = r): Rect {
    const b = ballOnScreen(this.cam, this.w, this.h, x, y, z, r, this.box);
    if (rx !== r && b.x0 <= b.x1) {
      const c = (b.x0 + b.x1) / 2;
      const half = ((b.x1 - b.x0) / 2) * (rx / r);
      b.x0 = c - half;
      b.x1 = c + half;
    }
    return b;
  }

  /** the share of a box on the screen's safe area, the smaller of across and down (0..1) */
  private shown(b: Rect) {
    const ins = insetsOf(this.view);
    const sx = (Math.min(b.x1, this.w - ins.r) - Math.max(b.x0, ins.l)) / (b.x1 - b.x0);
    const sy = (Math.min(b.y1, this.h - ins.b) - Math.max(b.y0, ins.t)) / (b.y1 - b.y0);
    return Math.max(0, Math.min(sx, sy));
  }

  /** is this screen box clear of everything kept and on screen enough? */
  private clearBox(b: Rect, o: PlaceOptions) {
    if (b.x0 > b.x1) return false;
    if (this.shown(b) < (o.onScreen ?? 0.75)) return false;
    if (underHud(b, this.keep, o.pad ?? 4)) return false;
    if (!o.overlap && underHud(b, this.taken, 2)) return false;
    return true;
  }

  /** is a ball (scale 1 size `ball`, drawn at scale s) at (x, z) clear and on screen? */
  fits(x: number, z: number, s: number, ball: Ball, o: PlaceOptions) {
    return !this.onTable(x, z) && this.clearBox(this.boxAt(x, ball.y * s, z, ball.r * s, (ball.rx ?? ball.r) * s), o);
  }

  /** marks a placed prop's box as taken */
  take(p: Placed, ball: Ball) {
    const b = this.boxAt(p.x, ball.y * p.s, p.z, ball.r * p.s, (ball.rx ?? ball.r) * p.s);
    this.taken.push({ ...b });
  }

  /**
   * The first spot (and the biggest size) where the prop fits, or null; the spot is then taken. `prev`, where the
   * prop stood until now, is kept while it is still clear: props should not hop about as cards come to rest.
   */
  place(spots: { x: number; z: number }[], ball: Ball, o: PlaceOptions, prev?: Placed | null): Placed | null {
    // (no gap needed to keep it: a fan that grows a card wider brushing past it is no reason to move)
    if (prev && this.fits(prev.x, prev.z, prev.s, ball, { ...o, pad: 0 })) {
      this.take(prev, ball);
      return prev;
    }
    // each spot projected once: its foot and its middle at scale 1, and its half-size; a scale s then only scales
    // (near enough: a prop is small next to its distance from the camera)
    const rx = ball.rx ?? ball.r;
    const pre = new Float64Array(spots.length * 7);
    spots.forEach((sp, i) => {
      if (this.onTable(sp.x, sp.z)) return void (pre[i * 7 + 6] = 0);
      const m = this.boxAt(sp.x, ball.y, sp.z, ball.r, rx);
      if (m.x0 > m.x1) return void (pre[i * 7 + 6] = 0);
      pre.set([(m.x0 + m.x1) / 2, (m.y0 + m.y1) / 2, (m.x1 - m.x0) / 2, (m.y1 - m.y0) / 2], i * 7);
      const g = this.boxAt(sp.x, 0, sp.z, ball.r, rx);
      pre[i * 7 + 4] = (g.x0 + g.x1) / 2;
      pre[i * 7 + 5] = (g.y0 + g.y1) / 2;
      pre[i * 7 + 6] = 1;
    });
    const b: Rect = { x0: 0, y0: 0, x1: 0, y1: 0 };
    const sizes: number[] = [];
    for (let px = o.maxPx; px > o.minPx; px *= SHRINK) sizes.push(px);
    sizes.push(o.minPx);
    for (const px of sizes) {
      for (let i = 0; i < spots.length; i++) {
        const j = i * 7;
        if (!pre[j + 6]) continue;
        const cx = pre[j], cy = pre[j + 1], hx = pre[j + 2], hy = pre[j + 3], gx = pre[j + 4], gy = pre[j + 5];
        // the scale that makes it px big at this spot (its size on screen grows as it comes nearer)
        const s = Math.min(o.maxScale ?? Infinity, px / hy);
        if (s * hy < o.minPx - 0.01) continue;
        const x = gx + (cx - gx) * s;
        const y = gy + (cy - gy) * s;
        b.x0 = x - hx * s;
        b.x1 = x + hx * s;
        b.y0 = y - hy * s;
        b.y1 = y + hy * s;
        if (this.clearBox(b, o) && this.fits(spots[i].x, spots[i].z, s, ball, o)) {
          const p = { x: spots[i].x, z: spots[i].z, s };
          this.take(p, ball);
          return p;
        }
      }
    }
    return null;
  }

  /** is (x, z) on the table (inside its rim)? */
  onTable(x: number, z: number) {
    return Math.hypot(x - this.pile[0], (z - this.pile[1]) * RIM_Z) < RIM_R;
  }

  /** x of a spot `e` table units in from the visible side edge (side -1: left, 1: right) at depth z */
  edgeX(side: number, z: number, e: number) {
    return side * (visibleHalfWidth(this.view, 0, z) - e);
  }

  /** spots along one side edge: each depth, each distance in from the edge */
  side(side: number, zs: number[], es: number[]) {
    return zs.flatMap(z => es.map(e => ({ x: this.edgeX(side, z, e), z })));
  }

  /**
   * Every spot of one side strip on a fine grid, from far to near (the fallback after a theme's favourite spots):
   * the pockets left between a crowded table's plates are small and could be anywhere.
   */
  strip(side: number) {
    const zs: number[] = [];
    // finer near the camera, where a step covers more of the screen
    for (let z = -7; z <= 5; z += z < 2 ? 0.5 : 0.25) zs.push(z);
    return this.side(side, zs, [0.6, 1.2, 1.8, 2.4, 3, 3.6, 4.2, 4.8]);
  }
}
