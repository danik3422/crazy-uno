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
  shadowOpacity: 0.5,
  drawBack,
  drawFace,
  // witchy green: reads on every card colour and against the purple night
  glow: '#8dff4a',
  // cards drift like falling leaves: a lazy arc, a wide wobbling sway and a bat-like flutter spin
  motion: { arc: 1.35, spin: 0.5, sway: 0.42, hoverLift: 1.3, float: 0.045 },
  Decor,
  Landing,
};
