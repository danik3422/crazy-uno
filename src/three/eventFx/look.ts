import { CELL_ID, type Cell } from '../cardFx/atlas';

/**
 * How the random events look on one table. Every table starts from the classic look (a bright game-show
 * stage) and changes what makes it itself: a neon laser instead of a meteor, a cosmic beam instead of
 * lightning, bats circling instead of carnival bulbs… The effects themselves (EventFx.tsx) are shared.
 */
export interface EventLook {
  /** impacts and flashes */
  hot: string;
  /** sparks thrown by impacts, cycled */
  sparks: [string, string, string];
  /** shock rings on the floor */
  ring: string;
  /** the one point light the effects share */
  light: string;
  /** smoke puffs (alpha-blended) and how dense they are */
  smoke: string;
  smokeAlpha: number;
  meteor: {
    /** what falls: a drawn rock or pumpkin (atlas cell), or nothing but light (comet / laser orb) */
    head: Cell | null;
    /** turns per second of the head (0 = it points along its flight) */
    spin: number;
    /** colours of the trail, from the head back */
    trail: [string, string];
    /** a laser beam marks the target before the hit */
    beam: boolean;
    /** what else bursts out on impact */
    extra: 'confetti' | 'ripples' | 'stars' | 'bats';
  };
  bolt: {
    core: string;
    glow: string;
    /** a straight column of light (a cosmic beam) instead of a jagged bolt */
    beam: boolean;
    /** the clouds that gather above the target */
    cloud: string;
  };
  coin: { color: string; emissive: string; sparkle: string };
  /** the colour wave of the recolour events */
  wave: {
    /** the blots it leaves on the floor */
    splat: Cell;
    /** glowing light (true) or paint (false) */
    additive: boolean;
    /** bubbles rising from the blots (slime) */
    bubbles: boolean;
  };
  /** what races around the table on a carousel */
  orbit: { cell: Cell; colors: string[]; size: number; flap: boolean; additive: boolean };
  /** the dark fog of the blind round */
  fog: string;
  confetti: string[];
}

export const CLASSIC_LOOK: EventLook = {
  hot: '#ffb23a',
  sparks: ['#ffd04a', '#ff6a2a', '#ffffff'],
  ring: '#fff2a8',
  light: '#ff9a3c',
  smoke: '#8a6c5c',
  smokeAlpha: 0.38,
  meteor: { head: CELL_ID.evMeteor, spin: 0, trail: ['#ffe27a', '#ff4a1a'], beam: false, extra: 'confetti' },
  bolt: { core: '#ffffff', glow: '#ffd86a', beam: false, cloud: '#3c3a52' },
  coin: { color: '#ffd04a', emissive: '#a86a00', sparkle: '#fff2a8' },
  wave: { splat: CELL_ID.splat, additive: false, bubbles: false },
  orbit: { cell: CELL_ID.dot, colors: ['#e5413a', '#f2bf16', '#26a556', '#2c79dc'], size: 0.55, flap: false, additive: false },
  fog: '#2a0a14',
  confetti: ['#e5413a', '#f2bf16', '#26a556', '#2c79dc', '#ffd04a'],
};

/** The full look of a table: its own changes over the classic one. */
export function eventLook(own?: Partial<EventLook>): EventLook {
  return own ? { ...CLASSIC_LOOK, ...own } : CLASSIC_LOOK;
}
