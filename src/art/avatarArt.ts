/**
 * Paints the avatar portraits (see src/game/avatars.ts for the list) and caches them as images.
 *
 * Each avatar is drawn with Canvas 2D paths in a 100 × 100 box: a coloured tile with a soft pattern and a
 * character on it (people are assembled from parts in people.ts, robots in robots.ts, the rest are drawn by
 * hand in creatures.ts). Pictures are painted at the size they are shown (×2 for sharp screens) and kept
 * as data URLs; `requestAvatarUrl` paints in short slices, a few per task, so opening a picker page never janks.
 */
import { type Avatar, avatarOf } from '../game/avatars';
import { CREATURES } from './creatures';
import { circle, type Ctx, ellipse, fillOnly, lin, lite, rad, rgba, setLineWidth, star, TAU } from './kit';
import { drawPerson, type Person, SKIN } from './people';
import { drawRobot, type RobotLook } from './robots';

type Draw = (ctx: Ctx) => void;

const PEOPLE: Record<string, Person> = {
  cool: { skin: SKIN.tan, hair: 'quiff', hairColor: '#2a1a12', glasses: 'shades', mouth: 'smirk', clothes: 'jacket', shirt: '#2e2840', shirt2: '#ff4a6a' },
  puffs: { skin: SKIN.dark, hair: 'puffs', hairColor: '#2a1a14', eyes: 'big', iris: '#5b3a1e', lash: true, mouth: 'grin', clothes: 'stripes', shirt: '#ffcf2e', shirt2: '#ff5fa2', earrings: 'hoop' },
  beard: { skin: SKIN.medium, hair: 'short', hairColor: '#2e1c12', hat: 'beanie', hatColor: '#ff8a1f', hat2: '#ffe14a', beard: 'full', eyes: 'happy', brows: 'thick', clothes: 'hoodie', shirt: '#3a7bd5' },
  granny: { skin: SKIN.light, hair: 'bun', hairColor: '#dcdfea', glasses: 'round', glassColor: '#d8304a', brows: 'arc', mouth: 'smile', clothes: 'cardigan', shirt: '#ff7aa8', shirt2: '#fff0f5', earrings: 'pearl' },
  cowboy: { skin: SKIN.light, hair: 'short', hairColor: '#6b3a1a', hat: 'cowboy', hatColor: '#b06a2a', hat2: '#3a2014', beard: 'stache', mouth: 'grin', clothes: 'bandana', shirt: '#4a7ad8', shirt2: '#e8304a' },
  kid: { skin: SKIN.porcelain, hair: 'short', hairColor: '#e0702a', hat: 'capBack', hatColor: '#e8304a', hat2: '#ffffff', freckles: true, eyes: 'big', iris: '#3a8a3a', mouth: 'toothy', clothes: 'tee', shirt: '#ffd23f' },
  hijabi: { skin: SKIN.brown, hat: 'hijab', hatColor: '#2bb3a0', eyes: 'big', iris: '#4a2a14', lash: true, brows: 'arc', hairColor: '#2a1a12', mouth: 'smile', clothes: 'tee', shirt: '#ff7a5a' },
  punk: { skin: SKIN.porcelain, hair: 'mohawk', hairColor: '#b44dff', eyes: 'wink', mouth: 'tongue', clothes: 'jacket', shirt: '#2e2840', shirt2: '#ff4ad0', earrings: 'stud' },
  chef: { skin: SKIN.brown, hair: 'short', hairColor: '#1e140e', hat: 'chef', beard: 'stache', eyes: 'happy', mouth: 'grin', clothes: 'apron', shirt: '#eef1f8', shirt2: '#e8304a' },
  rocker: { skin: SKIN.light, hair: 'bob', hairColor: '#7a4dff', hat: 'headphones', hatColor: '#2e2840', hat2: '#ff4a8a', eyes: 'happy', mouth: 'open', clothes: 'tee', shirt: '#2e2840', earrings: 'star' },
  curly: { skin: SKIN.dark, hair: 'fade', hairColor: '#1a1210', glasses: 'square', glassColor: '#ffcf2e', mouth: 'grin', clothes: 'suit', shirt: '#3a7bd5', shirt2: '#ffcf2e' },
  clown: { skin: '#fff6ee', hair: 'clown', nose: 'red', eyes: 'big', iris: '#3a8af0', brows: 'arc', hairColor: '#2a1a12', mouth: 'grin', clothes: 'ruff', shirt: '#ffcf2e', shirt2: '#ff4a6a' },
  wizard: { skin: SKIN.light, hairColor: '#dfe3ef', hat: 'wizard', hatColor: '#5a3cd8', hat2: '#ffd84a', beard: 'long', brows: 'thick', eyes: 'happy', clothes: 'robe', shirt: '#5a3cd8', shirt2: '#ffd84a' },
  knight: { skin: SKIN.tan, hat: 'helmet', hatColor: '#b8c4d8', hairColor: '#3b2417', brows: 'arc', eyes: 'dot', mouth: 'grin', clothes: 'armor', shirt: '#b8c4d8', shirt2: '#e8304a' },
  mermaid: {
    skin: SKIN.tan, hair: 'wavy', hairColor: '#ff5a7a', eyes: 'big', iris: '#1fae9a', lash: true, mouth: 'smile', clothes: 'scales', shirt: '#2fc4b0', shirt2: '#ffb0c8', earrings: 'pearl',
    extra: ctx => starfish(ctx, 68, 30),
  },
  vampire: { skin: SKIN.pale, hair: 'slick', hairColor: '#1a1226', eyes: 'big', iris: '#e8203a', brows: 'angry', mouth: 'fangs', clothes: 'cape', shirt: '#1e1430', shirt2: '#c8203a' },
  astronaut: { skin: SKIN.dark, hair: 'fade', hairColor: '#1a1210', hat: 'astro', eyes: 'big', iris: '#4a2a14', mouth: 'grin', clothes: 'space', shirt: '#eef1f8' },
  pirate: { skin: SKIN.medium, hat: 'tricorn', hatColor: '#2e2840', hat2: '#ffcf2e', glasses: 'patch', beard: 'full', beardColor: '#c8501a', hairColor: '#c8501a', brows: 'thick', mouth: 'grin', clothes: 'stripes', shirt: '#ffffff', shirt2: '#e8304a', earrings: 'hoop' },
};

