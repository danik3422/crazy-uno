import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/**
 * A moonlit frozen lake: the ice glows in the colour of play (inner, deepening toward the shore through mid),
 * the snow around it is lit blue, and the night beyond is a deep navy (outer, also the sky and fog).
 * Inner colours stay saturated so the colour of play reads at a glance, but not neon, so cards still pop.
 */
export const palette: Record<Color, Palette> = {
  red: { inner: '#d93a4c', mid: '#5c1832', outer: '#080b20', accent: '#ff8f9a' },
  yellow: { inner: '#e9a92a', mid: '#7a5216', outer: '#0a0c20', accent: '#ffd36a' },
  green: { inner: '#1fae79', mid: '#0d4842', outer: '#050f1e', accent: '#7affc8' },
  blue: { inner: '#3a86f0', mid: '#123a78', outer: '#060b24', accent: '#9ad8ff' },
};
