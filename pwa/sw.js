/*
 * The service worker: the game opens instantly the second time and plays with bots without a connection.
 * - the page: from the network (so an update shows at once), but from the cache if the network is slow or gone;
 * - the game's files (/assets/, named by their content): once fetched, always from the cache;
 * - icons, splash screens and the fonts: from the cache, refreshed in the background.
 * Online play (/ws) and the server's API never go through here.
 * The build fills in VERSION and ASSETS (see vite.config.ts).
 */
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const PAGE = 'uno-page';
const FILES = 'uno-assets';
const EXTRA = 'uno-extra';
/** a slow network (a server waking up) must not hold the game back: after this long the cached page is used */
const PAGE_TIMEOUT_MS = 2500;
/** the game's fonts (the same link as in index.html) */
const FONTS = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@600;900&family=Rubik:wght@400;500;700&display=swap';

/** The fonts and the font files they point to, so cards are painted in the right letters offline too. */
async function cacheFonts() {
  const cache = await caches.open(EXTRA);
  const res = await fetch(FONTS, { mode: 'cors' });
  if (!res.ok) return;
  await cache.put(FONTS, res.clone());
  const css = await res.text();
  const files = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map(m => m[1]);
  await Promise.all(files.map(async f => {
    if (await cache.match(f)) return;
    const r = await fetch(f, { mode: 'cors' });
    if (r.ok) await cache.put(f, r);
  }));
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const files = await caches.open(FILES);
    // only what is not cached yet: an update downloads just the files that changed
    const have = new Set((await files.keys()).map(r => new URL(r.url).pathname));
    await files.addAll(ASSETS.filter(a => !have.has(a)));
    const page = await caches.open(PAGE);
    await page.add(new Request('/', { cache: 'reload' }));
    // fonts are a nice-to-have: a failure here must not stop the worker from installing
    await cacheFonts().catch(() => undefined);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // files of older versions are dropped: the page in the cache always matches the files in the cache
    const files = await caches.open(FILES);
    const keep = new Set(ASSETS);
    for (const r of await files.keys()) if (!keep.has(new URL(r.url).pathname)) await files.delete(r);
    for (const name of await caches.keys()) if (![PAGE, FILES, EXTRA].includes(name)) await caches.delete(name);
    await self.clients.claim();
  })());
});

/** The page: the network first, the cached copy when it is slow or offline. */
async function page(request) {
  const cache = await caches.open(PAGE);
  const fresh = fetch(request).then(async res => {
    if (res.ok && res.type === 'basic') await cache.put('/', res.clone());
    return res;
  });
  const cached = cache.match('/');
  const timeout = new Promise(r => setTimeout(r, PAGE_TIMEOUT_MS));
  const first = await Promise.race([fresh.catch(() => null), timeout.then(() => null)]);
  if (first) return first;
  return (await cached) ?? fresh;
}

/** Files named by their content never change: the cache, else the network (and keep it). */
async function asset(request) {
  const cache = await caches.open(FILES);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

/** Everything else we keep: the cached copy right away, a fresh one fetched for next time. */
async function extra(request) {
  const cache = await caches.open(EXTRA);
  const hit = await cache.match(request);
  const fresh = fetch(request).then(res => {
    if (res.ok || res.type === 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => hit);
  return hit ?? fresh;
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const same = url.origin === self.location.origin;
  if (same && (url.pathname.startsWith('/api/') || url.pathname === '/ws' || url.pathname === '/sw.js')) return;
  if (request.mode === 'navigate' && same) return event.respondWith(page(request));
  if (same && url.pathname.startsWith('/assets/')) return event.respondWith(asset(request));
  const fonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (fonts || (same && /\.(png|jpg|webmanifest|svg|webp)$/.test(url.pathname))) return event.respondWith(extra(request));
});

self.addEventListener('message', event => {
  if (event.data === 'version') event.source?.postMessage({ version: VERSION });
});
