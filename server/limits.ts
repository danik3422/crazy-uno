/**
 * Per-address limits, so one person (or one script) cannot fill the server with rooms,
 * hold hundreds of connections, or guess room codes by brute force.
 */
export interface LimitOptions {
  /** open WebSockets per address (a whole party behind one Wi-Fi shares an address) */
  connections: number;
  /** rooms created per address per window */
  rooms: number;
  /** joins with a wrong code per address per window */
  badJoins: number;
  windowMs: number;
}

export const DEFAULT_LIMITS: LimitOptions = { connections: 24, rooms: 8, badJoins: 12, windowMs: 10 * 60_000 };

class Window {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private ms: number) {}
  /** records a hit; false when the address is over the limit */
  take(key: string, now = Date.now()) {
    const list = (this.hits.get(key) ?? []).filter(t => now - t < this.ms);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return false;
    }
    list.push(now);
    this.hits.set(key, list);
    return true;
  }
  sweep(now = Date.now()) {
    for (const [k, list] of this.hits) if (list.every(t => now - t >= this.ms)) this.hits.delete(k);
  }
}

export class Limits {
  private conns = new Map<string, number>();
  readonly rooms: Window;
  readonly badJoins: Window;
  constructor(readonly opts: LimitOptions = DEFAULT_LIMITS) {
    this.rooms = new Window(opts.rooms, opts.windowMs);
    this.badJoins = new Window(opts.badJoins, opts.windowMs);
  }
  /** false when this address already has too many sockets open */
  open(ip: string) {
    const n = this.conns.get(ip) ?? 0;
    if (n >= this.opts.connections) return false;
    this.conns.set(ip, n + 1);
    return true;
  }
  close(ip: string) {
    const n = (this.conns.get(ip) ?? 1) - 1;
    if (n <= 0) this.conns.delete(ip);
    else this.conns.set(ip, n);
  }
  sweep() {
    this.rooms.sweep();
    this.badJoins.sweep();
  }
}
