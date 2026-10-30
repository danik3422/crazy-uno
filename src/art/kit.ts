/**
 * The drawing kit for the avatar portraits (and the small UI icons): the same look as the drawn card icons
 * (src/three/themes/icons.ts) — bold dark ink outline, light from the top-left, soft gradients, a glossy
 * highlight. Everything is drawn in a 100 × 100 box (origin top-left) and scaled by the caller.
 */
export type Ctx = CanvasRenderingContext2D;

export const INK = '#22182e';
export const TAU = Math.PI * 2;

/** outline width in box units (set per paint: heavier when the picture is shown small) */
let LW = 3.2;
export const lw = () => LW;
export function setLineWidth(w: number) {
  LW = w;
}

/* ---------- colour ---------- */

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
/** `a` blended towards `b` by t (0..1) */
export function mix(a: string, b: string, t: number) {
  const x = rgb(a);
  const y = rgb(b);
  return `#${hex2(x[0] + (y[0] - x[0]) * t)}${hex2(x[1] + (y[1] - x[1]) * t)}${hex2(x[2] + (y[2] - x[2]) * t)}`;
}
export const lite = (c: string, t = 0.4) => mix(c, '#ffffff', t);
/** darker, towards a deep violet (richer shadows than black) */
export const deep = (c: string, t = 0.3) => mix(c, '#1c0b30', t);
export function rgba(c: string, a: number) {
  const [r, g, b] = rgb(c);
  return `rgba(${r},${g},${b},${a})`;
}

/* ---------- gradients & paint ---------- */

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: string[]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
export function rad(ctx: Ctx, x: number, y: number, r: number, stops: string[], x0 = x, y0 = y) {
  const g = ctx.createRadialGradient(x0, y0, 0, x, y, r);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
/** a fill lit from the top-left, for a shape inside the box (x0,y0)–(x1,y1) */
export function shade(ctx: Ctx, c: string, x0: number, y0: number, x1: number, y1: number) {
  const w = x1 - x0;
  const h = y1 - y0;
  const r = Math.max(w, h) * 0.95;
  return rad(ctx, x0 + w * 0.42, y0 + h * 0.45, r, [lite(c, 0.32), c, c, deep(c, 0.3)], x0 + w * 0.3, y0 + h * 0.22);
}
/** fills the current path and outlines it in ink */
export function paint(ctx: Ctx, fill: string | CanvasGradient, w = LW) {
  ctx.fillStyle = fill;
  ctx.fill();
  if (w > 0) {
    ctx.lineWidth = w;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}
export function fillOnly(ctx: Ctx, fill: string | CanvasGradient) {
  ctx.fillStyle = fill;
  ctx.fill();
}
/** strokes the current path in ink (or `color`) */
export function line(ctx: Ctx, w = LW, color = INK) {
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/* ---------- shapes ---------- */

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
}
export function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
}
export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
export function poly(ctx: Ctx, pts: number[]) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}
export function star(ctx: Ctx, x: number, y: number, r: number, inner: number, points: number, rot = 0) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot - Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? inner : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}
/** a white glossy highlight */
export function gloss(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0, a = 0.55) {
  ellipse(ctx, x, y, rx, ry, rot);
  ctx.fillStyle = `rgba(255,255,255,${a})`;
  ctx.fill();
}
/**
 * Several overlapping circles drawn as one outlined blob (curly hair, clouds, manes, frosting):
 * a thick ink pass under all of them, then the fills on top.
 */
export function blobs(ctx: Ctx, cs: [number, number, number][], fill: string | CanvasGradient, w = LW) {
  ctx.lineWidth = w * 2;
  ctx.strokeStyle = INK;
  for (const [x, y, r] of cs) {
    circle(ctx, x, y, r);
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const [x, y, r] of cs) {
    circle(ctx, x, y, r);
    ctx.fill();
  }
}
/** clips to the current path while `f` draws (shading and pattern inside a shape) */
export function inside(ctx: Ctx, path: () => void, f: () => void) {
  ctx.save();
  path();
  ctx.clip();
  f();
  ctx.restore();
}

/* ---------- face parts ---------- */

export type EyeKind = 'dot' | 'big' | 'happy' | 'sleepy' | 'wink' | 'oval' | 'star';

