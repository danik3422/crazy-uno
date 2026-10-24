import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { COLORS } from '../src/game/content';
import { playableCard } from '../src/game/engine';
import type { Action, ClientMsg, PlayerView, RoomInfo, ServerMsg } from '../src/net/protocol';
import { createUnoServer } from './server';

let app: Awaited<ReturnType<typeof createUnoServer>>;

beforeAll(async () => {
  app = await createUnoServer({ port: 0, rateLimit: 1e6, limits: { connections: 1e6, rooms: 1e6, badJoins: 1e6 }, room: { botSpeed: 0, offlineAutoMs: 60, idleAutoMs: 10_000, dealScale: 0.02, groupMs: 50, rematchMs: 40 } });
});
afterAll(() => app.close());

/** A scripted player: connects, remembers what the server says, plays its own turns. */
class TestClient {
  ws!: WebSocket;
  room: RoomInfo | null = null;
  view: PlayerView | null = null;
  token = '';
  code = '';
  errors: string[] = [];
  leaks = 0;
  auto = true;
  readyFor = 0;
  lastMine: number[] = [];
  private waiters: (() => void)[] = [];

  constructor(public name: string) {}

  async connect() {
    this.ws = new WebSocket(`ws://localhost:${app.port}/ws`);
    this.ws.on('message', raw => this.onMsg(JSON.parse(String(raw)) as ServerMsg));
    await new Promise(r => this.ws.once('open', r));
  }

