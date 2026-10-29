import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/** A moonlit purple night; the middle of the table glows in the colour of play. */
export const palette: Record<Color, Palette> = {
  red: { inner: '#e84a26', mid: '#2c0a26', outer: '#07020c', accent: '#ff7a1a' },
  yellow: { inner: '#f2a01e', mid: '#2e1420', outer: '#07020c', accent: '#ffb02a' },
  green: { inner: '#62e03a', mid: '#132012', outer: '#04070a', accent: '#9dff3a' },
  blue: { inner: '#8a6cff', mid: '#1c0f44', outer: '#060216', accent: '#b08aff' },
};
