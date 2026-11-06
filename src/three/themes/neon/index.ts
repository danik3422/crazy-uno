import { CELL_ID } from '../../effects/cardFx/atlas';
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
  // events: a laser strike instead of a meteor, magenta bolts, neon light trails racing round
  events: {
    hot: '#ff4fd8',
    sparks: ['#4ff6ff', '#ff4fd8', '#ffffff'],
    ring: '#4ff6ff',
    light: '#ff4fd8',
    smoke: '#2a0a4a',
    smokeAlpha: 0.35,
    meteor: { head: null, spin: 0, trail: ['#ffffff', '#ff4fd8'], beam: true, extra: 'ripples' },
    bolt: { core: '#ffffff', glow: '#ff4fd8', beam: false, cloud: '#2a1050' },
    coin: { color: '#ffd04a', emissive: '#d0209a', sparkle: '#4ff6ff' },
    wave: { splat: CELL_ID.ring, additive: true, bubbles: false },
    orbit: { cell: CELL_ID.streak, colors: ['#ff4fd8', '#4ff6ff', '#fff35a'], size: 0.9, flap: false, additive: true },
    fog: '#12062a',
    confetti: ['#ff4fd8', '#4ff6ff', '#fff35a', '#a96bff'],
  },
};
