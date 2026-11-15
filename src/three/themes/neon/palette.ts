import type { Color } from '../../../game/types';
import type { Palette } from '../types';

// One synthwave night for every colour: the far dark stays a deep indigo (the club), the pool under the pile
// and every neon line take the current colour, so it reads at a glance without the floor turning muddy.
export const palette: Record<Color, Palette> = {
  red: { inner: '#ff2e6a', mid: '#3a0a2e', outer: '#07021a', accent: '#ff2e6a' },
  yellow: { inner: '#ffd60a', mid: '#33260a', outer: '#08041a', accent: '#ffd60a' },
  green: { inner: '#2bff8a', mid: '#06302a', outer: '#030619', accent: '#2bff8a' },
  blue: { inner: '#2ed8ff', mid: '#08224a', outer: '#03041c', accent: '#2ed8ff' },
};
