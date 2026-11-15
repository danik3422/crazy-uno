import type { Color } from '../../../game/types';
import type { Palette } from '../types';

/*
 * inner: the deck's rim light and the pool under the pile (bright, saturated);
 * mid: the nebula around the table (rich, mid-dark, unmistakably the current colour);
 * outer: deep space at the far edge, the fog and the browser bars (near black, just tinted).
 */
export const palette: Record<Color, Palette> = {
  red: { inner: '#ff5a4e', mid: '#6e1430', outer: '#08020a', accent: '#ff7a6a' },
  yellow: { inner: '#ffd23d', mid: '#6c5410', outer: '#090703', accent: '#ffd27a' },
  green: { inner: '#2cf09a', mid: '#0b5240', outer: '#020907', accent: '#7affc0' },
  blue: { inner: '#4f9dff', mid: '#182a7a', outer: '#03040e', accent: '#8ab0ff' },
};
