import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type http from 'node:http';
import path from 'node:path';
import zlib, { brotliCompressSync, gzipSync } from 'node:zlib';
import { normalizeCode } from '../src/net/protocol';
import { langFrom, tr } from '../src/i18n/core';
import type { Lang } from '../src/i18n/types';
import type { Room } from './room';

export interface StaticSiteOptions {
  /** directory with the built client (dist/) */
  dir: string;
  /** behind a proxy: take the original protocol from X-Forwarded-Proto */
  trustProxy: boolean;
  /** open rooms, so an invite link can say who is calling you */
  rooms: Map<string, Room>;
}

/** The built page, compressed once per variant. */
interface Page {
  raw: Buffer;
  gz: Buffer;
  br: Buffer;
  etag: string;
}

/** The few files next to the page (link preview, app icons, the install manifest), each read once. */
const FILES: Record<string, string> = {
  '/og.jpg': 'image/jpeg',
  '/icon-192.png': 'image/png',
  '/icon-512.png': 'image/png',
  '/apple-touch-icon.png': 'image/png',
  '/manifest.webmanifest': 'application/manifest+json',
};
const SPLASH = /^\/splash\/splash-\d+x\d+\.jpg$/;
/** the game's files, named by their content (index-3f9a1c.js): they never change, so browsers keep them for good */
const ASSET = /^\/assets\/[\w.-]+\.(js|css|woff2?|png|jpg|svg|webp|mp3|json)$/;
const ASSET_TYPES: Record<string, string> = {
  js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', woff: 'font/woff', woff2: 'font/woff2',
  png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml', webp: 'image/webp', mp3: 'audio/mpeg', json: 'application/json',
};
/** text files worth compressing */
const COMPRESS = new Set(['js', 'css', 'svg', 'json']);
const PAGE_CACHE_LIMIT = 200;

const escapeHtml = (v: string) =>
  v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Replaces the content of `<meta property|name="prop" content="…">`. */
const setMeta = (html: string, prop: string, value: string) =>
  html.replace(new RegExp(`(<meta (?:property|name)="${prop}" content=")[^"]*(")`), `$1${escapeHtml(value)}$2`);

/** The page's language from Accept-Language (ru / uk / be → Russian, pl → Polish, else English). */
const langOf = (req: http.IncomingMessage): Lang =>
  langFrom(String(req.headers['accept-language'] ?? '').split(',').map(x => x.split(';')[0].trim()).filter(Boolean));

/**
 * Serves the client: the page, its files in /assets/ (cached for good), the service worker and a few neighbours.
 * Page variants differ only in their link-preview tags: absolute URLs for this host,
 * and for invite links (?room=CODE) who is calling you to which room.
 */