/** a pair of eyes at x1 / x2, height y; `s` scales them */
export function eyes(ctx: Ctx, kind: EyeKind, x1: number, x2: number, y: number, s = 1, o: { iris?: string; lash?: boolean; look?: number } = {}) {
  const look = o.look ?? 0;
  const one = (x: number, k: EyeKind, side: number) => {
    switch (k) {
      case 'dot':
        ellipse(ctx, x + look, y, 3.2 * s, 4 * s);
        fillOnly(ctx, INK);
        circle(ctx, x + look - 1.1 * s, y - 1.5 * s, 1.25 * s);
        fillOnly(ctx, '#fff');
        break;
      case 'oval':
        ellipse(ctx, x + look, y, 2.4 * s, 3.6 * s);
        fillOnly(ctx, INK);
        circle(ctx, x + look - 0.7 * s, y - 1.3 * s, 0.95 * s);
        fillOnly(ctx, '#fff');
        break;
      case 'big': {
        ellipse(ctx, x, y, 5.6 * s, 6.6 * s);
        paint(ctx, lin(ctx, x, y - 6 * s, x, y + 6 * s, ['#ffffff', '#ffffff', '#dfe3f0']), LW * 0.75);
        const ix = x + look * 1.6;
        circle(ctx, ix, y + 0.9 * s, 4 * s);
        fillOnly(ctx, rad(ctx, ix, y + 0.9 * s, 4 * s, [lite(o.iris ?? '#5b3a1e', 0.35), o.iris ?? '#5b3a1e', deep(o.iris ?? '#5b3a1e', 0.35)]));
        circle(ctx, ix, y + 1.1 * s, 2.1 * s);
        fillOnly(ctx, INK);
        circle(ctx, ix - 1.5 * s, y - 1 * s, 1.35 * s);
        fillOnly(ctx, '#fff');
        if (o.lash) {
          ctx.beginPath();
          ctx.moveTo(x + side * 4.6 * s, y - 4.4 * s);
          ctx.lineTo(x + side * 7.6 * s, y - 6.8 * s);
          ctx.moveTo(x + side * 2.2 * s, y - 6.2 * s);
          ctx.lineTo(x + side * 3.6 * s, y - 9.2 * s);
          ctx.lineCap = 'round';
          line(ctx, LW * 0.6);
        }
        break;
      }
      case 'happy':
        ctx.beginPath();
        ctx.arc(x, y + 1.6 * s, 3.8 * s, Math.PI * 1.12, Math.PI * 1.88);
        ctx.lineCap = 'round';
        line(ctx, LW * 0.85);
        break;
      case 'sleepy':
        ctx.beginPath();
        ctx.ellipse(x, y + 0.6 * s, 3.6 * s, 2.6 * s, 0, 0, Math.PI);
        ctx.closePath();
        fillOnly(ctx, INK);
        ctx.beginPath();
        ctx.moveTo(x - 4.6 * s, y + 0.2 * s);
        ctx.quadraticCurveTo(x, y - 1.4 * s, x + 4.6 * s, y + 0.2 * s);
        ctx.lineCap = 'round';
        line(ctx, LW * 0.75);
        circle(ctx, x - 1 * s, y + 1.4 * s, 0.9 * s);
        fillOnly(ctx, '#fff');
        break;
      case 'star':
        star(ctx, x, y, 5 * s, 2.3 * s, 5);
        paint(ctx, lin(ctx, x, y - 5 * s, x, y + 5 * s, ['#fff6b0', '#ffc928']), LW * 0.6);
        break;
      case 'wink':
        one(x, side < 0 ? 'dot' : 'happy', side);
        break;
    }
  };
  one(x1, kind, -1);
  one(x2, kind, 1);
}

export type MouthKind = 'smile' | 'grin' | 'open' | 'cat' | 'fangs' | 'tongue' | 'smirk' | 'o' | 'toothy' | 'flat';

