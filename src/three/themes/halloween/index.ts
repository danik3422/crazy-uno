import { CELL_ID } from '../../effects/cardFx/cells';
import type { TableTheme } from '../types';
import { drawBack } from './back';
import { drawFace } from './face';
import { floor } from './floor';
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
  // events: a flaming pumpkin, a green witch bolt, slime, bats
  events: {
    hot: '#8dff4a',
    sparks: ['#8dff4a', '#ff8a1a', '#c07cff'],
    ring: '#8dff4a',
    light: '#7dff5a',
    smoke: '#2a1040',
    smokeAlpha: 0.55,
    meteor: { head: CELL_ID.pumpkin, spin: 1.2, trail: ['#e8ff8a', '#3fd02a'], beam: false, extra: 'bats' },
    bolt: { core: '#f0ffe0', glow: '#8dff4a', beam: false, cloud: '#2a1040' },
    coin: { color: '#ffd04a', emissive: '#b8400a', sparkle: '#8dff4a' },
    wave: { splat: CELL_ID.splat, additive: false, bubbles: true },
    orbit: { cell: CELL_ID.bat, colors: ['#1c0a30', '#2a1040'], size: 0.9, flap: true, additive: false },
    fog: '#1e3a12',
    confetti: ['#ff8a1a', '#8dff4a', '#c07cff', '#2a1040'],
  },
};
