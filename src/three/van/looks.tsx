import type { ReactNode } from 'react';
import type { VanSkin } from '../../game/skins';
import { BavovnaRoof } from './roof/BavovnaRoof';
import { EggsRoof } from './roof/EggsRoof';
import { MarshrutkaRoof } from './roof/MarshrutkaRoof';
import { ShipRoof } from './roof/ShipRoof';

/**
 * How one van skin looks. The van's shape, door and wheels stay the same for every skin (the knock-out scene
 * is choreographed around them); a skin repaints it, prints its own words on the sides, dresses the crew,
 * and may add something on the roof.
 */
export interface VanLook {
  /** body paint and the darker trim (bumpers, mirror) */
  paint: string;
  trim: string;
  /** a shinier paint than the default matte one */
  gloss?: { metalness: number; roughness: number };
  /** wheel hubs */
  hub: string;
  hubMetal?: number;
  /** the words along both sides, and their colours: a vertical gradient with a dark outline */
  /** `band`: a painted stripe behind the words */
  print: { text: string; top: string; bottom: string; stroke: string; band?: string };
  /** the two big guys: uniform, darker trousers and cap */
  crew: { uniform: string; dark: string };
  /** extra objects on the van, in the van's own space (roof top at y ≈ 1.44, front at -x) */
  roof?: () => ReactNode;
}

const olive: VanLook = {
  paint: '#5d6338',
  trim: '#2a2c22',
  hub: '#7d8070',
  hubMetal: 0.5,
  print: { text: 'NAVIйну', top: '#fff27a', bottom: '#f5b800', stroke: '#151515' },
  crew: { uniform: '#5d6338', dark: '#454a29' },
};

/** the yellow city minibus: "pass your fare along", route 13, luggage tied on the roof */
const marshrutka: VanLook = {
  paint: '#f7c41a',
  trim: '#3a3a3a',
  hub: '#c8c8c8',
  hubMetal: 0.5,
  print: { text: 'ПЕРЕДАЙТЕ ЗА ПРОЇЗД', top: '#3b7be0', bottom: '#173f99', stroke: '#ffffff' },
  crew: { uniform: '#2b3b6b', dark: '#1d2848' },
  roof: () => <MarshrutkaRoof />,
};

/** «бавовна»: a white van with a crate of cotton on the roof */
const bavovna: VanLook = {
  paint: '#f1efe8',
  trim: '#6d6a62',
  hub: '#9a9a96',
  hubMetal: 0.4,
  print: { text: 'БАВОВНА', top: '#ffc640', bottom: '#e8461c', stroke: '#2a1a10' },
  crew: { uniform: '#b9bec4', dark: '#8a9097' },
  roof: () => <BavovnaRoof />,
};

/** the postage-stamp meme: blue and yellow, a warship going down on the roof */
const ship: VanLook = {
  paint: '#2463c4',
  trim: '#173c7a',
  hub: '#ffd21f',
  hubMetal: 0.3,
  print: { text: 'КОРАБЛЬ, ІДИ…', top: '#2f74dc', bottom: '#163f8f', stroke: '#ffffff', band: '#ffd21f' },
  crew: { uniform: '#1f2a48', dark: '#141b30' },
  roof: () => <ShipRoof />,
};

/** «яйця по 17»: a glossy black tender van with gold wheels and a golden egg */
const eggs: VanLook = {
  paint: '#23232c',
  trim: '#c9a227',
  gloss: { metalness: 0.2, roughness: 0.18 },
  // full metal would read black here (the table has no environment to reflect): mostly metal, still gold
  hub: '#ffcc33',
  hubMetal: 0.65,
  print: { text: 'ЯЙЦЯ ПО 17', top: '#fff3b0', bottom: '#d29a1e', stroke: '#3a2800' },
  crew: { uniform: '#26262e', dark: '#141418' },
  roof: () => <EggsRoof />,
};

export const VAN_LOOKS: Record<VanSkin, VanLook> = {
  olive,
  marshrutka,
  bavovna,
  ship,
  eggs,
};
