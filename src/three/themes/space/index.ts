import type { TableTheme } from '../types';
import { drawBack } from './back';
import { Decor } from './Decor';
import { spaceFace } from './face';
import { floor } from './floor';
import { Landing } from './Landing';
import { palette } from './palette';

export const theme: TableTheme = {
  palette,
  floor,
  shadowOpacity: 0.4,
  drawBack,
  drawFace: spaceFace,
  // soft cyan starlight behind the cards you can play
  glow: '#8fe8ff',
  // zero gravity: high floaty arcs, a slow tumble, a little drift sideways and cards bobbing in the hands
  motion: { arc: 1.6, spin: 0.6, sway: 0.22, hoverLift: 1.3, float: 0.04 },
  Decor,
  Landing,
};
