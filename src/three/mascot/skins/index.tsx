import type { RefObject } from 'react';
import type * as THREE from 'three';
import type { MascotSkin } from '../../../game/skins';
import { BarrelPlane } from './Barrel';
import { Blimp } from './Blimp';
import { Dog } from './Dog';
import { Goose } from './Goose';
import { Tractor } from './Tractor';

/**
 * The mascot's body for each skin. Every body flies nose-first along +z, about the barrel plane's size
 * (roughly 3 wide, 1.6 long, 1.5 tall around the origin), and spins `prop` (its propeller, rotor or the like):
 * Mascot.tsx turns that group around z every frame.
 */
export function MascotBody({ skin, prop }: { skin: MascotSkin; prop: RefObject<THREE.Group> }) {
  switch (skin) {
    case 'goose':
      return <Goose prop={prop} />;
    case 'tractor':
      return <Tractor prop={prop} />;
    case 'dog':
      return <Dog prop={prop} />;
    case 'blimp':
      return <Blimp prop={prop} />;
    default:
      return <BarrelPlane prop={prop} />;
  }
}
