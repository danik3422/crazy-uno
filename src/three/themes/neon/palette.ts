import type { Color } from '../../../game/types';
import type { Palette } from '../types';

export const palette: Record<Color, Palette> = {
  red: { inner: '#ff2e88', mid: '#2a0634', outer: '#05010c', accent: '#ff2e88' },
  yellow: { inner: '#ffe600', mid: '#2a1a06', outer: '#05010c', accent: '#ffe600' },
  green: { inner: '#39ff88', mid: '#062a20', outer: '#02060a', accent: '#39ff88' },
  blue: { inner: '#2ee6ff', mid: '#061c34', outer: '#02040e', accent: '#2ee6ff' },
};