const ROBOTS: Record<string, RobotLook> = {
  'bot-red': { body: '#e8402f', face: '#2a1418', eye: '#ffcf4a', head: 'round', eyes: 'round', mouth: 'smile', antenna: 'ball', ears: 'bolt' },
  'bot-blue': { body: '#6f7fe0', face: '#1c1e3a', eye: '#ffe066', head: 'dome', eyes: 'visor', mouth: 'grille', antenna: 'twin', ears: 'disc' },
  'bot-mint': { body: '#55d6b0', face: '#14302b', eye: '#ff6b5e', head: 'square', eyes: 'square', mouth: 'teeth', antenna: 'bolt', ears: 'fin' },
  'bot-gold': { body: '#f2b822', face: '#2a1e08', eye: '#5ae0ff', head: 'tv', eyes: 'happy', mouth: 'meter', antenna: 'dish', ears: 'none' },
  'bot-pink': { body: '#ff7fb6', face: '#3a1028', eye: '#ffffff', head: 'capsule', eyes: 'hearts', mouth: 'o', antenna: 'twin', ears: 'disc', cheeks: true },
  'bot-steel': { body: '#9aa8bd', face: '#161c28', eye: '#7dff8a', head: 'bucket', eyes: 'cyclops', mouth: 'zigzag', antenna: 'bolt', ears: 'bolt' },
  'bot-lime': { body: '#9be15d', face: '#1a2a10', eye: '#ff7ad8', head: 'hex', eyes: 'wide', mouth: 'smile', antenna: 'spring', ears: 'none' },
  'bot-violet': { body: '#9b6cff', face: '#1a1238', eye: '#7dfff0', head: 'round', eyes: 'sleepy', mouth: 'smile', antenna: 'propeller', ears: 'disc' },
  'bot-orange': { body: '#ff9a3c', face: '#2a160a', eye: '#7ae0ff', head: 'trapezoid', eyes: 'round', mouth: 'grille', antenna: 'ball', ears: 'fin' },
  'bot-cyan': { body: '#3ad0ff', face: '#0e2236', eye: '#ffd84a', head: 'capsule', eyes: 'visor', mouth: 'smile', antenna: 'none', ears: 'bolt' },
  'bot-navy': { body: '#4d5fb8', face: '#121630', eye: '#ff9a3c', head: 'square', eyes: 'cyclops', mouth: 'teeth', antenna: 'dish', ears: 'disc' },
  'bot-cream': { body: '#f4e3c3', face: '#2a2420', eye: '#ff6b5e', head: 'tv', eyes: 'round', mouth: 'zigzag', antenna: 'twin', ears: 'none' },
  'bot-coral': { body: '#ff6f61', face: '#2a1014', eye: '#ffe066', head: 'dome', eyes: 'happy', mouth: 'o', antenna: 'propeller', ears: 'bolt', cheeks: true },
  'bot-teal': { body: '#1fb5a5', face: '#0e2422', eye: '#ffe066', head: 'bucket', eyes: 'square', mouth: 'smile', antenna: 'spring', ears: 'disc' },
  'bot-ink': { body: '#4a4466', face: '#100c18', eye: '#ff3a4a', head: 'hex', eyes: 'visor', mouth: 'meter', antenna: 'bolt', ears: 'fin' },
  'bot-sun': { body: '#ffd23f', face: '#2a2008', eye: '#ff5aa8', head: 'round', eyes: 'star', mouth: 'smile', antenna: 'ball', ears: 'fin', cheeks: true },
};