export function mouth(ctx: Ctx, kind: MouthKind, x: number, y: number, w = 1) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const grin = (h: number, gap = false) => {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x - 8 * w, y);
      ctx.quadraticCurveTo(x, y + 2 * w, x + 8 * w, y);
      ctx.quadraticCurveTo(x + 7 * w, y + h * w, x, y + h * w);
      ctx.quadraticCurveTo(x - 7 * w, y + h * w, x - 8 * w, y);
      ctx.closePath();
    };
    path();
    fillOnly(ctx, '#6e1634');
    inside(ctx, path, () => {
      ellipse(ctx, x + 1.5 * w, y + h * w, 5.5 * w, 4 * w);
      fillOnly(ctx, '#ff6f87');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 9 * w, y - 1, 18 * w, 3.4 * w);
      if (gap) {
        ctx.fillStyle = '#6e1634';
        ctx.fillRect(x - 0.7 * w, y, 1.4 * w, 3.6 * w);
      }
    });
    path();
    line(ctx, LW * 0.8);
  };
  switch (kind) {
    case 'smile':
      ctx.beginPath();
      ctx.arc(x, y - 4 * w, 6.5 * w, Math.PI * 0.2, Math.PI * 0.8);
      line(ctx, LW * 0.85);
      break;
    case 'flat':
      ctx.beginPath();
      ctx.moveTo(x - 4 * w, y);
      ctx.quadraticCurveTo(x, y + 1.6 * w, x + 4 * w, y);
      line(ctx, LW * 0.8);
      break;
    case 'grin':
      grin(9);
      break;
    case 'toothy':
      grin(8, true);
      break;
    case 'open': {
      const path = () => ellipse(ctx, x, y + 3.5 * w, 4 * w, 4.8 * w);
      path();
      fillOnly(ctx, '#6e1634');
      inside(ctx, path, () => {
        ellipse(ctx, x, y + 8 * w, 4 * w, 3 * w);
        fillOnly(ctx, '#ff6f87');
      });
      path();
      line(ctx, LW * 0.8);
      break;
    }
    case 'o':
      ellipse(ctx, x, y + 2 * w, 2.4 * w, 2.8 * w);
      paint(ctx, '#6e1634', LW * 0.7);
      break;
    case 'cat':
      ctx.beginPath();
      ctx.arc(x - 2.8 * w, y, 2.8 * w, Math.PI * 0.05, Math.PI * 0.95);
      ctx.moveTo(x + 5.6 * w, y);
      ctx.arc(x + 2.8 * w, y, 2.8 * w, Math.PI * 0.05, Math.PI * 0.95);
      line(ctx, LW * 0.8);
      break;
    case 'fangs':
      for (const s of [-1, 1]) {
        poly(ctx, [x + s * 2 * w, y + 2.4 * w, x + s * 5.2 * w, y + 1.8 * w, x + s * 3.8 * w, y + 6.4 * w]);
        paint(ctx, '#ffffff', LW * 0.55);
      }
      ctx.beginPath();
      ctx.moveTo(x - 8 * w, y);
      ctx.quadraticCurveTo(x, y + 5 * w, x + 8 * w, y);
      line(ctx, LW * 0.85);
      break;
    case 'tongue': {
      ctx.beginPath();
      ctx.moveTo(x + 0.5 * w, y + 2.6 * w);
      ctx.lineTo(x + 0.5 * w, y + 5 * w);
      ctx.arc(x + 3.3 * w, y + 5 * w, 2.8 * w, Math.PI, 0, true);
      ctx.lineTo(x + 6.1 * w, y + 2 * w);
      ctx.closePath();
      paint(ctx, '#ff6f87', LW * 0.7);
      ctx.beginPath();
      ctx.arc(x, y - 4 * w, 6.5 * w, Math.PI * 0.2, Math.PI * 0.8);
      line(ctx, LW * 0.85);
      break;
    }
    case 'smirk':
      ctx.beginPath();
      ctx.moveTo(x - 5 * w, y + 1 * w);
      ctx.quadraticCurveTo(x + 1 * w, y + 4.4 * w, x + 6.5 * w, y - 1.4 * w);
      line(ctx, LW * 0.85);
      break;
  }
}

/** rosy cheeks */
export function blush(ctx: Ctx, x1: number, x2: number, y: number, r = 4.5, a = 0.55, c = '#ff6f8e') {
  for (const x of [x1, x2]) {
    ellipse(ctx, x, y, r * 1.25, r * 0.8);
    fillOnly(ctx, rad(ctx, x, y, r * 1.25, [rgba(c, a), rgba(c, 0)]));
  }
}