export function createStaticSite({ dir, trustProxy, rooms }: StaticSiteOptions) {
  let template: Promise<string | null> | null = null;
  const loadTemplate = () =>
    (template ??= readFile(path.join(dir, 'index.html'), 'utf8').catch(() => {
      template = null;
      return null;
    }));

  const pages = new Map<string, Page>();
  const loadPage = async (req: http.IncomingMessage, url: URL): Promise<Page | null> => {
    const tpl = await loadTemplate();
    if (!tpl) return null;
    const proto = trustProxy ? String(req.headers['x-forwarded-proto'] ?? 'http').split(',')[0].trim() : 'http';
    const host = String(req.headers.host ?? 'localhost').replace(/[^\w.:-]/g, '').slice(0, 100);
    const origin = `${proto === 'https' ? 'https' : 'http'}://${host}`;
    const code = normalizeCode(url.searchParams.get('room') ?? '');
    const room = code ? rooms.get(code) : undefined;
    const hostName = room?.members.find(m => m.id === room.hostId)?.name;
    const seated = room?.members.filter(m => !m.spectator).length ?? 0;
    const lang = langOf(req);
    const key = `${origin}|${lang}|${room ? `${code}|${hostName}|${seated}` : ''}`;
    const hit = pages.get(key);
    if (hit) return hit;

    let html = tpl;
    // link previews and the first paint in the reader's language (the app itself may switch later)
    const title = tr(lang, 'app.title');
    html = html.replace(/<html lang="[^"]*"/, `<html lang="${lang}"`).replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    html = setMeta(html, 'og:locale', { ru: 'ru_RU', en: 'en_US', pl: 'pl_PL' }[lang]);
    for (const p of ['og:site_name', 'og:title', 'apple-mobile-web-app-title']) html = setMeta(html, p, title);
    for (const p of ['og:description', 'description']) html = setMeta(html, p, tr(lang, 'og.desc'));
    html = setMeta(html, 'og:image:alt', tr(lang, 'og.alt'));
    html = setMeta(html, 'og:image', `${origin}/og.jpg`);
    html = setMeta(html, 'og:url', room ? `${origin}/?room=${code}` : `${origin}/`);
    if (room) {
      const invite = hostName ? tr(lang, 'og.invite', { name: hostName }) : tr(lang, 'og.inviteAnon');
      const desc = tr(lang, 'og.room', { code, n: seated });
      html = setMeta(html, 'og:title', invite);
      html = setMeta(html, 'og:description', desc);
      html = setMeta(html, 'description', desc);
    }
    const raw = Buffer.from(html);
    const page: Page = {
      raw,
      gz: gzipSync(raw, { level: 9 }),
      // invite variants are made on demand, so they get a faster (slightly bigger) compression
      br: brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: room ? 5 : 10 } }),
      etag: `"${createHash('sha1').update(raw).digest('base64url').slice(0, 16)}"`,
    };
    if (pages.size > PAGE_CACHE_LIMIT) pages.clear();
    pages.set(key, page);
    return page;
  };

  const files = new Map<string, Promise<Buffer | null>>();
  const loadFile = (name: string) => {
    let f = files.get(name);
    if (!f) files.set(name, (f = readFile(path.join(dir, name.slice(1))).catch(() => null)));
    return f;
  };

  /** A game file, read and compressed once. */
  const assets = new Map<string, Promise<Page | null>>();
  const loadAsset = (name: string) => {
    let a = assets.get(name);
    if (!a) {
      a = readFile(path.join(dir, name.slice(1))).then(raw => {
        const ext = name.split('.').pop()!;
        const small = !COMPRESS.has(ext);
        return {
          raw,
          gz: small ? raw : gzipSync(raw, { level: 9 }),
          br: small ? raw : brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }),
          etag: '',
        };
      }).catch(() => {
        assets.delete(name);
        return null;
      });
      assets.set(name, a);
    }
    return a;
  };

  /** Answers a GET or HEAD request. */
  return async function serve(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
    const head = req.method === 'HEAD';
    const accept = String(req.headers['accept-encoding'] ?? '');
    if (ASSET.test(url.pathname)) {
      const a = await loadAsset(url.pathname);
      if (!a) return void res.writeHead(404, { 'cache-control': 'no-store' }).end();
      const ext = url.pathname.split('.').pop()!;
      const packed = COMPRESS.has(ext);
      const [body, enc] = packed && /\bbr\b/.test(accept) ? [a.br, 'br'] : packed && /\bgzip\b/.test(accept) ? [a.gz, 'gzip'] : [a.raw, null];
      const headers: http.OutgoingHttpHeaders = {
        'content-type': ASSET_TYPES[ext],
        'content-length': body.length,
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      };
      if (packed) headers.vary = 'Accept-Encoding';
      if (enc) headers['content-encoding'] = enc;
      res.writeHead(200, headers);
      res.end(head ? undefined : body);
      return;
    }
    // the service worker: always checked for a new version
    if (url.pathname === '/sw.js') {
      const file = await loadFile('/sw.js');
      if (!file) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'content-length': file.length, 'cache-control': 'no-cache' });
      res.end(head ? undefined : file);
      return;
    }
    const type = FILES[url.pathname] ?? (SPLASH.test(url.pathname) ? 'image/jpeg' : undefined);
    if (type) {
      const file = await loadFile(url.pathname);
      if (!file) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': type, 'content-length': file.length, 'cache-control': 'public, max-age=86400' });
      res.end(head ? undefined : file);
      return;
    }
    // a missing file is a 404, not the page (a stale link to an old build must not get HTML instead of a script)
    if (/\.\w+$/.test(url.pathname)) return void res.writeHead(404).end();
    // every page route gets index.html (?room=CODE links included)
    const page = await loadPage(req, url);
    if (!page) {
      res.writeHead(500).end(tr('en', 'server.noBuild'));
      return;
    }
    // always send the smallest the browser accepts
    const [body, enc] = /\bbr\b/.test(accept) ? [page.br, 'br'] : /\bgzip\b/.test(accept) ? [page.gz, 'gzip'] : [page.raw, null];
    const headers: http.OutgoingHttpHeaders = {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      etag: page.etag,
      vary: 'Accept-Encoding, Accept-Language',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
    };
    if (req.headers['if-none-match'] === page.etag) {
      res.writeHead(304, headers).end();
      return;
    }
    if (enc) headers['content-encoding'] = enc;
    headers['content-length'] = body.length;
    res.writeHead(200, headers);
    res.end(head ? undefined : body);
  };
}
