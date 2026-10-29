import type { Color } from '../../../game/types';
import type { Palette } from '../types';

export const palette: Record<Color, Palette> = {
  red: { inner: '#ff9a8a', mid: '#2a1240', outer: '#02010a', accent: '#ff7a6a' },
  yellow: { inner: '#ffe0a0', mid: '#2a1a40', outer: '#02010a', accent: '#ffd27a' },
  green: { inner: '#a0ffd0', mid: '#0e2440', outer: '#02010a', accent: '#7affc0' },
  blue: { inner: '#a8c8ff', mid: '#141a50', outer: '#02010a', accent: '#8ab0ff' },
};
