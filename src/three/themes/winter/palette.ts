import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/** A snowy evening under a deep blue sky; the frozen lake round the pile glows in the colour of play. */
export const palette: Record<Color, Palette> = {
  red: { inner: '#e8475a', mid: '#2a1a3a', outer: '#060a1e', accent: '#ff8a96' },
  yellow: { inner: '#f2b437', mid: '#2a2a40', outer: '#070b1e', accent: '#ffd36a' },
  green: { inner: '#2fc489', mid: '#0f2a36', outer: '#040c1c', accent: '#7affc8' },
  blue: { inner: '#3d9bff', mid: '#112452', outer: '#050a20', accent: '#9ad8ff' },
};
