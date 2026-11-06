import type { ComponentType } from 'react';
import type { Card, Color } from '../../game/types';
import type { EventLook } from '../effects/eventFx/look';
import type { Vec3 } from '../layout';

/** Arena colours for one current colour: the floor glow inside, the middle, the far dark, and an accent for decor. */
export interface Palette { inner: string; mid: string; outer: string; accent: string }

/**
 * How cards move on this table. Every number is a multiplier or an amplitude around the classic feel,
 * so 0 / 1 keep the classic behaviour.
 */
export interface CardMotion {
  /** height of the arc a flying card makes (1 = classic) */
  arc: number;
  /** extra turns around the card's own face normal during a flight (0 = none; 1 = one full turn) */
  spin: number;
  /** sideways S-swing during a flight, in table units (0 = straight) */
  sway: number;
  /** how far a hovered hand card lifts (1 = classic) */
  hoverLift: number;
  /** cards at rest in the hands bob gently up and down by this much (0 = still) */
  float: number;
}

export interface DecorProps {
  /** the theme accent for the current colour, eases when the colour changes */
  accent: string;
  /** a narrow portrait screen: keep things closer to the table */
  portrait: boolean;
  /** a phone: fewer objects, no extra lights, cheap materials */
  lite: boolean;
}

export interface LandingProps {
  /** the card on top of the pile; a new id means a new card was just played */
  top: Card;
  /** the pile's centre on the table */
  at: Vec3;
  lite: boolean;
}

/** Everything that makes one table look and feel like itself. Each theme lives in its own folder. */
export interface TableTheme {
  palette: Record<Color, Palette>;
  /**
   * GLSL for the floor. Runs inside main() after the base gradient; it reads and changes `vec3 col`.
   * Available: vPos (world position), p (xz around the pile, squashed), r = length(p), a = atan(p.y, p.x),
   * uTime, cIn / cMid / cOut (the palette colours, easing), hash(vec2), noise(vec2).
   */
  floor: string;
  /** strength of card shadows on the floor */
  shadowOpacity: number;
  drawBack(ctx: CanvasRenderingContext2D): void;
  drawFace(ctx: CanvasRenderingContext2D, card: Card): void;
  /** colour of the glow behind the cards you can play */
  glow: string;
  motion: CardMotion;
  /** objects around the table (with their own animation and pointer interaction) */
  Decor: ComponentType<DecorProps>;
  /** an extra effect of this table when a card lands on the pile (on top of the shared one) */
  Landing?: ComponentType<LandingProps>;
  /** how the random events look here, over the classic look (see eventFx/look.ts) */
  events?: Partial<EventLook>;
}
