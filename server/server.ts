import http from 'node:http';
import { msg as text } from '../src/i18n/msg';
import { WebSocketServer, type WebSocket } from 'ws';
import { CODE_ALPHABET, CODE_LEN, normalizeCode, type ClientMsg, type ServerMsg } from '../src/net/protocol';
import { DEFAULT_LIMITS, Limits, type LimitOptions } from './limits';
import { Room, type Member, type RoomOptions } from './room/Room';
import { createStaticSite } from './static';

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
const HEARTBEAT_MS = 25_000;
const SWEEP_MS = 60_000;
const MAX_MESSAGE_BYTES = 8 * 1024;
const DEFAULT_RATE = 30;

type Client = WebSocket & { alive?: boolean; ip?: string };

/** HTTP (the page, static files, a health check) and the game WebSocket at /ws, on one port. */
export async function createUnoServer(opts: ServerOptions) {
  const rooms = new Map<string, Room>();
  const limits = new Limits({ ...DEFAULT_LIMITS, ...opts.limits });
  const trustProxy = opts.trustProxy ?? process.env.TRUST_PROXY === '1';
  const site = opts.staticDir ? createStaticSite({ dir: opts.staticDir, trustProxy, rooms }) : null;
  let vite: { middlewares: http.RequestListener; close(): Promise<void> } | null = null;

  const clientIp = (req: http.IncomingMessage) => {
    const fwd = trustProxy ? String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim() : '';
    return fwd || req.socket.remoteAddress || '?';
  };

  /* ---------- HTTP ---------- */

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname === '/api/health') {
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (vite) return vite.middlewares(req, res);
    if (!site || (req.method !== 'GET' && req.method !== 'HEAD')) {
      res.writeHead(404).end();
      return;
    }
    await site(req, res, url);
  });

  if (opts.dev) {
    const { createServer } = await import('vite');
    vite = await createServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
  }

  /* ---------- WebSocket ---------- */

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
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
    socket.once('close', () => {
      if (!released) limits.close(ip);
      released = true;
    });
    wss.handleUpgrade(req, socket, head, ws => {
      (ws as Client).ip = ip;
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

  wss.on('connection', (ws: Client) => {
    const ip = ws.ip ?? '?';
    let room: Room | null = null;
    let member: Member | null = null;
    // flood protection: a token bucket, refilled every second
    const rate = opts.rateLimit ?? DEFAULT_RATE;
    let budget = rate * 2;
    const refill = setInterval(() => { budget = Math.min(rate * 2, budget + rate); }, 1000);
    ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    const send = (m: ServerMsg) => ws.send(JSON.stringify(m));

    const enter = (r: Room, name: string, token?: string, avatar?: unknown) => {
      if (room && room !== r) room.disconnect(ws);
      const res = r.join(name, ws, token, typeof avatar === 'string' ? avatar : undefined);
      if (typeof res === 'string') {
        send({ t: 'error', code: res, msg: text(res === 'full' ? 'err.full' : 'err.joinFailed') });
        return;
      }
      room = r;
      member = res;
    };

    const create = (msg: Extract<ClientMsg, { t: 'create' }>) => {
      if (rooms.size >= MAX_ROOMS) return send({ t: 'error', code: 'full', msg: text('err.serverFull') });
      if (!limits.rooms.take(ip)) return send({ t: 'error', code: 'slow-down', msg: text('err.slowRooms') });
      const r = new Room(newCode(), opts.room);
      rooms.set(r.code, r);
      enter(r, String(msg.name ?? ''), undefined, msg.avatar);
    };

    const join = (msg: Extract<ClientMsg, { t: 'join' }>) => {
      const r = rooms.get(normalizeCode(String(msg.code ?? '')));
      if (!r) {
        // wrong codes are counted, so codes cannot be guessed by trying them all
        if (!limits.badJoins.take(ip)) return send({ t: 'error', code: 'slow-down', msg: text('err.slowJoins') });
        return send({ t: 'error', code: 'no-room', msg: text('err.noRoom') });
      }
      enter(r, String(msg.name ?? ''), typeof msg.token === 'string' ? msg.token : undefined, msg.avatar);
    };

    ws.on('message', raw => {
      ws.alive = true;
      if (--budget < 0) return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      try {
        if (msg.t === 'ping') return send({ t: 'pong' });
        if (msg.t === 'create') return create(msg);
        if (msg.t === 'join') return join(msg);
        // everything else is for the room this socket sits in
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

  /* ---------- housekeeping ---------- */

  // drop dead connections (laptop lid closed, phone in a tunnel)
  const heartbeat = setInterval(() => {
    for (const c of wss.clients as Set<Client>) {
      if (!c.alive) { c.terminate(); continue; }
      c.alive = false;
      c.ping();
    }
  }, HEARTBEAT_MS);

  // forget old rate-limit hits and rooms nobody uses any more
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
  }, SWEEP_MS);

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
