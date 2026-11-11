import { CELL_ID } from '../../effects/cardFx/cells';
import type { TableTheme } from '../types';
import { drawBack } from './back';
import { drawFace } from './face';
import { floor } from './floor';
import { palette } from './palette';

export const theme: TableTheme = {
  palette,
  floor,
  shadowOpacity: 0.35,
  drawBack,
  drawFace,
  // icy cyan-white, like frost catching the light
  glow: '#bff4ff',
  // cards skate: a low, gliding arc with a slight side-to-side sway, and hands that float a little
  motion: { arc: 0.72, spin: 0.06, sway: 0.3, hoverLift: 1.18, float: 0.028 },
  // events: a giant snowball, an ice-blue strike with ice shards, snowflakes instead of stars
  events: {
    hot: '#bff4ff',
    sparks: ['#ffffff', '#9fe0ff', '#ffd36a'],
    ring: '#d8f4ff',
    light: '#9fd8ff',
    smoke: '#dfeaff',
    smokeAlpha: 0.45,
    meteor: { head: CELL_ID.snowball, spin: 0.9, trail: ['#ffffff', '#7ac8ff'], beam: false, extra: 'snow' },
    bolt: { core: '#ffffff', glow: '#7ad8ff', beam: false, cloud: '#5a6a96', crackle: CELL_ID.shard },
    coin: { color: '#e8f2ff', emissive: '#3a6ab8', sparkle: '#bff4ff' },
    wave: { splat: CELL_ID.flake, additive: true, bubbles: false },
    orbit: { cell: CELL_ID.flake, colors: ['#ffffff', '#9fe0ff', '#ffd36a', '#ff8a96'], size: 0.5, flap: false, additive: true },
    twinkle: CELL_ID.flake,
    fog: '#0a1440',
    confetti: ['#ffffff', '#9fe0ff', '#df3346', '#169a62', '#f3b21f'],
  },
};