  send(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  act(a: Action) {
    this.send({ t: 'act', act: a });
  }

  private onMsg(m: ServerMsg) {
    if (m.t === 'joined') { this.token = m.token; this.code = m.code; }
    if (m.t === 'room') this.room = m.room;
    if (m.t === 'error') this.errors.push(m.code);
    if (m.t === 'state') {
      this.view = m.view;
      // like a real screen: report the table as drawn once per round
      if (this.readyFor !== m.view.state.round && m.view.warmup.dealAt === null) {
        this.readyFor = m.view.state.round;
        this.send({ t: 'ready', round: m.view.state.round });
      }
      this.checkSecrecy(m.view);
      if (this.auto) this.play(m.view);
    }
    this.waiters.forEach(w => w());
  }

  /** Nobody may see another player's cards while the round is on. */
  private checkSecrecy(v: PlayerView) {
    const s = v.state;
    if (s.phase === 'over') return;
    const dealt = v.warmup.dealEnd !== null && Date.now() > v.warmup.dealEnd + 100;
    s.players.forEach((p, i) => {
      if (i === v.you) return;
      if (p.hand.some(c => !c.hidden)) this.leaks++;
      // hidden cards go by opaque numbers, in an order that says nothing, without their deal position
      if (p.hand.some(c => c.id < 10_000_000)) this.leaks++;
      if (p.hand.some((c, k) => k > 0 && c.id < p.hand[k - 1].id)) this.leaks++;
      if (dealt && p.hand.some(c => c.dealIdx !== undefined)) this.leaks++;
    });
    // a card I just gave away must not keep a number I can recognise
    const mine = v.you !== null ? new Set(s.players[v.you].hand.map(c => c.id)) : new Set<number>();
    for (const id of this.lastMine) {
      if (mine.has(id) || s.discard.some(c => c.id === id)) continue;
      if (s.players.some((p, i) => i !== v.you && p.hand.some(c => c.id === id))) this.leaks++;
    }
    this.lastMine = [...mine];
    if (s.deck.length) this.leaks++;
  }

  private play(v: PlayerView) {
    const s = v.state;
    if (s.phase === 'group') return this.act({ a: 'group' });
    if (v.you === null || v.you !== s.cur) return;
    const me = s.players[v.you];
    switch (s.phase) {
      case 'dare': return this.act({ a: 'dare', ok: true });
      case 'coin': return this.act(s.coin ? { a: 'coinDone' } : { a: 'coin', guess: 'heads' });
      case 'choose': {
        const ch = s.choice!;
        if (ch.kind === 'color') return this.act({ a: 'choice', v: COLORS[0] });
        if (ch.kind === 'card') return this.act({ a: 'choice', v: me.hand[0].id });
        return this.act({ a: 'choice', v: v.you === 0 ? 1 : 0 });
      }
      case 'play': {
        const c = me.hand.find(x => playableCard(s, x));
        if (c) {
          if (me.hand.length === 2 && Math.random() < 0.5) this.act({ a: 'uno' });
          return this.act({ a: 'play', id: c.id });
        }
        return this.act(s.drawn && s.pending === 0 ? { a: 'pass' } : { a: 'draw' });
      }
    }
  }

  until(cond: () => boolean, ms = 15_000) {
    return new Promise<void>((resolve, reject) => {
      if (cond()) return resolve();
      const t = setTimeout(() => reject(new Error(`timeout waiting (${this.name})`)), ms);
      const check = () => {
        if (cond()) {
          clearTimeout(t);
          this.waiters = this.waiters.filter(w => w !== check);
          resolve();
        }
      };
      this.waiters.push(check);
    });
  }

  close() {
    this.ws.close();
  }
}

const over = (c: TestClient) => c.view?.state.phase === 'over';

async function openRoom(names: string[]) {
  const [host, ...rest] = names.map(n => new TestClient(n));
  await host.connect();
  host.send({ t: 'create', name: host.name });
  await host.until(() => !!host.room);
  for (const c of rest) {
    await c.connect();
    c.send({ t: 'join', code: host.code, name: c.name });
    await c.until(() => !!c.room);
  }
  return [host, ...rest];
}

describe('online rooms', () => {
  it('runs full games for several people and a bot without leaking cards', async () => {
    const clients = await openRoom(['Аня', 'Боря', 'Вика']);
    const [host] = clients;
    host.send({ t: 'addBot' });
    await host.until(() => host.room!.members.length === 4);
    expect(host.room!.members.filter(m => m.host)).toHaveLength(1);

    for (let round = 1; round <= 3; round++) {
      if (round === 1) host.send({ t: 'start' });
      else clients.forEach(c => c.send({ t: 'again' }));
      for (const c of clients) await c.until(() => c.view?.state.round === round && over(c), 30_000);
    }
    for (const c of clients) expect(c.leaks).toBe(0);
    const wins = Object.values(host.room!.score).reduce((a, b) => a + b, 0);
    expect(wins).toBe(3);
    clients.forEach(c => c.close());
  });

  it('lets a player reconnect mid-game with their token', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.send({ t: 'start' });
    await guest.until(() => !!guest.view && guest.view.state.turn >= 3);
    const seat = guest.view!.you;
    const token = guest.token;
    guest.close();

    const back = new TestClient('Гость');
    await back.connect();
    back.send({ t: 'join', code: host.code, name: 'Гость', token });
    await back.until(() => !!back.view);
    expect(back.view!.you).toBe(seat);
    expect(back.room!.members).toHaveLength(2);
    await back.until(() => over(back), 30_000);
    await host.until(() => over(host));
    host.close();
    back.close();
  });

  it('puts a bot in the seat of a dropped player and gives it back on reconnect', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.auto = false;
    host.send({ t: 'start' });
    await guest.until(() => !!guest.view);
    guest.auto = false;
    const seat = guest.view!.you!;
    const token = guest.token;
    guest.close();
    await host.until(() => !!host.view?.state.players[seat].bot && !!host.view?.state.players[seat].offline);

    const back = new TestClient('Гость');
    back.auto = false;
    await back.connect();
    back.send({ t: 'join', code: host.code, name: 'Гость', token });
    await host.until(() => !!host.view && !host.view.state.players[seat].bot && !host.view.state.players[seat].offline);
    await back.until(() => back.view?.you === seat);
    host.close();
    back.close();
  });

