import type { ThemeId } from '../../game/types';
import { Decor as ClassicDecor } from './classic/Decor';
import { Landing as ClassicLanding } from './classic/Landing';
import { Decor as HalloweenDecor } from './halloween/Decor';
import { Landing as HalloweenLanding } from './halloween/Landing';
import { Decor as NeonDecor } from './neon/Decor';
import { Landing as NeonLanding } from './neon/Landing';
import { Decor as SpaceDecor } from './space/Decor';
import { Landing as SpaceLanding } from './space/Landing';
import { Decor as WinterDecor } from './winter/Decor';
import { Landing as WinterLanding } from './winter/Landing';
import type { ThemeScene } from './types';

/** The 3D objects of every table. Kept apart from THEMES (index.ts) so the menus never pull in three.js. */
export const SCENES: Record<ThemeId, ThemeScene> = {
  classic: { Decor: ClassicDecor, Landing: ClassicLanding },
  neon: { Decor: NeonDecor, Landing: NeonLanding },
  space: { Decor: SpaceDecor, Landing: SpaceLanding },
  halloween: { Decor: HalloweenDecor, Landing: HalloweenLanding },
  winter: { Decor: WinterDecor, Landing: WinterLanding },
};