/** a small rounded-triangle animal nose with a shine */
export function snout(ctx: Ctx, x: number, y: number, s = 1, c = INK) {
  ctx.beginPath();
  ctx.moveTo(x - 3.4 * s, y - 1.6 * s);
  ctx.quadraticCurveTo(x, y - 3 * s, x + 3.4 * s, y - 1.6 * s);
  ctx.quadraticCurveTo(x + 2.6 * s, y + 2.4 * s, x, y + 2.6 * s);
  ctx.quadraticCurveTo(x - 2.6 * s, y + 2.4 * s, x - 3.4 * s, y - 1.6 * s);
  ctx.closePath();
  paint(ctx, c === INK ? lin(ctx, x, y - 3, x, y + 3, ['#5a4a6a', INK]) : c, LW * 0.6);
  gloss(ctx, x - 1, y - 1.2 * s, 1.3 * s, 0.7 * s, 0, 0.7);
}

/** short brows above the eyes */
export function brows(ctx: Ctx, x1: number, x2: number, y: number, color: string, kind: 'arc' | 'thick' | 'angry' | 'worried' = 'arc', w = 1) {
  ctx.lineCap = 'round';
  for (const [x, s] of [[x1, -1], [x2, 1]] as const) {
    ctx.beginPath();
    if (kind === 'angry') {
      ctx.moveTo(x + s * 4 * w, y - 1.6);
      ctx.lineTo(x - s * 3.4 * w, y + 1.4);
    } else if (kind === 'worried') {
      ctx.moveTo(x + s * 4 * w, y + 1.2);
      ctx.lineTo(x - s * 3.4 * w, y - 1.4);
    } else {
      ctx.moveTo(x - 3.6 * w, y + 0.8);
      ctx.quadraticCurveTo(x, y - 1.8, x + 3.6 * w, y + 0.8);
    }
    line(ctx, (kind === 'thick' ? LW * 1.25 : LW * 0.8) * w, color);
  }
}

/** the shoulders and neck of a portrait bust; returns nothing, draws from y≈74 down */
export function bust(ctx: Ctx, color: string, o: { neck?: string; top?: number; wide?: number } = {}) {
  const top = o.top ?? 80;
  const wd = o.wide ?? 0;
  if (o.neck) {
    rrect(ctx, 43, top - 14, 14, 20, 5);
    paint(ctx, lin(ctx, 0, top - 14, 0, top + 4, [deep(o.neck, 0.3), o.neck]));
  }
  ctx.beginPath();
  ctx.moveTo(8 - wd, 104);
  ctx.bezierCurveTo(9 - wd, 88, 24, top, 50, top);
  ctx.bezierCurveTo(76, top, 91 + wd, 88, 92 + wd, 104);
  ctx.closePath();
  paint(ctx, shade(ctx, color, 8, top, 92, 112));
}

/** the bust's outline path, for clipping collars and patterns onto it */
export function bustPath(ctx: Ctx, top = 80, wd = 0) {
  ctx.beginPath();
  ctx.moveTo(8 - wd, 104);
  ctx.bezierCurveTo(9 - wd, 88, 24, top, 50, top);
  ctx.bezierCurveTo(76, top, 91 + wd, 88, 92 + wd, 104);
  ctx.closePath();
}

/** a round head (centre, radii) with the light from the top-left */
export function head(ctx: Ctx, c: string, x: number, y: number, rx: number, ry: number) {
  ellipse(ctx, x, y, rx, ry);
  paint(ctx, shade(ctx, c, x - rx, y - ry, x + rx, y + ry));
}

/** several shapes (path builders) drawn as one outlined silhouette */
export function merged(ctx: Ctx, paths: (() => void)[], fill: string | CanvasGradient, w = LW) {
  ctx.lineWidth = w * 2;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  for (const p of paths) {
    p();
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  for (const p of paths) {
    p();
    ctx.fill();
  }
}

/** a thick coloured stroke with an ink casing (tentacles, horns, antennae) */
export function cased(ctx: Ctx, path: () => void, color: string | CanvasGradient, w: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  path();
  ctx.lineWidth = w + LW * 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  path();
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}
