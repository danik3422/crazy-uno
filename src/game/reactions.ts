/**
 * Quick reactions: a few drawn faces and set phrases a player can pop over their plate.
 * There is no free text, so there is nothing to insult anyone with; phrases are shown in each viewer's own language.
 * Shared by the server (it checks ids and rate limits) and the client.
 */
export const EMOTES = ['laugh', 'love', 'cool', 'wow', 'angry', 'cry', 'think', 'party'] as const;
export const PHRASES = ['hi', 'nice', 'thanks', 'oops', 'hurry', 'gg', 'villain', 'sneaky', 'lucky', 'close', 'revenge', 'again'] as const;
export type EmoteId = (typeof EMOTES)[number];
export type PhraseId = (typeof PHRASES)[number];
export type ReactionId = EmoteId | PhraseId;

const ALL = new Set<string>([...EMOTES, ...PHRASES]);
export const isReactionId = (x: unknown): x is ReactionId => typeof x === 'string' && ALL.has(x);
export const isEmote = (id: ReactionId): id is EmoteId => (EMOTES as readonly string[]).includes(id);

/** how long a reaction stays over the plate */
export const REACTION_MS = 2600;
/** after each reaction, the next one waits this long */
export const REACTION_COOLDOWN_MS = 2500;
/** and at most this many in a window */
export const REACTION_BURST = 4;
export const REACTION_WINDOW_MS = 15_000;

/** The anti-spam rule, the same on the phone (to grey the button out) and on the server (to drop extras). */
export class ReactionLimiter {
  private times: number[] = [];
  /** ms until the next reaction is allowed (0: now) */
  wait(now = Date.now()) {
    this.times = this.times.filter(t => now - t < REACTION_WINDOW_MS);
    const last = this.times[this.times.length - 1];
    let w = last === undefined ? 0 : last + REACTION_COOLDOWN_MS - now;
    if (this.times.length >= REACTION_BURST) w = Math.max(w, this.times[0] + REACTION_WINDOW_MS - now);
    return Math.max(0, w);
  }
  /** records a reaction; false (and nothing recorded) when it comes too soon */
  take(now = Date.now()) {
    if (this.wait(now) > 0) return false;
    this.times.push(now);
    return true;
  }
}

/** A reaction shown over a seat's plate. */
export interface ShownReaction {
  seat: number;
  id: ReactionId;
  /** unique per reaction, so the same one twice in a row animates again */
  key: number;
}

/** The table's reactions as they arrive (from the server, the local player or a bot). */
class ReactionBus {
  private seq = 0;
  private subs = new Set<(r: ShownReaction) => void>();
  push(seat: number, id: ReactionId) {
    const r = { seat, id, key: ++this.seq };
    for (const f of this.subs) f(r);
  }
  subscribe(f: (r: ShownReaction) => void) {
    this.subs.add(f);
    return () => { this.subs.delete(f); };
  }
}
export const reactionBus = new ReactionBus();