  it('keeps the game going on autopilot when someone drops out for good', async () => {
    const [host, quitter] = await openRoom(['Хост', 'Пропал']);
    host.send({ t: 'start' });
    await quitter.until(() => !!quitter.view);
    quitter.auto = false;
    quitter.close();
    await host.until(() => over(host), 30_000);
    host.close();
  });

  it('turns a player who leaves into a bot and passes the host role on', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.send({ t: 'start' });
    await guest.until(() => !!guest.view);
    host.auto = false;
    host.send({ t: 'leave' });
    await guest.until(() => guest.room!.members.find(m => m.name === 'Хост')?.bot === true);
    expect(guest.room!.members.find(m => m.id === guest.room!.you)!.host).toBe(true);
    await guest.until(() => over(guest), 30_000);
    guest.close();
    host.close();
  });

  it('never reveals whether a +4 was a bluff, and lets anyone catch a missing UNO', async () => {
    const clients = await openRoom(['А', 'Б', 'В']);
    const [host] = clients;
    let sawChallenge = false;
    let sawCatchWindow = false;
    for (const c of clients) {
      const orig = (c as unknown as { checkSecrecy: (v: PlayerView) => void }).checkSecrecy.bind(c);
      (c as unknown as { checkSecrecy: (v: PlayerView) => void }).checkSecrecy = (v: PlayerView) => {
        orig(v);
        if (v.state.challenge) {
          sawChallenge = true;
          if (v.state.challenge.guilty) c.leaks++;
        }
        // whoever is not the victim catches at once
        const u = v.state.unoCatch;
        if (u && v.you !== null && v.you !== u.victim && v.state.players[u.victim].hand.length === 1) {
          sawCatchWindow = true;
          c.act({ a: 'catch' });
        }
      };
    }
    for (let round = 1; round <= 4; round++) {
      if (round === 1) host.send({ t: 'start' });
      else clients.forEach(c => c.send({ t: 'again' }));
      for (const c of clients) await c.until(() => c.view?.state.round === round && over(c), 30_000);
    }
    for (const c of clients) expect(c.leaks).toBe(0);
    expect(sawChallenge || sawCatchWindow).toBe(true);
    clients.forEach(c => c.close());
  });

  it('holds the round until every screen is ready, then deals to everyone at once', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.auto = guest.auto = false;
    guest.readyFor = 1; // the guest's phone is slow: it has not reported yet
    host.send({ t: 'start' });
    await host.until(() => !!host.view && host.view.warmup.waiting.length === 1);
    expect(host.view!.warmup.dealAt).toBeNull();
    const turn = host.view!.state.turn;
    const me = host.view!.you === host.view!.state.cur ? host : guest;
    me.act({ a: 'draw' }); // ignored while loading
    await new Promise(r => setTimeout(r, 150));
    expect(host.view!.state.turn).toBe(turn);
    guest.send({ t: 'ready', round: 1 });
    await host.until(() => host.view!.warmup.dealAt !== null && host.view!.warmup.waiting.length === 0);
    await guest.until(() => guest.view!.warmup.dealAt !== null);
    expect(guest.view!.warmup.dealAt).toBe(host.view!.warmup.dealAt);
    host.close();
    guest.close();
  });

  it('starts the next round only when everyone has pressed "again", after a countdown', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.send({ t: 'start' });
    await host.until(() => over(host), 30_000);
    await guest.until(() => over(guest));
    host.auto = guest.auto = false;

    guest.send({ t: 'again' });
    await host.until(() => !!host.room?.rematch?.ready.length);
    expect(host.room!.rematch!.startsIn).toBeNull();
    expect(host.room!.rematch!.waiting).toEqual([host.room!.you]);

    // the guest changes their mind, then everyone agrees: the countdown starts
    guest.send({ t: 'again', off: true });
    await host.until(() => host.room!.rematch!.ready.length === 0);
    guest.send({ t: 'again' });
    host.send({ t: 'again' });
    await host.until(() => host.room!.rematch?.startsIn != null);
    // then the new round loads like the first one: warm-up, deal
    await guest.until(() => guest.view?.state.round === 2 && guest.view.warmup.dealAt !== null);
    expect(host.room!.rematch).toBeNull();

    // a non-host cannot skip the others, the host can
    host.auto = guest.auto = true;
    await host.until(() => host.view?.state.round === 2 && over(host), 30_000);
    host.auto = guest.auto = false;
    guest.send({ t: 'again', force: true });
    await guest.until(() => guest.errors.includes('not-host'));
    host.send({ t: 'again' });
    host.send({ t: 'again', force: true });
    await guest.until(() => guest.view?.state.round === 3);
    host.close();
    guest.close();
  });

  it('does not hang on a group dare nobody confirms', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.auto = guest.auto = false;
    host.send({ t: 'start' });
    await host.until(() => !!host.view && host.view.warmup.dealEnd !== null);
    await new Promise(r => setTimeout(r, 200));
    const room = app.rooms.get(host.code)!;
    room.game!.fireEvent('group');
    (room as unknown as { flush: () => void }).flush();
    await host.until(() => host.view!.state.phase === 'group');
    await host.until(() => host.view!.state.phase !== 'group', 3000);
    host.close();
    guest.close();
  });

  it('lets only the host switch the theme, also mid-round', async () => {
    const [host, guest] = await openRoom(['Хост', 'Гость']);
    host.auto = guest.auto = false;
    guest.send({ t: 'theme', theme: 'neon' });
    await guest.until(() => guest.errors.includes('not-host'));
    expect(guest.room!.theme).toBe('classic');
    host.send({ t: 'theme', theme: 'space' });
    await guest.until(() => guest.room!.theme === 'space');
    host.send({ t: 'start' });
    await guest.until(() => guest.view?.state.theme === 'space');
    host.send({ t: 'theme', theme: 'halloween' });
    await guest.until(() => guest.view?.state.theme === 'halloween');
    host.send({ t: 'theme', theme: 'nonsense' as never });
    host.send({ t: 'ping' });
    await new Promise(r => setTimeout(r, 100));
    expect(host.room!.theme).toBe('halloween');
    host.close();
    guest.close();
  });

  it('rejects unknown rooms, non-host commands and lets late joiners watch', async () => {
    const lost = new TestClient('Потеряшка');
    await lost.connect();
    lost.send({ t: 'join', code: 'ZZZZ', name: 'x' });
    await lost.until(() => lost.errors.includes('no-room'));

    const [host, guest] = await openRoom(['Хост', 'Гость']);
    guest.send({ t: 'start' });
    await guest.until(() => guest.errors.includes('not-host'));
    host.auto = guest.auto = false;
    host.send({ t: 'start' });
    await host.until(() => !!host.view);

    const late = new TestClient('Опоздун');
    late.auto = false;
    await late.connect();
    late.send({ t: 'join', code: host.code, name: 'Опоздун' });
    await late.until(() => !!late.view);
    expect(late.view!.you).toBeNull();
    expect(late.room!.members.find(m => m.name === 'Опоздун')!.spectator).toBe(true);
    expect(late.leaks).toBe(0);

    // garbage and out-of-turn moves must not break anything
    const notMe = host.view!.you === host.view!.state.cur ? guest : host;
    notMe.act({ a: 'draw' });
    notMe.ws.send('{not json');
    notMe.ws.send(JSON.stringify({ t: 'act', act: { a: 'play', id: 'boom' } }));
    host.auto = guest.auto = true;
    host.send({ t: 'ping' }); // nudge: a fresh state arrives on the next move
    const cur = host.view!.you === host.view!.state.cur ? host : guest;
    cur.act({ a: 'draw' });
    await host.until(() => over(host), 30_000);
    [lost, host, guest, late].forEach(c => c.close());
  });
});
