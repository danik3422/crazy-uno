import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/**
 * The stage in each current colour. `inner` is a light tint of the colour, never near-white, so the middle of
 * the table stays clearly red / yellow / green / blue and the white-bordered cards still pop against it;
 * `mid` is the full, saturated colour of the seat band; `outer` the deep tone of the stage floor and sky.
 */
export const palette: Record<Color, Palette> = {
  red: { inner: '#ff8f6a', mid: '#e3311f', outer: '#2c0406', accent: '#ff8a5c' },
  yellow: { inner: '#ffe27a', mid: '#f0a000', outer: '#2e1600', accent: '#ffe27a' },
  green: { inner: '#a3f08f', mid: '#18a64a', outer: '#021e11', accent: '#8dffb0' },
  blue: { inner: '#93d4ff', mid: '#2f5fe9', outer: '#0b0a3a', accent: '#8ac8ff' },
};
