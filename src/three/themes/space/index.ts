import { CELL_ID } from '../../cardFx/atlas';
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
  // events: an icy comet, a straight cosmic beam, stars orbiting the table
  events: {
    hot: '#9fe8ff',
    sparks: ['#ffffff', '#9fe8ff', '#c9a0ff'],
    ring: '#b9d8ff',
    light: '#8fc8ff',
    smoke: '#3a2a7a',
    smokeAlpha: 0.35,
    meteor: { head: null, spin: 0, trail: ['#ffffff', '#4aa8ff'], beam: false, extra: 'stars' },
    bolt: { core: '#ffffff', glow: '#8f7cff', beam: true, cloud: '#2a1a6a' },
    coin: { color: '#ffe27a', emissive: '#4a5cd8', sparkle: '#ffffff' },
    wave: { splat: CELL_ID.glow, additive: true, bubbles: false },
    orbit: { cell: CELL_ID.star, colors: ['#ffffff', '#9fe8ff', '#ffe27a'], size: 0.42, flap: false, additive: true },
    fog: '#0a0a2a',
    confetti: ['#ffffff', '#9fe8ff', '#c9a0ff', '#ffe27a'],
  },
};
