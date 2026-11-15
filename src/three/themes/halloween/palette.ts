import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/**
 * A moonlit purple night; the pool in the middle of the table glows in the colour of play.
 * The inner colours are saturated and kept apart from the decor's orange, so red / yellow / green / blue
 * read at a glance even on a dark table; the mids stay deep so the cards pop off the stones.
 */
export const palette: Record<Color, Palette> = {
  red: { inner: '#f2303a', mid: '#2a0a1c', outer: '#08020c', accent: '#ff4a4a' },
  yellow: { inner: '#ffd21f', mid: '#2a1e10', outer: '#08040a', accent: '#ffcf3a' },
  green: { inner: '#56e03a', mid: '#0e2016', outer: '#03080a', accent: '#8dff4a' },
  blue: { inner: '#4a7cff', mid: '#111a44', outer: '#040418', accent: '#6a9aff' },
};
