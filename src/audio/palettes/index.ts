import type { ThemeId } from '../../game/types';
import { classic } from './classic';
import { halloween } from './halloween';
import { neon } from './neon';
import { space } from './space';
import type { Palette } from './types';
import { winter } from './winter';

export { SFX_IDS, type SfxId, type Palette, type Song } from './types';

/** Each table's sounds and music. */
export const PALETTES: Record<ThemeId, Palette> = { classic, neon, space, halloween, winter };

/** Used away from the tables (menus) and for any table without its own palette. */
const DEFAULT_THEME: ThemeId = 'classic';

export function paletteFor(theme: ThemeId | null | undefined): Palette {
  return (theme && PALETTES[theme]) || PALETTES[DEFAULT_THEME];
}
