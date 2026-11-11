import type http from 'node:http';
import { describe, expect, it } from 'vitest';
import { clientIp, parseHops } from './clientIp';

const req = (headers: Record<string, string>, remote = '10.0.0.1') =>
  ({ headers, socket: { remoteAddress: remote } }) as unknown as http.IncomingMessage;

describe('client address behind proxies', () => {
  it('ignores forwarding headers unless a proxy is trusted', () => {
    expect(clientIp(req({ 'x-forwarded-for': '1.1.1.1', 'cf-connecting-ip': '2.2.2.2' }), { hops: 0, header: 'cf-connecting-ip' })).toBe('10.0.0.1');
  });

  it('takes the entry the trusted proxy appended, not what the client sent', () => {
    // a client forging the header: "6.6.6.6" is theirs, the proxy appended the real one
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5' }), { hops: 1 })).toBe('5.5.5.5');
    // Render: Cloudflare appends the client, then Render's balancer appends Cloudflare's edge
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5, 104.22.17.40' }), { hops: 2 })).toBe('5.5.5.5');
    expect(clientIp(req({ 'x-forwarded-for': '5.5.5.5, 104.22.17.40' }), { hops: 2 })).toBe('5.5.5.5');
  });

  it('falls back to the socket when the chain is shorter than the proxies', () => {
    expect(clientIp(req({ 'x-forwarded-for': '6.6.6.6' }), { hops: 2 })).toBe('10.0.0.1');
    expect(clientIp(req({}), { hops: 1 })).toBe('10.0.0.1');
  });

  it('prefers the header the edge proxy overwrites', () => {
    const r = req({ 'x-forwarded-for': '6.6.6.6, 5.5.5.5, 104.22.17.40', 'cf-connecting-ip': '5.5.5.5' });
    expect(clientIp(r, { hops: 2, header: 'cf-connecting-ip' })).toBe('5.5.5.5');
    // without that header the chain is used
    expect(clientIp(req({ 'x-forwarded-for': '5.5.5.5, 9.9.9.9' }), { hops: 2, header: 'cf-connecting-ip' })).toBe('5.5.5.5');
  });

  it('reads TRUST_PROXY', () => {
    expect(parseHops(undefined)).toBe(0);
    expect(parseHops('')).toBe(0);
    expect(parseHops('0')).toBe(0);
    expect(parseHops('1')).toBe(1);
    expect(parseHops('true')).toBe(1);
    expect(parseHops('2')).toBe(2);
    expect(parseHops('yes')).toBe(0);
    expect(parseHops('-1')).toBe(0);
  });
});
