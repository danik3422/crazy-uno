import type http from 'node:http';

/**
 * How to find the player's address behind proxies. Anything the client sends itself can be forged,
 * so only what a trusted proxy wrote counts:
 * - `header`: a header the edge proxy always overwrites (Cloudflare's `cf-connecting-ip`);
 * - `hops`: how many proxies append to X-Forwarded-For. Each appends the address it saw on the right,
 *   so the client's own address is `hops` entries from the right; whatever is further left came from the client.
 */
export interface ProxyTrust {
  hops: number;
  header?: string;
}

/** `TRUST_PROXY`: "1" / "true" is one proxy, a number is that many; anything else is none. */
export function parseHops(v: string | undefined): number {
  if (!v) return 0;
  if (v === 'true') return 1;
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? Math.min(n, 10) : 0;
}

const first = (v: string | string[] | undefined) => String(Array.isArray(v) ? v[0] : (v ?? '')).trim();

export function clientIp(req: http.IncomingMessage, { hops, header }: ProxyTrust): string {
  const direct = req.socket.remoteAddress || '?';
  if (hops <= 0) return direct;
  if (header) {
    const v = first(req.headers[header.toLowerCase()]);
    if (v) return v.slice(0, 64);
  }
  const chain = String(req.headers['x-forwarded-for'] ?? '').split(',').map(x => x.trim()).filter(Boolean);
  // fewer entries than proxies: the request did not come through all of them, so the chain proves nothing
  if (chain.length < hops) return direct;
  return chain[chain.length - hops].slice(0, 64);
}
