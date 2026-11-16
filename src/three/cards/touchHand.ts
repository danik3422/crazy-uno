import { useThree } from '@react-three/fiber';
import { useEffect, type RefObject } from 'react';
import * as THREE from 'three';
import { haptics } from '../../audio/haptics';
import { exposeDebug } from '../../lib/debug';
import type { Target } from '../layout/types';
import { CARD_H, CARD_W } from './cardShape';
import { DRAG_HEIGHT, drag, dropZone } from './drag';
import { MIN_SLOT, pickSlot, slotEdges } from './touchSlots';

/*
 * Your hand under a finger. A mouse has hover: the card under the pointer rises before you click. A finger has none,
 * and in a big hand each card shows only a sliver a few pixels wide. So on a touch screen the hand works like this:
 *
 *  - finger down anywhere on the hand (or just above it) and slide sideways: the card under the finger rises and
 *    grows into a big preview, its neighbours step aside. The hand is split into strips along its width, each at
 *    least a fingertip wide (touchSlots.ts), and the picked card holds on to the finger a little past its edges;
 *  - let go where you are: the card stays picked. Tap it again, flick it up, or drag it up onto the pile: it is played;
 *  - tap anywhere else on the table: the card goes back;
 *  - a card you may not play shows all the same, and only shakes when you try to play it.
 *
 * Mouse and pen keep the usual hover, click and drag (Card3D). The card you just drew, held up in front of you, keeps
 * its own tap and drag too.
 */

/** what the render loop reads (Card3D) */
export const touchHand = {
  /** the card picked by the finger: risen and grown, until it is played or let go */
  sel: null as number | null,
  /** sideways step (table units) of the cards next to the picked one, so they make room for it */
  room: new Map<number, number>(),
  /** a card refused (not playable now): it shakes from this moment (performance.now(), ms) */
  shakeId: null as number | null,
  shakeAt: -1e9,
};

/** how much bigger the picked card grows, and how far (table units) it rises along its own face and toward you */
export const PREVIEW = { scale: 1.42, up: 0.62, toward: 0.3 };
/** how long a refused card shakes (ms) */
export const SHAKE_MS = 420;

interface Entry {
  t: Target;
  pick: (id: number) => void;
  obj: THREE.Object3D | null;
}
/** the cards of your hand, as their Card3D last laid them out */
const cards = new Map<number, Entry>();

/** Card3D: puts its card on the list while it is in your hand. */
export function useTouchHand(id: number, t: Target, pick: (id: number) => void, obj: RefObject<THREE.Object3D>) {
  const gl = useThree(s => s.gl);
  const camera = useThree(s => s.camera);
  const inHand = t.zone === 'hand';
  useEffect(() => {
    if (!inHand) return;
    return attach(gl.domElement, camera);
  }, [inHand, gl, camera]);
  useEffect(() => {
    if (!inHand) return;
    cards.set(id, { t, pick, obj: obj.current });
    return () => {
      cards.delete(id);
      // played, given away or swapped off: no longer picked (checked once React has put back whatever stays)
      queueMicrotask(() => {
        if (!cards.has(id) && touchHand.sel === id) select(null);
      });
    };
  }, [id, t, pick, inHand, obj]);
}

// ---- the canvas the finger is on ----

let cam: THREE.Camera | null = null;
const attached = new Map<HTMLCanvasElement, { n: number; off: () => void }>();

function attach(canvas: HTMLCanvasElement, camera: THREE.Camera) {
  cam = camera;
  let a = attached.get(canvas);
  if (!a) {
    a = { n: 0, off: listen(canvas) };
    attached.set(canvas, a);
  }
  a.n++;
  return () => {
    const b = attached.get(canvas);
    if (!b || --b.n > 0) return;
    b.off();
    attached.delete(canvas);
    if (!attached.size) {
      endDrag();
      select(null);
    }
  };
}

// ---- where the hand is on screen ----

