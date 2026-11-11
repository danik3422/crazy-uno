import http from 'node:http';
import { msg as text } from '../src/i18n/msg';
import { WebSocketServer, type WebSocket } from 'ws';
import { CODE_ALPHABET, CODE_LEN, normalizeCode, type ClientMsg, type ServerMsg } from '../src/net/protocol';
import { clientIp, parseHops, type ProxyTrust } from './clientIp';
import { DEFAULT_LIMITS, Limits, type LimitOptions } from './limits';
import { secureInt } from './rng';
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
  /**
   * behind proxies (Render, Fly, nginx): how many of them append to X-Forwarded-For (true = 1).
   * Default: the TRUST_PROXY environment variable. See clientIp.ts.
   */
  trustProxy?: boolean | number;
  /** a header the edge proxy always sets to the client's address (CLIENT_IP_HEADER, e.g. cf-connecting-ip) */
  clientIpHeader?: string;
  /** the site's public address for link previews (PUBLIC_URL); without it the request's Host is used */
  publicUrl?: string;
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
  const proxy: ProxyTrust = {
    hops: typeof opts.trustProxy === 'number' ? opts.trustProxy : opts.trustProxy === undefined ? parseHops(process.env.TRUST_PROXY) : opts.trustProxy ? 1 : 0,
    header: opts.clientIpHeader ?? (process.env.CLIENT_IP_HEADER || undefined),
  };
  const ipOf = (req: http.IncomingMessage) => clientIp(req, proxy);
  const site = opts.staticDir
    ? createStaticSite({
        dir: opts.staticDir,
        trustProxy: proxy.hops > 0,
        // Render sets RENDER_EXTERNAL_URL by itself; PUBLIC_URL wins (a custom domain)
        publicUrl: opts.publicUrl ?? (process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || undefined),
        // an invite preview tells whether a room exists, so it is limited exactly like joining
        findRoom: (code, req) => { const r = lookUp(code, ipOf(req)); return r === 'slow-down' ? undefined : r; },
      })
    : null;
  let vite: { middlewares: http.RequestListener; close(): Promise<void> } | null = null;

  /**
   * The room with this code, for someone at `ip`. Wrong codes are counted, and once there were too many
   * the answer is "no room" even for a real one: otherwise each further guess would still tell which codes exist.
   */
  function lookUp(code: string, ip: string): Room | undefined | 'slow-down' {
    if (limits.badJoins.blocked(ip)) return 'slow-down';
    const r = rooms.get(code);
    if (!r) limits.badJoins.take(ip);
    return r;
  }

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
    const ip = ipOf(req);
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
      for (let i = 0; i < CODE_LEN; i++) c += CODE_ALPHABET[secureInt(0, CODE_ALPHABET.length)];
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
      // already in this room: the same seat again, never a second one for the same connection
      if (room === r && member && member.sock === ws) token = member.token;
      const res = r.join(name, ws, token, typeof avatar === 'string' ? avatar : undefined);
      if (typeof res === 'string') {
        send({ t: 'error', code: res, msg: text(res === 'full' ? 'err.full' : res === 'kicked' ? 'err.kicked' : 'err.joinFailed') });
        return;
      }
      room = r;
      member = res;
    };

    const create = (msg: Extract<ClientMsg, { t: 'create' }>) => {
      if (rooms.size >= MAX_ROOMS) return send({ t: 'error', code: 'full', msg: text('err.serverFull') });
      if (!limits.rooms.take(ip)) return send({ t: 'error', code: 'slow-down', msg: text('err.slowRooms') });
      const r = new Room(newCode(), { ...opts.room, debug: !!opts.dev });
      rooms.set(r.code, r);
      enter(r, String(msg.name ?? ''), undefined, msg.avatar);
    };

    const join = (msg: Extract<ClientMsg, { t: 'join' }>) => {
      const code = normalizeCode(String(msg.code ?? ''));
      const token = typeof msg.token === 'string' ? msg.token : undefined;
      // someone coming back to their seat proves it with a token nobody can guess, so no limit applies;
      // everyone else: wrong codes are counted, so codes cannot be guessed by trying them all
      const own = token ? rooms.get(code) : undefined;
      const r = own?.hasSeat(token!) ? own : lookUp(code, ip);
      if (r === 'slow-down') return send({ t: 'error', code: 'slow-down', msg: text('err.slowJoins') });
      if (!r) return send({ t: 'error', code: 'no-room', msg: text('err.noRoom') });
      enter(r, String(msg.name ?? ''), token, msg.avatar);
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