/** tiles with a night sky instead of sun rays */
const NIGHT = new Set(['ghost', 'pumpkin', 'astronaut', 'wildstar']);

function artOf(id: string): Draw | undefined {
  if (CREATURES[id]) return CREATURES[id];
  const p = PEOPLE[id];
  if (p) return ctx => drawPerson(ctx, p);
  const r = ROBOTS[id];
  if (r) return ctx => drawRobot(ctx, r);
  return undefined;
}

/** true when every avatar in the list has a picture (used by the tests) */
export function hasArt(id: string) {
  return artOf(id) !== undefined;
}

function starfish(ctx: Ctx, x: number, y: number) {
  star(ctx, x, y, 6.4, 3, 5, 0.3);
  ctx.lineJoin = 'round';
  ctx.fillStyle = lin(ctx, x, y - 6, x, y + 6, ['#fff1a0', '#ffb02e']);
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = '#22182e';
  ctx.stroke();
}

function background(ctx: Ctx, a: Avatar) {
  const [c0, c1] = a.bg;
  ctx.fillStyle = rad(ctx, 34, 24, 118, [lite(c0, 0.25), c0, c1], 30, 18);
  ctx.fillRect(-4, -4, 108, 108);
  if (NIGHT.has(a.id)) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [x, y, r] of [[12, 14, 1.2], [84, 12, 1.6], [90, 40, 1], [8, 50, 1], [20, 84, 1.3], [88, 74, 1.1], [64, 6, 0.9], [30, 6, 0.8]]) {
      circle(ctx, x, y, r);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (const [x, y, r] of [[16, 30, 2.6], [82, 26, 2.2]]) {
      star(ctx, x, y, r, r * 0.3, 4);
      ctx.fill();
    }
  } else if (a.kind === 'robot') {
    // a faint circuit grid
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let v = 10; v < 100; v += 16) {
      ctx.moveTo(v, 0);
      ctx.lineTo(v, 100);
      ctx.moveTo(0, v);
      ctx.lineTo(100, v);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    for (const [x, y] of [[10, 26], [42, 10], [90, 42], [74, 10], [10, 74], [90, 90]]) {
      circle(ctx, x, y, 1.8);
      ctx.fill();
    }
  } else {
    // soft sun rays from behind the head
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + 0.12;
      ctx.beginPath();
      ctx.moveTo(50, 50);
      ctx.arc(50, 50, 90, a0, a0 + TAU / n / 2);
      ctx.closePath();
      ctx.fill();
    }
  }
  // a glow behind the character
  ellipse(ctx, 50, 46, 40, 40);
  fillOnly(ctx, rad(ctx, 50, 46, 40, ['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']));
  // and a little depth at the bottom
  ctx.fillStyle = lin(ctx, 0, 60, 0, 100, ['rgba(20,0,40,0)', rgba('#14002a', 0.22)]);
  ctx.fillRect(-4, 60, 108, 44);
}

