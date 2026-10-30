import type { Card, State } from './types';

/**
 * Pure rule checks on a game state. Shared by the engine (local games and the server)
 * and by the online client, so both always agree on what is allowed.
 */

/** How many cards a draw card makes the next player take (0 for any other card). */
export function drawValue(c: Card): number {
  switch (c.type) {
    case 'draw2': return 2;
    case 'draw4': case 'wild4': case 'wildRev4': return 4;
    case 'wild6': return 6;
    case 'wild10': return 10;
    default: return 0;
  }
}

/** May `c` go on the pile right now (ignoring "only the card you just drew")? */
export function canPlayCard(s: State, c: Card): boolean {
  const top = s.discard[s.discard.length - 1];
  if (s.pending > 0) {
    // a penalty is waiting: only cards that answer it
    if (c.type === 'mirror') return true;
    if (!s.rules.stack) return false;
    // No Mercy: any draw card at least as big as the last one in the stack
    if (s.rules.noMercy) return drawValue(c) >= s.pendingLast;
    if (c.type === 'wild4') return true;
    return c.type === 'draw2' && s.pendingType === 'draw2';
  }
  if (c.color === 'wild' || c.color === s.color) return true;
  if (c.type === 'num') return top.type === 'num' && c.value === top.value;
  return c.type === top.type;
}

/** Like `canPlayCard`, plus: after drawing you may only play the card you just drew. */
export function playableCard(s: State, c: Card): boolean {
  return canPlayCard(s, c) && (!s.drawn || c.id === s.lastDrawn);
}

/** The seat `steps` places from `from` in the current direction of play. Knocked-out players are passed over. */
export function nextSeat(s: State, from = s.cur, steps = 1): number {
  const n = s.players.length;
  let i = from;
  for (let k = 0; k < steps; k++) {
    let guard = 0;
    do i = (((i + s.dir) % n) + n) % n;
    while (s.players[i]?.out && ++guard < n);
  }
  return i;
}

/** Seats still in the game (No Mercy knocks players out). */
export function activeSeats(s: State): number[] {
  return s.players.map((p, i) => (p.out ? -1 : i)).filter(i => i >= 0);
}

/** Both players are on the same team (teams format only). */
export function sameTeam(s: State, a: number, b: number): boolean {
  return !!s.teams && s.teams[a] === s.teams[b];
}

/** Someone forgot to call UNO and may still be caught. */
export function isCatchable(s: State): boolean {
  const c = s.unoCatch;
  return !!c && s.phase !== 'over' && s.turn <= c.until && s.players[c.victim]?.hand.length === 1;
}

/** Jump-In: may the player in `seat` lay `c` out of turn right now? (The current player just plays normally.) */
export function canJumpIn(s: State, seat: number, c: Card): boolean {
  if (!s.rules.jumpIn || s.phase !== 'play' || seat === s.cur) return false;
  const p = s.players[seat];
  if (!p || p.out || c.hidden || !p.hand.some(x => x.id === c.id)) return false;
  // nothing may be waiting on a decision: a +4 challenge, the opening Wild, a roulette
  if (s.choice || s.challenge || s.wildStart || s.rouletteNext) return false;
  const top = s.discard[s.discard.length - 1];
  // coloured cards only, exactly like the one on the pile (and that card's colour still in force)
  if (!top || c.color === 'wild' || c.color !== top.color || c.type !== top.type || c.value !== top.value) return false;
  if (s.color !== top.color) return false;
  // a penalty is waiting: only an identical draw card, and only when penalties stack (it passes on from the jumper)
  if (s.pending > 0) return s.rules.stack && drawValue(c) > 0;
  return true;
}
