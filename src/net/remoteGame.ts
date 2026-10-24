import { playableCard } from '../game/engine';
import type { Card, State } from '../game/types';
import type { GameView } from '../game/view';
import type { Connection } from './connection';
import type { PlayerView, Warmup } from './protocol';

/** Visual deck height cap: the stack is drawn from placeholders, the real deck stays on the server. */
const DECK_VISUAL = 60;

/** Mirror of the server's game, as this player is allowed to see it. Moves go back over the socket. */
export class RemoteGame implements GameView {
  s!: State;
  readonly isLocal = false;
  clockOffset = 0;
  readonly fxBaseline: number;
  you: number | null = null;
  warmup: Warmup = { waiting: [], dealAt: null, dealEnd: null };
  private readySent = 0;
  /** the server view last applied, to skip re-applying the same one */
  src: PlayerView | null = null;
  private version = 0;
  private listeners = new Set<() => void>();

  /** fresh: we watched this round from its start, so its opening effects should play */
  constructor(private conn: Connection, view: PlayerView, now: number, fresh: boolean) {
    this.apply(view, now);
    this.fxBaseline = fresh ? 0 : Math.max(0, ...view.state.fx.map(f => f.id));
  }

  apply(view: PlayerView, now: number) {
    this.src = view;
    const deck: Card[] = Array.from({ length: Math.min(view.deckCount, DECK_VISUAL) }, (_, i) => ({
      id: -1 - i, color: 'wild', type: 'num', value: 0, hidden: true,
    }));
    this.s = { ...view.state, deck };
    this.you = view.you;
    this.warmup = view.warmup;
    this.clockOffset = now - Date.now();
    // no notify here: this runs while App renders, and App re-rendering is what passes the update down
    this.version++;
  }

  subscribe = (f: () => void) => {
    this.listeners.add(f);
    return () => { this.listeners.delete(f); };
  };
  getVersion = () => this.version;

  cp() { return this.s.players[this.s.cur]; }
  nextIdx(from = this.s.cur, steps = 1) {
    const n = this.s.players.length;
    return (((from + this.s.dir * steps) % n) + n) % n;
  }
  viewer() { return this.you; }
  seat() { return this.you ?? 0; }
  playable(c: Card) { return !c.hidden && this.you === this.s.cur && playableCard(this.s, c); }

  /** Tell the server this screen has drawn the table for the round. */
  ready() {
    if (this.readySent === this.s.round) return;
    this.readySent = this.s.round;
    this.conn.send({ t: 'ready', round: this.s.round });
  }

  play(id: number) { this.conn.act({ a: 'play', id }); }
  draw() { this.conn.act({ a: 'draw' }); }
  pass() { this.conn.act({ a: 'pass' }); }
  callUno() { this.conn.act({ a: 'uno' }); }
  resolveChoice(v: string | number) { this.conn.act({ a: 'choice', v }); }
  confirmHandover() { /* no hand-over curtain online */ }
  resolveDare(ok: boolean) { this.conn.act({ a: 'dare', ok }); }
  doneGroup() { this.conn.act({ a: 'group' }); }
  guessCoin(guess: 'heads' | 'tails') { this.conn.act({ a: 'coin', guess }); }
  finishCoin() { this.conn.act({ a: 'coinDone' }); }
  catchable() {
    const c = this.s.unoCatch;
    return !!c && this.s.phase !== 'over' && this.s.turn <= c.until && this.s.players[c.victim]?.hand.length === 1;
  }
  catchUno() { this.conn.act({ a: 'catch' }); }
  lateUno() { this.conn.act({ a: 'lateUno' }); }
  challengeWild4() { this.conn.act({ a: 'challenge' }); }
  declineChallenge() { this.conn.act({ a: 'decline' }); }
}
