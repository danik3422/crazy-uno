import type { TableTheme } from '../types';
import { drawBack } from './back';
import { Decor } from './Decor';
import { neonFace } from './face';
import { floor } from './floor';
import { Landing } from './Landing';
import { palette } from './palette';

export const theme: TableTheme = {
  palette,
  floor,
  shadowOpacity: 0.4,
  drawBack,
  drawFace: neonFace,
  // a hot magenta halo behind the cards you can play
  glow: '#ff3df0',
  // snappy: low, fast arcs with a quick whirl and a slight glitchy side-step; hovered cards pop high
  motion: { arc: 0.6, spin: 1, sway: 0.12, hoverLift: 1.35, float: 0.02 },
  Decor,
  Landing,
};