interface Row {
  ids: number[];
  /** n + 1 strip edges (CSS px, relative to the canvas) */
  edges: number[];
  /** the row's top (its cards' top edges, on average) */
  top: number;
  /** how far (table units) each card moves sideways so that what shows of it lies over its strip */
  spread: number[];
}
interface HandShape {
  rows: Row[];
  /** above this line (CSS px) the finger has left the hand */
  top: number;
  x0: number;
  x1: number;
  /** a card's height on screen */
  cardPx: number;
  /** the card held up in front of you (it keeps its own tap): its outline on screen */
  held: [number, number][] | null;
  w: number;
  h: number;
}

const EUL = new THREE.Euler(0, 0, 0, 'YXZ');
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const M4 = new THREE.Matrix4();
const THREE_V = new THREE.Vector3();

/** a point on a card (local x, y on its face) on the screen, CSS px from the canvas' top left */
function onScreen(pos: readonly number[], q: THREE.Quaternion, s: number, lx: number, ly: number, w: number, h: number): [number, number] {
  P.set(lx * s, ly * s, 0).applyQuaternion(q).add(THREE_V.set(pos[0], pos[1], pos[2])).project(cam!);
  return [((P.x + 1) / 2) * w, ((1 - P.y) / 2) * h];
}
/** the four corners of a card where its target puts it */
function outline(t: Target, w: number, h: number) {
  EUL.set(t.rot[0], t.rot[1], t.rot[2]);
  Q.setFromEuler(EUL);
  const s = t.scale ?? 1;
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => onScreen(t.pos, Q, s, (a * CARD_W) / 2, (b * CARD_H) / 2, w, h));
}

/** the four corners of a card where it really is right now (the picked card, risen and grown) */
function liveOutline(o: THREE.Object3D, w: number, h: number) {
  o.updateWorldMatrix(true, false);
  M4.copy(o.matrixWorld);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => {
    P.set((a * CARD_W) / 2, (b * CARD_H) / 2, 0).applyMatrix4(M4).project(cam!);
    return [((P.x + 1) / 2) * w, ((1 - P.y) / 2) * h] as [number, number];
  });
}

function inside(poly: [number, number][], x: number, y: number) {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
  }
  return r;
}

/** Your hand on the screen right now: its rows, left to right, and the strip of screen that picks each card. */
function shape(w: number, h: number): HandShape | null {
  if (!cam) return null;
  cam.updateMatrixWorld();
  const list: { id: number; t: Target }[] = [];
  let held: [number, number][] | null = null;
  for (const [id, e] of cards) {
    const t = e.t;
    if (t.zone !== 'hand') continue;
    if (t.held) {
      held = outline(t, w, h);
      continue;
    }
    // the finale lays the hand flat on the table: nothing to pick any more
    if (Math.abs(t.rot[0] + Math.PI / 2) < 1e-3) continue;
    list.push({ id, t });
  }
  if (!list.length) return null;
  list.sort((a, b) => (a.t.seq ?? 0) - (b.t.seq ?? 0));
  // a big hand lies in two rows: each row runs left to right, the second starts back on the left
  const groups: { id: number; t: Target }[][] = [[]];
  for (const c of list) {
    const g = groups[groups.length - 1];
    if (g.length && c.t.pos[0] < g[g.length - 1].t.pos[0]) groups.push([c]);
    else g.push(c);
  }
  let top = Infinity;
  let cardPx = 0;
  const rows: Row[] = groups.map(g => {
    const natural: number[] = [];
    /** pixels per table unit along the hand, at each card */
    const ppu: number[] = [];
    let rowTop = 0;
    g.forEach((c, i) => {
      EUL.set(c.t.rot[0], c.t.rot[1], c.t.rot[2]);
      Q.setFromEuler(EUL);
      const s = c.t.scale ?? 1;
      // what shows of a card: from its left edge (at mid height) to the next card's
      const left = onScreen(c.t.pos, Q, s, -CARD_W / 2, 0, w, h)[0];
      natural.push(left);
      ppu.push(Math.max(1e-3, onScreen([c.t.pos[0] + 0.1, c.t.pos[1], c.t.pos[2]], Q, s, -CARD_W / 2, 0, w, h)[0] - left) * 10);
      if (i === g.length - 1) natural.push(onScreen(c.t.pos, Q, s, CARD_W / 2, 0, w, h)[0]);
      const up = onScreen(c.t.pos, Q, s, 0, CARD_H / 2, w, h)[1];
      const down = onScreen(c.t.pos, Q, s, 0, -CARD_H / 2, w, h)[1];
      rowTop += up;
      cardPx = Math.max(cardPx, down - up);
      top = Math.min(top, up);
    });
    // edges must run left to right even where a raised card stands over its neighbour
    for (let i = 1; i < natural.length; i++) natural[i] = Math.max(natural[i], natural[i - 1]);
    const edges = slotEdges(natural, MIN_SLOT, 4, w - 4);
    // the hand opens up to its strips: each card's showing part (no wider than its strip) centred on the strip
    const spread = g.map((_, i) => {
      const slot = edges[i + 1] - edges[i];
      const shows = Math.min(natural[i + 1] - natural[i], slot);
      return (edges[i] + slot / 2 - (natural[i] + shows / 2)) / ppu[i];
    });
    return { ids: g.map(c => c.id), edges, top: rowTop / g.length, spread };
  });
  rows.sort((a, b) => a.top - b.top);
  const x0 = Math.min(...rows.map(r => r.edges[0]));
  const x1 = Math.max(...rows.map(r => r.edges[r.edges.length - 1]));
  // just above the hand still counts: the picked card rises there
  return { rows, top: top - cardPx * 0.35, x0, x1, cardPx, held, w, h };
}

