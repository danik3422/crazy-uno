/* The shapes the table layout works with. */

export type Vec3 = [number, number, number];
export type Zone = 'deck' | 'discard' | 'hand' | 'opp';

export interface Target {
  pos: Vec3;
  /** Euler angles, order YXZ: yaw around the table, then tilt, then in-plane spin */
  rot: Vec3;
  zone: Zone;
  interactive: boolean;
  dim: boolean;
  /** seconds to wait before the first flight (staggered deal) */
  delay: number;
  /** buried deep in the deck or the pile: not drawn at all */
  hidden?: boolean;
  /** smaller cards for big hands, so they still fit on screen */
  scale?: number;
  /** cards that bob together on a table that floats them (one hand or one opponent's wall) */
  bobGroup?: number;
  /** place in its owner's hand: cards drawn together leave the deck in this order */
  seq?: number;
  /** the card you drew and can play: held up big in front of you until you play it or pass */
  held?: boolean;
  /** Jump-In: not your turn, but this card is exactly like the top one and may be thrown in */
  jump?: boolean;
}

export interface View {
  portrait: boolean;
  /** a phone lying on its side: wide and very short */
  compact?: boolean;
  /** width / height of the canvas (the layout fits the hand to what the camera sees) */
  aspect?: number;
  /** height of the canvas in CSS pixels */
  h?: number;
}

