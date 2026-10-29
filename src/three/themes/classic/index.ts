import type { TableTheme } from '../types';
import { drawBack } from './back';
import { Decor } from './Decor';
import { drawFace } from './face';
import { floor } from './floor';
import { Landing } from './Landing';
import { palette } from './palette';

export const theme: TableTheme = {
  palette,
  floor,
  shadowOpacity: 0.3,
  drawBack,
  drawFace,
  glow: '#ffeaa0',
  // confident and punchy: a slightly higher throw with a small flick of spin, a crisp lift on hover
  motion: { arc: 1.15, spin: 0.16, sway: 0, hoverLift: 1.18, float: 0 },
  Decor,
  Landing,
};