// ---- the gesture ----

/** finger travel (CSS px) that is no longer a tap */
const TAP_SLOP = 10;
/** a flick: this fast upward (px per ms), and at least this far */
const FLICK_V = 0.45;
const FLICK_D = 24;
/** a dragged card pulled up this share of the screen's height and released is played too */
const PULL_FRAC = 0.25;

const g = {
  pointer: null as number | null,
  hand: null as HandShape | null,
  /** which row the finger is on */
  row: 0,
  /** the card picked before this touch (a tap on it plays it) */
  before: null as number | null,
  x0: 0,
  y0: 0,
  t0: 0,
  moved: false,
  /** where the finger was when the picked card last changed: an upward move from here is a drag toward the pile */
  ax: 0,
  ay: 0,
  dragging: false,
  /** finger height when the drag began: back below it, the card goes back to the hand */
  dragY: 0,
  /** the last few finger heights, for the speed of a flick */
  ys: new Float64Array(8),
  ts: new Float64Array(8),
  k: 0,
  /** the browser's click after our touch must not reach the table */
  quietUntil: 0,
  lastTick: 0,
};

/** debug: what the last touch did */
const last = { play: null as { id: number; ok: boolean } | null, up: '' };

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_HEIGHT);

function select(id: number | null) {
  if (touchHand.sel === id) return;
  touchHand.sel = id;
  touchHand.room.clear();
  if (id === null) return;
  // the cards beside it step aside along the hand, the nearest the most
  const row = g.hand?.rows.find(r => r.ids.includes(id));
  const t = cards.get(id)?.t;
  if (row && t) {
    const i = row.ids.indexOf(id);
    const step = CARD_W * (t.scale ?? 1) * 0.3;
    row.ids.forEach((other, k) => {
      const aside = k === i ? 0 : Math.sign(k - i) * step * Math.exp(-(Math.abs(k - i) - 1) / 2.5);
      touchHand.room.set(other, row.spread[k] + aside);
    });
  }
  // a light tick under the finger for every card passed (not a buzz when sliding fast)
  const now = performance.now();
  if (now - g.lastTick > 35) {
    g.lastTick = now;
    haptics.play('light');
  }
}

/** Play the picked card, or shake it when it may not go now. */
function play(id: number) {
  const e = cards.get(id);
  last.play = { id, ok: !!e?.t.interactive };
  if (!e) return;
  if (e.t.interactive) {
    select(null);
    e.pick(id);
  } else {
    touchHand.shakeId = id;
    touchHand.shakeAt = performance.now();
    haptics.play('light');
  }
}

