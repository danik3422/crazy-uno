import type { ThemeId } from '../../game/types';
import { theme as classic } from './classic';
import { theme as halloween } from './halloween';
import { theme as neon } from './neon';
import { theme as space } from './space';
import type { TableTheme } from './types';

/** Every table: its colours, floor, cards, decor and motion. One folder per theme. */
export const THEMES: Record<ThemeId, TableTheme> = { classic, neon, space, halloween };
export type { TableTheme } from './types';
