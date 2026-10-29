import type { Color } from '../../../game/types';
import type { Palette } from '../types';

export const palette: Record<Color, Palette> = {
  red: { inner: '#ffd25e', mid: '#f0401e', outer: '#3c0505', accent: '#ff8a5c' },
  yellow: { inner: '#fff7b8', mid: '#f5a300', outer: '#3d1d00', accent: '#ffe27a' },
  green: { inner: '#e6ffa8', mid: '#20ad4c', outer: '#022514', accent: '#8dffb0' },
  blue: { inner: '#bdf3ff', mid: '#3a63f0', outer: '#100845', accent: '#8ac8ff' },
};