function endDrag() {
  if (!g.dragging) return;
  g.dragging = false;
  drag.id = null;
  drag.moved = false;
  drag.over = false;
}

/** The card follows the finger over the table (as with a mouse drag): over the pile, letting go plays it. */
function dragTo(canvas: HTMLCanvasElement, cx: number, cy: number) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam!);
  if (!ray.ray.intersectPlane(dragPlane, drag.point)) return;
  const near = Math.hypot(drag.point.x - dropZone.x, drag.point.z - dropZone.z) < dropZone.radius;
  drag.over = near || drag.point.z < dropZone.handZ - 2.2;
}

/** the card under the finger: its row (by height, held a little past the line), then its strip along the row */
function under(x: number, y: number, mayRise: boolean) {
  const H = g.hand!;
  let row = Math.min(g.row, H.rows.length - 1);
  // the rows' borders: the top of the row in front
  const hyst = H.cardPx * 0.08;
  while (row + 1 < H.rows.length && y > H.rows[row + 1].top + hyst) row++;
  while (mayRise && row > 0 && y < H.rows[row].top - hyst) row--;
  g.row = row;
  const R = H.rows[row];
  const cur = touchHand.sel !== null ? R.ids.indexOf(touchHand.sel) : -1;
  return R.ids[pickSlot(R.edges, x, cur >= 0 ? cur : null)] ?? touchHand.sel;
}

