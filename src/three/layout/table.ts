import type { Vec3, View, Zone } from './types';

/* The table itself: where the deck, the pile and your hand are, how big their cards are, and the ring of arrows. */

/**
 * How much bigger your hand's cards are than on a big screen. A phone lying on its side is short, so its cards
 * would come out tiny: the shorter the screen, the more they grow (about 1.25× on a tall phone, up to 1.4×).
 */
export function handScale(v: View) {
  if (!v.compact) return 1;
  const h = v.h ?? 390;
  // a narrower phone (16:9) has less room between the corner panels
  const byWidth = 1.22 + ((v.aspect ?? 2.1) - 1.75) * 0.3;
  return Math.max(1.18, Math.min(1.36, 1.32 + (390 - h) * 0.0018, byWidth));
}

/** The pile in the middle: bigger than a hand card on the table's far side would look, easier to read on a phone. */
export function pileScale(v: View) {
  return v.compact ? 1.5 : v.portrait ? 1.35 : 1.22;
}


/** Where the card you drew (and can play) waits in front of you: centred over your hand, facing you. */
export const HELD = {
  landscape: { pos: [0, 1.82, 3.72] as Vec3, tilt: -0.62, scale: 1.3 },
  portrait: { pos: [0, 4.6, 4.7] as Vec3, tilt: -1.08, scale: 1.2 },
};

/** height of the endless deck stack, and how many real cards lie on top of it */
export const DECK_TOP = 0.42;
export const DECK_SHOWN = 3;

/** Arena geometry: deck up-left of the pile, opponents along the far arc, you at the near edge. */
export function arena(v: View) {
  return v.portrait
    ? { deck: [0.35, 0, -3.35] as Vec3, discard: [0.75, 0, -0.45] as Vec3, rx: 2.85, rz: 4.5, hand: { y: 2.75, z: 6.75, maxW: 3.5, sp: 0.6, tilt: -0.85 } }
    : { deck: [-1.9, 0, -2.6] as Vec3, discard: [0.25, 0, -0.15] as Vec3, rx: 6.1, rz: 3.5, hand: { y: 1.15, z: 4.35, maxW: 8.6, sp: 0.86, tilt: -0.55 } };
}

/**
 * Shared with the render loop: where new cards appear (the deck) and where each player sits,
 * so effects like the bombing run can aim without knowing the game.
 */
export const spawn = { pos: [-2.45, 0.6, -1.25] as Vec3, seats: [] as Vec3[] };

/**
 * Where each card actually is on screen right now, written by the card itself every frame.
 * Online, a card can come back under a new id (fromId): it then starts from where the old one really was.
 * After a rebuilt canvas the cards reappear where they were. A card that was never on screen has no entry,
 * so it always starts from the deck.
 */
export const lastPlace = new Map<number, { pos: Vec3; quat: [number, number, number, number]; zone: Zone }>();

/** Radius of the ring of direction arrows around the pile (x; z is squashed by RING_Z). */
export const RING_R = 3.3;
export const RING_Z = 0.69;
