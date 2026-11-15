import type { RefObject } from 'react';
import type * as THREE from 'three';
import type { MascotSkin } from '../../../game/skins';
import { BarrelPlane } from './Barrel';
import { Blimp } from './Blimp';
import { Dog } from './Dog';
import { Goose } from './Goose';
import { Tractor } from './Tractor';

/** How the mascot is flying right now, written by Mascot.tsx every frame for the bodies that care. */
export interface MascotPose {
  /** on screen this frame (a hidden body skips its own animation) */
  active: boolean;
  /** 0..1: flying low over the table or over the player's hand, so long trailing parts fold away */
  furl: number;
}

type Vec3 = [number, number, number];

/**
 * Points on each body (its own space, nose along +z): where the bomb hangs on a bombing run, and where the
 * smoke trail comes out.
 */
export const MASCOT_ANCHORS: Record<MascotSkin, { bomb: Vec3; smoke: Vec3 }> = {
  // under the barrel, between the skids; smoke from the barrel's back
  barrel: { bomb: [0, -0.62, 0.05], smoke: [0, 0, -1.05] },
  // clutched in the tucked-back feet; smoke from the tail
  goose: { bomb: [0, -0.66, -0.2], smoke: [0, 0.04, -0.92] },
  // slung under the chassis between the wheels; smoke from the exhaust stack
  tractor: { bomb: [0, -0.52, 0.06], smoke: [0.13, 0.62, 0.5] },
  // under the doghouse floor; smoke from the back wall
  dog: { bomb: [0, -0.72, 0], smoke: [0, -0.18, -0.68] },
  // under the envelope behind the gondola; smoke behind the tail propeller
  blimp: { bomb: [0, -0.64, -0.22], smoke: [0, 0.16, -1.4] },
};

/**
 * The mascot's body for each skin. Every body flies nose-first along +z, about the barrel plane's size
 * (roughly 3 wide, 1.6 long, 1.5 tall around the origin), and spins `prop` (its propeller, rotor or the like):
 * Mascot.tsx turns that group around z every frame.
 */
export function MascotBody({ skin, prop, pose }: { skin: MascotSkin; prop: RefObject<THREE.Group>; pose: MascotPose }) {
  switch (skin) {
    case 'goose':
      return <Goose prop={prop} />;
    case 'tractor':
      return <Tractor prop={prop} />;
    case 'dog':
      return <Dog prop={prop} />;
    case 'blimp':
      return <Blimp prop={prop} pose={pose} />;
    default:
      return <BarrelPlane prop={prop} />;
  }
}