/**
 * Paints avatar `a` into a `px` × `px` square at the context's origin.
 * Small pictures get a heavier outline and a slightly closer crop, so the face reads at chip size.
 */
export function drawAvatar(ctx: Ctx, a: Avatar, px: number) {
  ctx.save();
  ctx.scale(px / 100, px / 100);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  background(ctx, a);
  const small = px <= 72;
  setLineWidth(small ? 4.4 : px <= 140 ? 3.5 : 3.1);
  if (small) {
    ctx.translate(50, 52);
    ctx.scale(1.1, 1.1);
    ctx.translate(-50, -50);
  }
  artOf(a.id)?.(ctx);
  ctx.restore();
}

/* ---------- cached images ---------- */

const urls = new Map<string, string>();
const keyOf = (id: string, px: number) => `${id}@${px}`;

/** the image size (device pixels) for an avatar shown `css` px wide */
export function avatarPx(css: number) {
  const dpr = typeof devicePixelRatio === 'number' ? Math.min(2, Math.max(1.5, devicePixelRatio)) : 2;
  return Math.min(512, Math.max(32, Math.ceil((css * dpr) / 16) * 16));
}

function paintUrl(a: Avatar, px: number) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = px;
  drawAvatar(cv.getContext('2d')!, a, px);
  return cv.toDataURL('image/png');
}

export function peekAvatarUrl(id: string, px: number) {
  return urls.get(keyOf(id, px));
}

/** the picture of avatar `id` at `px` pixels, painted now if it is not cached yet */
export function avatarUrl(id: string, px: number): string {
  const k = keyOf(id, px);
  let u = urls.get(k);
  if (!u) {
    u = paintUrl(avatarOf(id, id, false), px);
    urls.set(k, u);
  }
  return u;
}

/*
 * Painting queue: short time slices (~10 ms, a few pictures each) in separate tasks, so taps, scrolling
 * and the 3D table keep running in between. Not idle callbacks: a page with a live 3D scene is rarely
 * idle, and a picker page that someone just opened should fill in within a few frames.
 */
const waiting = new Map<string, Set<() => void>>();
const order: [string, number][] = [];
let scheduled = false;

const later = (f: () => void) => setTimeout(f, 0);

function pump() {
  scheduled = false;
  const t0 = performance.now();
  let n = 0;
  while (order.length && (n === 0 || performance.now() - t0 < 10)) {
    const [id, px] = order.shift()!;
    const k = keyOf(id, px);
    const cbs = waiting.get(k);
    waiting.delete(k);
    // nobody waits for it any more (the tile went away)
    if (!cbs || !cbs.size) continue;
    avatarUrl(id, px);
    n++;
    cbs.forEach(cb => cb());
  }
  if (order.length && !scheduled) {
    scheduled = true;
    later(pump);
  }
}

/**
 * Asks for the picture of `id` at `px`, painted soon in a short slice; `done` runs once it is ready.
 * Returns a cancel function (an unmounted tile stops waiting, and a picture nobody waits for is skipped).
 */
export function requestAvatarUrl(id: string, px: number, done: () => void): () => void {
  const k = keyOf(id, px);
  if (urls.has(k)) {
    done();
    return () => {};
  }
  let cbs = waiting.get(k);
  if (!cbs) {
    cbs = new Set();
    waiting.set(k, cbs);
    order.push([id, px]);
  }
  cbs.add(done);
  if (!scheduled) {
    scheduled = true;
    later(pump);
  }
  return () => {
    cbs.delete(done);
  };
}