function listen(canvas: HTMLCanvasElement) {
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, r.width, r.height];
  };
  const sample = (y: number) => {
    g.ys[g.k % 8] = y;
    g.ts[g.k % 8] = performance.now();
    g.k++;
  };
  /** upward speed over the last ~100 ms (px per ms); on a slow device, over the last step if that is all there is */
  const rise = () => {
    const n = Math.min(g.k, 8);
    if (n < 2) return 0;
    const last = (g.k - 1) % 8;
    const now = g.ts[last];
    let j = (g.k - 2) % 8;
    for (let i = n - 1; i >= 2; i--) {
      const o = (g.k - 1 - i) % 8;
      if (now - g.ts[o] <= 110) {
        j = o;
        break;
      }
    }
    const dt = now - g.ts[j];
    return dt > 0 && dt <= 250 ? (g.ys[j] - g.ys[last]) / dt : 0;
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    // a second finger while one is on the hand: ignored
    if (g.pointer !== null) {
      e.stopPropagation();
      return;
    }
    const [x, y, w, h] = local(e);
    const H = shape(w, h);
    const sel = touchHand.sel;
    const selObj = sel !== null ? cards.get(sel)?.obj : null;
    // the picked card, risen over the hand, is the card under the finger wherever it shows
    const onSel = !!selObj && inside(liveOutline(selObj, w, h), x, y);
    const onHand = !!H && !(H.held && inside(H.held, x, y)) && y >= H.top && x >= H.x0 - 12 && x <= H.x1 + 12;
    if (!H || (!onSel && !onHand)) {
      // somewhere else on the table: the picked card goes back (and the tap does whatever it does there)
      select(null);
      return;
    }
    e.stopPropagation();
    g.pointer = e.pointerId;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // already captured by the touch itself
    }
    g.hand = H;
    g.before = sel;
    g.x0 = g.ax = x;
    g.y0 = g.ay = y;
    g.t0 = performance.now();
    g.moved = false;
    g.k = 0;
    sample(y);
    if (onSel) {
      g.row = Math.max(0, H.rows.findIndex(r => r.ids.includes(sel!)));
      return;
    }
    // the row the finger landed on: the lowest whose top it is under
    g.row = 0;
    for (let i = 1; i < H.rows.length; i++) if (y > H.rows[i].top) g.row = i;
    select(under(x, y, true));
  };

  const move = (e: PointerEvent) => {
    if (e.pointerId !== g.pointer || !g.hand) return;
    e.stopPropagation();
    const [x, y] = local(e);
    sample(y);
    const sel = touchHand.sel;
    const playable = sel !== null && !!cards.get(sel)?.t.interactive;
    const lift = () => {
      g.dragging = true;
      g.dragY = y;
      drag.id = sel;
      drag.moved = true;
      drag.over = false;
      dragTo(canvas, e.clientX, e.clientY);
    };
    if (!g.moved) {
      if (Math.hypot(x - g.x0, y - g.y0) < TAP_SLOP) return;
      g.moved = true;
      // the first move decides: up (steeper than about 27°) on a card you may play takes it out of the hand at once,
      // even on its way to a pile off to the side; anything flatter slides along the hand
      if (playable && g.y0 - y > 0.5 * Math.abs(x - g.x0)) return lift();
    }
    if (g.dragging) {
      // back down to where the drag began: the card returns to the hand and the finger picks again
      if (y > g.dragY + 12) {
        endDrag();
        g.ax = x;
        g.ay = y;
      } else {
        dragTo(canvas, e.clientX, e.clientY);
        return;
      }
    }
    const upward = g.ay - y;
    const reach = Math.max(30, g.hand.cardPx * 0.3);
    // pushed up away from the hand (more up than sideways): the card leaves the hand with the finger
    if (playable && upward >= reach && upward > Math.abs(x - g.ax)) return lift();
    // above the hand: the choice stays as it is
    if (y < g.hand.top) return;
    // up into the row behind only by sliding there (an upward push is a drag toward the pile)
    const id = under(x, y, !playable || Math.abs(x - g.ax) > Math.abs(y - g.ay));
    if (id !== touchHand.sel) {
      select(id);
      g.ax = x;
      g.ay = y;
    }
  };

  const up = (e: PointerEvent) => {
    if (e.pointerId !== g.pointer) return;
    e.stopPropagation();
    g.pointer = null;
    g.quietUntil = performance.now() + 450;
    drag.suppressClickUntil = g.quietUntil;
    const [, y, , h] = local(e);
    sample(y);
    const sel = touchHand.sel;
    // a quick flick up, or a card clearly pulled up out of the hand (a quarter of the screen) and let go:
    // either way the player meant "play it", even short of the pile and however slowly the finger moved
    const pulled = g.dragging && g.y0 - y >= h * PULL_FRAC;
    const flick = (rise() >= FLICK_V && g.y0 - y >= FLICK_D) || pulled;
    // however long it was held: a finger that stays put on the card already picked means "this one"
    const tap = !g.moved;
    const over = g.dragging && drag.over;
    last.up = `ms=${Math.round(performance.now() - g.t0)} moved=${g.moved} tap=${tap} flick=${flick} rise=${rise().toFixed(2)} drag=${g.dragging} over=${over} before=${g.before} sel=${sel}`;
    endDrag();
    g.hand = null;
    if (sel === null || e.type === 'pointercancel') return;
    if (over || flick) play(sel);
    // a tap on the card already picked plays it; a tap on another one just picks that one
    else if (tap && g.before === sel) play(sel);
  };

  /** the click the browser sends after a touch we handled: not for the table (the cards, the deck…) */
  const click = (e: MouseEvent) => {
    if (performance.now() < g.quietUntil) e.stopPropagation();
  };

  /** a finger anywhere off the table (the HUD, a menu): the picked card goes back too */
  const away = (e: PointerEvent) => {
    if (e.pointerType === 'touch' && e.target !== canvas && g.pointer === null) select(null);
  };

  window.addEventListener('pointerdown', away, true);
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('click', click);
  return () => {
    window.removeEventListener('pointerdown', away, true);
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
    canvas.removeEventListener('click', click);
    g.pointer = null;
  };
}

/** debug and tests: the card picked by the finger, and the hand's strips on screen */
export function touchDebug() {
  const c = cam ? [...attached.keys()][0] : null;
  const r = c?.getBoundingClientRect();
  const H = r ? shape(r.width, r.height) : null;
  return { sel: touchHand.sel, dragging: g.dragging, last, rows: H?.rows.map(x => ({ ids: x.ids, edges: x.edges.map(Math.round), top: Math.round(x.top) })), top: H?.top };
}
exposeDebug('__touch', touchDebug);
