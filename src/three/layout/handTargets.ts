import type { GameView } from '../../game/view';
import type { Player } from '../../game/types';
import { CARD_W } from '../cards/cardShape';
import { visibleHalfWidth } from './camera';
import { cardsRect, handRoom, toScreen } from './fit';
import { HELD, arena, handScale } from './table';
import { MIN_SLOT } from '../cards/touchSlots';
import type { Target, Vec3, View } from './types';

const PI = Math.PI;
/** how far (table units, a card is 1.5 tall) the hand sinks while it is someone else's turn */
const HAND_REST = 0.4;

/** what every part of the layout shares while it places one player's cards */
export interface PlaceCtx {
  g: GameView;
  v: View;
  A: ReturnType<typeof arena>;
  out: Map<number, Target>;
  /** when a card leaves the deck in the opening deal (seconds) */
  dealDelay: (idx?: number) => number;
  seat: number;
  viewer: number | null;
  myTurn: boolean;
  over: boolean;
}

/**
 * Your own hand: a fan along the bottom of the screen (two rows when it is big), the playable cards risen and
 * shown whole, the card you just drew held up in front; at the finale, laid flat in front of you.
 */
export function placeHand({ g, v, A, out, dealDelay, seat, viewer, myTurn, over }: PlaceCtx, p: Player) {
  const s = g.s;
  const m = p.hand.length;
  if (over) {
    // finale: lay the leftover hand flat in front, out of the podium's way
    const flatW = Math.min(A.hand.maxW, 2 * (visibleHalfWidth(v, 0, A.hand.z - 0.3) * 0.92) - 1.0);
    const sp = Math.min(0.7, flatW / Math.max(m - 1, 1));
    p.hand.forEach((c, k) => {
      const off = k - (m - 1) / 2;
      out.set(c.id, {
        pos: [off * sp, 0.03 + k * 0.004, A.hand.z - 0.3],
        rot: [-PI / 2, 0, -off * 0.04],
        zone: 'hand', interactive: false, dim: false, delay: 0,
      });
    });
    return;
  }
  {
    const big = handScale(v);
    // what the screen leaves for the hand: clear of the HUD's corner panels, its lowest corner above the bottom edge
    const room = handRoom(v);
    // blind event: you still play, but you cannot see what
    const faceUp = (viewer === seat && s.blindTurns === 0) || over;
    // the card you just drew and can play stays up in front of you until you play it (or pass)
    const held = myTurn && faceUp && s.phase === 'play' && s.drawn && s.pending === 0
      ? p.hand.find(c => c.id === s.lastDrawn && g.playable(c))
      : undefined;
    if (held) {
      const H = v.portrait ? HELD.portrait : HELD.landscape;
      const t: Target = { pos: [...H.pos], rot: [H.tilt, 0, 0], zone: 'hand', interactive: true, dim: false, delay: 0, scale: H.scale, held: true, seq: p.hand.indexOf(held) };
      // whole on screen, hovered (it grows) and floating, above the bottom panels
      const r = cardsRect(v, [t], 1.15);
      const lift = Math.max(0, r.y1 - room.bottom) - Math.max(0, room.y0 + 40 - r.y0);
      if (lift) t.pos[1] += moveUp(v, t, lift);
      out.set(held.id, t);
    }
    const hand = held ? p.hand.filter(c => c !== held) : p.hand;
    const m = hand.length;
    const rest = !myTurn && !over && s.phase !== 'handover' ? HAND_REST : 0;
    // pixels per table unit across the hand, to turn the overflow into a narrower spread
    const ppu = toScreen(v, 1, A.hand.y, A.hand.z).x - toScreen(v, 0, A.hand.y, A.hand.z).x;
    // a big hand goes into two rows (the back row a little higher), so every card stays readable. A phone on its side
    // splits it as soon as one row would leave a card less than a fingertip of the hand to be picked by (MIN_SLOT)
    const oneRow = v.compact ? Math.floor((room.x1 - room.x0 - CARD_W * big * ppu) / MIN_SLOT) + 1 : 20;
    const rows = m > (v.portrait ? 11 : Math.min(20, Math.max(7, oneRow))) ? 2 : 1;
    const backN = rows === 2 ? Math.ceil(m / 2) : m;
    const tilt = A.hand.tilt;
    // the card face normal and its "up" direction: rows and layers move along them
    const ny = -Math.sin(tilt);
    const nz = Math.cos(tilt);
    const uy = Math.cos(tilt);
    const uz = Math.sin(tilt);
    // who may be laid now (your turn), or thrown in out of turn (Jump-In)
    const state = hand.map(c => {
      let interactive = false;
      let dim = false;
      let jump = false;
      if (myTurn && !over) {
        if (s.phase === 'play') {
          interactive = g.playable(c);
          dim = !interactive;
        } else if (s.phase === 'choose' && s.choice?.kind === 'card') interactive = true;
      } else if (!over && faceUp && g.jumpable(c)) interactive = jump = true;
      return { interactive, dim, jump };
    });
    /** smaller cards for a hand too big for the screen (see below) */
    let shrink = 1;
    /**
     * Lays the hand out at most `maxW` wide, `shift` further up along its slant than usual, sunk by `sink`.
     */
    const lay = (into: Map<number, Target>, maxW: number, shift: number, sink: number) => {
      const h = { ...A.hand, maxW };
      // a playable card stands in front, shown whole: the fan opens around it (the card after it moves out of
      // the way, far enough that its corner number stays in view). The other cards share what room is left.
      // In a hand where you can play everything (or "pick a card to give"), the plain fan stays.
      // rows where there is no room to show the playable cards whole: those stay a plain fan
      const flat = new Set<number>();
      const raise = (k: number) => state[k].interactive && !state.every(x => x.interactive) && !flat.has(k);
      const xs: number[] = [];
      const rowSizes = rows === 2 ? [backN, m - backN] : [m];
      let first = 0;
      for (let r = 0; r < rowSizes.length; r++) {
        const n = rowSizes[r];
        const cs = (rows === 2 ? (v.portrait ? 0.86 : 0.8) : 1) * big * shrink;
        // on a phone on its side, two rows of cards made smaller to fit the height keep their usual spacing (the room
        // allowing): what shows of each card stays wide enough for a finger
        const sp = Math.min(h.sp * (rows === 2 && v.compact ? cs / shrink : cs), (h.maxW - (rows === 2 ? (v.portrait ? 0.9 : 1.2) : 0)) / Math.max(n - 1, 1));
        const room = sp * Math.max(n - 1, 0);
        // A raised card wants a whole card width after it (it stands in front and hides the next card's left side,
        // where the number is); the card just before a raised one keeps at least its corner number in view.
        const w = CARD_W * cs;
        const want: number[] = [];
        for (let i = 0; i < n - 1; i++) {
          const here = raise(first + i);
          const next = raise(first + i + 1);
          want.push(here ? Math.max(sp, w * 1.0) : next ? Math.max(Math.min(sp, w * 0.2), w * 0.3) : Math.min(sp, w * 0.2));
        }
        const need = want.reduce((a, b) => a + b, 0);
        const roomMax = Math.max(room, h.maxW - w * 0.2);
        let gaps: number[];
        if (need <= roomMax) {
          // it fits: the plain cards share the rest of the room (up to their usual step)
          const spare = roomMax - need;
          const plainIdx = want.map((_, i) => i).filter(i => !raise(first + i));
          const extra = plainIdx.length ? Math.min(spare / plainIdx.length, sp) : 0;
          gaps = want.map((d, i) => (raise(first + i) ? d : Math.min(Math.max(d, sp), d + extra)));
        } else {
          // too many to show whole: the plain fan, the playable cards just risen in it (every number stays in view)
          for (let i = 0; i < n; i++) flat.add(first + i);
          gaps = Array.from({ length: Math.max(n - 1, 0) }, () => sp);
        }
        const total = gaps.reduce((a, b) => a + b, 0);
        let x = -total / 2;
        for (let i = 0; i < n; i++) {
          xs[first + i] = x;
          x += gaps[i] ?? 0;
        }
        first += n;
      }
      hand.forEach((c, k) => {
        const row = rows === 2 && k >= backN ? 1 : 0;
        const inRow = row ? k - backN : k;
        const rowN = row ? m - backN : backN;
        // two rows: smaller cards and a narrower spread, so both rows fit on screen
        // a phone lying on its side: bigger cards, easier to read and to hit with a finger
        const cs = (rows === 2 ? (v.portrait ? 0.86 : 0.8) : 1) * big * shrink;
        const off = inRow - (rowN - 1) / 2;
        const x = xs[k];
        const { interactive, dim, jump } = state[k];
        // a playable card rises; in a two-row hand the front row only a little, or it would cover the row behind
        const lift = interactive ? (rows === 2 && row === 1 ? 0.1 : 0.3) : 0;
        // each card in front of its left neighbour, the front row in front of the back row, and a raised card in
        // front of everything in its row (the fan has opened around it, so it hides no corner number).
        // The step shrinks for big hands so the whole fan never comes too close to the camera.
        const layer = inRow * Math.min(0.02, 0.3 / rowN) + row * 0.32 + (raise(k) ? 0.12 : 0);
        // two rows sit a bit higher, so the front row clears the bottom panel
        // waiting for someone else: the hand sinks a little (corners still readable); on your turn it rises
        const up = (rows === 2 ? (row ? -0.38 : 0.42) * cs + (v.portrait ? 0.1 : 0.32) : 0) - sink + shift;
        into.set(c.id, {
          // the lift runs up along the hand's own slant: straight up in the world would tip the card back behind its
          // neighbours (the hand leans toward you)
          pos: [x, h.y + ny * layer + uy * (up + lift) - Math.abs(off) * 0.86 * 0.02, h.z + nz * layer + uz * (up + lift)],
          rot: [faceUp ? tilt : tilt + PI, 0, -off * Math.min(0.035, 0.4 / rowN)],
          zone: 'hand', interactive, dim, jump, delay: dealDelay(c.dealIdx), scale: cs, seq: p.hand.indexOf(c),
        });
      });
    };

    // Fit the hand to the room the screen leaves it, measured through the camera: first how far up it sits (its
    // lowest corner, while it rests sunk, just above the bottom edge or the panels), then how wide it may spread,
    // then the height once more (a narrower hand is shallower). It never depends on the turn, so it does not jump.
    const probe = new Map<number, Target>();
    const measure = (maxW: number, shift: number, sink = HAND_REST) => {
      probe.clear();
      lay(probe, maxW, shift, sink);
      return cardsRect(v, probe.values());
    };
    /** the width the hand takes, sunk or risen (risen, further from the camera, the raised cards fan out wider) */
    const span = (maxW: number, shift: number) => {
      const a = measure(maxW, shift);
      if (rest === HAND_REST) return a;
      const b = measure(maxW, shift, rest);
      return { ...a, x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1) };
    };
    const settle = (maxW: number, shift: number) => {
      // the screen position is nearly linear in the shift: two secant steps land within a pixel
      let s0 = shift;
      let b0 = measure(maxW, s0).y1 - room.bottom;
      let s1 = s0 + 0.4;
      for (let i = 0; i < 3 && Math.abs(b0) > 0.5; i++) {
        const b1 = measure(maxW, s1).y1 - room.bottom;
        if (Math.abs(b1 - b0) < 1e-6) break;
        const next = s1 - (b1 * (s1 - s0)) / (b1 - b0);
        s0 = s1;
        b0 = b1;
        s1 = next;
      }
      return Math.abs(b0) <= 0.5 ? s0 : s1;
    };
    // the hand, risen on your turn, stops short of the middle of the pile and of the opponents' fans above its corners
    // (computeTargets places those first)
    let pileY = toScreen(v, A.discard[0], 0, A.discard[2]).y + room.y0 * 2;
    if (!over) {
      g.s.players.forEach((o, i) => {
        if (i === seat || !o.hand.length) return;
        const fan = cardsRect(v, o.hand.map(c => out.get(c.id)).filter((t): t is Target => !!t));
        if (fan.x1 > room.x0 && fan.x0 < room.x1) pileY = Math.max(pileY, fan.y1 + 6);
      });
      // and of the deck: its top cards, and the stack under them down to the table
      const deck = [...out.values()].filter(t => t.zone === 'deck' && !t.hidden);
      if (deck.length) {
        const r = cardsRect(v, [...deck, ...deck.map(t => ({ ...t, pos: [t.pos[0], 0, t.pos[2]] as Vec3 }))]);
        if (r.x1 > room.x0 && r.x0 < room.x1) pileY = Math.max(pileY, r.y1 + 6);
      }
    }
    let maxW = A.hand.maxW;
    let shift = 0;
    for (let pass = 0; pass < 5 && m; pass++) {
      shift = settle(maxW, shift);
      if (m > 1) {
        for (let i = 0; i < 4; i++) {
          const r = span(maxW, shift);
          const over = Math.max(room.x0 - r.x0, r.x1 - room.x1);
          if (over <= 0.5) break;
          // the spread the hand has now (a small hand spreads less than maxW), narrowed by the overflow on both sides
          const spread = Math.min(maxW, (r.x1 - r.x0) / ppu - CARD_W * big * shrink);
          maxW = Math.max(0.3, spread - (2 * over * 1.04) / ppu);
        }
        shift = settle(maxW, shift);
      }
      // too tall (a big hand in two rows on a short screen): smaller cards, then fit again
      const r = measure(maxW, shift, 0);
      if (r.y0 >= pileY - 0.5 || pass === 4) break;
      shrink *= Math.max(0.6, ((room.bottom - pileY) / (room.bottom - r.y0)) * 0.99);
      maxW = A.hand.maxW;
    }
    lay(out, maxW, shift, rest);
    return;
  }
}

/** How far up (table units) to move a card so it rises `px` pixels on the screen. */
function moveUp(v: View, t: Target, px: number) {
  const a = toScreen(v, t.pos[0], t.pos[1], t.pos[2]).y;
  const b = toScreen(v, t.pos[0], t.pos[1] + 0.1, t.pos[2]).y;
  return a - b > 1e-6 ? (px * 0.1) / (a - b) : 0;
}
