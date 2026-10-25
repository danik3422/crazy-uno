import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import zlib, { brotliCompressSync, gzipSync } from 'node:zlib';
import { WebSocketServer, type WebSocket } from 'ws';
import { CODE_ALPHABET, CODE_LEN, normalizeCode, type ClientMsg, type ServerMsg } from '../src/net/protocol';
import { DEFAULT_LIMITS, Limits, type LimitOptions } from './limits';
import { Room, type Member, type RoomOptions } from './room';

export interface ServerOptions {
  port: number;
  /** directory with the built client (dist/); omitted in tests */
  staticDir?: string;
  /** attach Vite dev middleware (npm run dev) */
  dev?: boolean;
  room?: RoomOptions;
  /** messages a socket may send per second (burst up to twice that) */
  rateLimit?: number;
  limits?: Partial<LimitOptions>;
  /** behind a proxy (Render, Fly, nginx): take the client address from X-Forwarded-For */
  trustProxy?: boolean;
}

const MAX_ROOMS = 2000;
/** a room nobody is connected to is dropped after this (long enough to survive a reload or a short drop) */
const EMPTY_ROOM_TTL = 5 * 60_000;
const IDLE_ROOM_TTL = 6 * 60 * 60_000;

export async function createUnoServer(opts: ServerOptions) {
  const rooms = new Map<string, Room>();
  const limits = new Limits({ ...DEFAULT_LIMITS, ...opts.limits });
  const trustProxy = opts.trustProxy ?? process.env.TRUST_PROXY === '1';
  const clientIp = (req: http.IncomingMessage) => {
    const fwd = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    return fwd || req.socket.remoteAddress || '?';
  };
  /*
   * The built page, compressed once per variant. Variants differ only in their link-preview tags:
   * absolute URLs for this host, and for invite links (?room=CODE) who is calling you to which room.
   */
  type Page = { raw: Buffer; gz: Buffer; br: Buffer; etag: string };
  let template: Promise<string | null> | null = null;
  const loadTemplate = () =>
    (template ??= readFile(path.join(opts.staticDir!, 'index.html'), 'utf8').catch(() => {
      template = null;
      return null;
    }));
  const pages = new Map<string, Page>();
  const esc = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const setMeta = (html: string, prop: string, value: string) =>
    html.replace(new RegExp(`(<meta (?:property|name)="${prop}" content=")[^"]*(")`), `$1${esc(value)}$2`);

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
    const key = `${origin}|${room ? `${code}|${hostName}|${seated}` : ''}`;
    const hit = pages.get(key);
    if (hit) return hit;

    let html = tpl;
    html = setMeta(html, 'og:image', `${origin}/og.jpg`);
    html = setMeta(html, 'og:url', room ? `${origin}/?room=${code}` : `${origin}/`);
    if (room) {
      const title = hostName ? `${hostName} зовёт тебя в UNO` : 'Тебя зовут в UNO';
      const desc = `Комната ${code} · ${seated} ${seated === 1 ? 'игрок' : seated < 5 ? 'игрока' : 'игроков'} за столом. Открой ссылку, впиши имя — и садись играть.`;
      html = setMeta(html, 'og:title', title);
      html = setMeta(html, 'og:description', desc);
      html = setMeta(html, 'description', desc);
    }
    const raw = Buffer.from(html);
    const page: Page = {
      raw,
      gz: gzipSync(raw, { level: 9 }),
      br: brotliCompressSync(raw, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: room ? 5 : 10 } }),
      etag: `"${createHash('sha1').update(raw).digest('base64url').slice(0, 16)}"`,
    };
    if (pages.size > 200) pages.clear();
    pages.set(key, page);
    return page;
  };

  // the few files next to the page (link preview, app icons, the install manifest), each read once
  const FILES: Record<string, string> = {
    '/og.jpg': 'image/jpeg',
    '/icon-192.png': 'image/png',
    '/icon-512.png': 'image/png',
    '/apple-touch-icon.png': 'image/png',
    '/manifest.webmanifest': 'application/manifest+json',
  };
  const files = new Map<string, Promise<Buffer | null>>();
  const loadFile = (name: string) => {
    let f = files.get(name);
    if (!f) files.set(name, (f = readFile(path.join(opts.staticDir!, name.slice(1))).catch(() => null)));
    return f;
  };

  let vite: { middlewares: http.RequestListener; close(): Promise<void> } | null = null;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (vite) return vite.middlewares(req, res);
    if (!opts.staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404).end();
      return;
    }
    const type = FILES[url.pathname] ?? (/^\/splash\/splash-\d+x\d+\.jpg$/.test(url.pathname) ? 'image/jpeg' : undefined);
    if (type) {
      const file = await loadFile(url.pathname);
      if (!file) return void res.writeHead(404).end();
      res.writeHead(200, { 'content-type': type, 'content-length': file.length, 'cache-control': 'public, max-age=86400' });
      res.end(req.method === 'HEAD' ? undefined : file);
      return;
    }
    // single-file build: every page route gets index.html (?room=CODE links included)
    const page = await loadPage(req, url);
    if (!page) {
      res.writeHead(500).end('Клиент не собран: запусти npm run build');
      return;
    }
    // the page is ~1.2 MB raw but ~0.3 MB compressed: always send the smallest the browser accepts
    const accept = String(req.headers['accept-encoding'] ?? '');
    const [body, enc] = /\bbr\b/.test(accept) ? [page.br, 'br'] : /\bgzip\b/.test(accept) ? [page.gz, 'gzip'] : [page.raw, null];
    const headers: http.OutgoingHttpHeaders = {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      etag: page.etag,
      vary: 'Accept-Encoding',
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
    res.end(req.method === 'HEAD' ? undefined : body);
  });

  if (opts.dev) {
    const { createServer } = await import('vite');
    vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }

  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url ?? '/', 'http://x');
    if (pathname !== '/ws') return; // Vite's HMR socket handles its own upgrades
    const ip = clientIp(req);
    if (!limits.open(ip)) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    let released = false;
    const release = () => {
      if (!released) limits.close(ip);
      released = true;
    };
    socket.once('close', release);
    wss.handleUpgrade(req, socket, head, ws => {
      (ws as WebSocket & { ip?: string }).ip = ip;
      wss.emit('connection', ws, req);
    });
  });

  const newCode = () => {
    for (;;) {
      let c = '';
      for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
      if (!rooms.has(c)) return c;
    }
  };

  wss.on('connection', (ws: WebSocket & { alive?: boolean; ip?: string }) => {
    const ip = ws.ip ?? '?';
    let room: Room | null = null;
    let member: Member | null = null;
    const rate = opts.rateLimit ?? 30;
    let budget = rate * 2;
    const refill = setInterval(() => { budget = Math.min(rate * 2, budget + rate); }, 1000);
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const send = (m: ServerMsg) => ws.send(JSON.stringify(m));

    const enter = (r: Room, name: string, token?: string, avatar?: unknown) => {
      if (room && room !== r) room.disconnect(ws);
      const res = r.join(name, ws, token, typeof avatar === 'string' ? avatar : undefined);
      if (typeof res === 'string') {
        send({ t: 'error', code: res, msg: res === 'full' ? 'В комнате нет мест' : 'Не получилось войти' });
        return;
      }
      room = r;
      member = res;
    };

    ws.on('message', raw => {
      ws.alive = true;
      if (--budget < 0) return; // flood protection
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      try {
        if (msg.t === 'ping') return send({ t: 'pong' });
        if (msg.t === 'create') {
          if (rooms.size >= MAX_ROOMS) return send({ t: 'error', code: 'full', msg: 'Сервер переполнен, попробуй позже' });
          if (!limits.rooms.take(ip)) return send({ t: 'error', code: 'slow-down', msg: 'Слишком много новых комнат подряд. Подожди пару минут' });
          const r = new Room(newCode(), opts.room);
          rooms.set(r.code, r);
          return enter(r, String(msg.name ?? ''), undefined, msg.avatar);
        }
        if (msg.t === 'join') {
          const r = rooms.get(normalizeCode(String(msg.code ?? '')));
          if (!r) {
            // wrong codes are counted, so codes cannot be guessed by trying them all
            if (!limits.badJoins.take(ip)) return send({ t: 'error', code: 'slow-down', msg: 'Слишком много неверных кодов. Подожди пару минут' });
            return send({ t: 'error', code: 'no-room', msg: 'Комната не найдена. Проверь код' });
          }
          return enter(r, String(msg.name ?? ''), typeof msg.token === 'string' ? msg.token : undefined, msg.avatar);
        }
        if (room && member && member.sock === ws) {
          room.handle(member, msg);
          if (msg.t === 'leave') room = member = null;
        }
      } catch (e) {
        console.error('message failed', e);
      }
    });

    ws.on('close', () => {
      clearInterval(refill);
      room?.disconnect(ws);
    });
    ws.on('error', () => ws.terminate());
  });

  // drop dead connections (laptop lid closed, phone in a tunnel)
  const heartbeat = setInterval(() => {
    for (const c of wss.clients as Set<WebSocket & { alive?: boolean }>) {
      if (!c.alive) { c.terminate(); continue; }
      c.alive = false;
      c.ping();
    }
  }, 25_000);

  const sweep = setInterval(() => {
    limits.sweep();
    const now = Date.now();
    for (const [code, r] of rooms) {
      const empty = r.connectedHumans().length === 0;
      if ((empty && now - r.lastActivity > EMPTY_ROOM_TTL) || now - r.lastActivity > IDLE_ROOM_TTL) {
        r.destroy();
        rooms.delete(code);
      }
    }
  }, 60_000);

  await new Promise<void>(resolve => server.listen(opts.port, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : opts.port;

  return {
    port,
    rooms,
    async close() {
      clearInterval(heartbeat);
      clearInterval(sweep);
      for (const r of rooms.values()) r.destroy();
      for (const c of wss.clients) c.terminate();
      await vite?.close();
      await new Promise(r => server.close(() => r(null)));
    },
  };
}
