import { useId } from 'react';
import type { BadgeGlyph, BadgeTier } from '../../game/stats';

const TIER: Record<BadgeTier, [string, string, string]> = {
  // rim light, rim dark, ribbon
  bronze: ['#ffc38a', '#a85a24', '#c8562a'],
  silver: ['#ffffff', '#8a97ad', '#4a78c8'],
  gold: ['#fff2a0', '#d98a00', '#d8322a'],
};
/** the disc behind each picture */
const DISC: Record<BadgeGlyph, string> = {
  trophy: '#f2a516', crown: '#e0a000', flame: '#ef5a2a', card: '#2a2a3a', stack: '#c8322a', shout: '#e5413a', eye: '#2c79dc',
  bolt: '#7c4dff', scales: '#3a6aa8', rise: '#26a556', clock: '#2c79dc', skull: '#3a2a4a', tornado: '#6a4cd8', team: '#d8322a',
  globe: '#1f8fbf', map: '#26a556', rainbow: '#ffffff', marathon: '#e5413a',
};

const W = { fill: '#fff', stroke: '#1d1430', strokeWidth: 1.3, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;
const L = { fill: 'none', stroke: '#fff', strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** The pictures, drawn on a 24×24 grid. */
function Glyph({ g }: { g: BadgeGlyph }) {
  switch (g) {
    case 'trophy':
      return <><path {...W} d="M7 4h10v4a5 5 0 0 1-10 0z" /><path {...L} d="M7 6H4.5a2.5 2.5 0 0 0 2.6 3M17 6h2.5a2.5 2.5 0 0 1-2.6 3" /><path {...W} d="M10.5 13h3l.6 4h-4.2zM8 17.5h8v2.5H8z" /></>;
    case 'crown':
      return <><path {...W} d="M4 17 3 7l5 4 4-6 4 6 5-4-1 10z" /><path {...W} d="M4.5 18h15v2.2h-15z" /><circle cx="12" cy="13" r="1.5" fill="#e5413a" /></>;
    case 'flame':
      return <path {...W} d="M12 21c-4 0-6.5-2.6-6.5-6 0-3.4 2.6-5 3.6-8.5 1.8 1.4 2.4 3 2.3 4.6 1-.7 1.7-1.8 1.9-3.2 2.4 1.8 3.2 4.3 3.2 7.1 0 3.4-2.5 6-4.5 6z" />;
    case 'card':
      return <><rect {...W} x="6.5" y="3.5" width="11" height="17" rx="2" /><text x="12" y="15.2" textAnchor="middle" fontSize="7.5" fontWeight="900" fontFamily="var(--display), sans-serif" fill="#1d1430">+4</text></>;
    case 'stack':
      return <><rect {...W} x="9" y="3" width="9" height="13" rx="1.6" transform="rotate(12 13 10)" /><rect {...W} x="6" y="6" width="9" height="13" rx="1.6" transform="rotate(-8 10 12)" /><path d="M10.5 10.5v5M8 13h5" stroke="#e5413a" strokeWidth="2" strokeLinecap="round" /></>;
    case 'shout':
      return <><path {...W} d="M4 10h3l8-5v14l-8-5H4z" /><path {...L} d="M18 9.5a4 4 0 0 1 0 5M20 7a7.5 7.5 0 0 1 0 10" /></>;
    case 'eye':
      return <><path {...W} d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" /><circle cx="12" cy="12" r="3.2" fill="#1d1430" /><circle cx="13.2" cy="10.8" r="1" fill="#fff" /></>;
    case 'bolt':
      return <path {...W} d="M13.5 2.5 5 13.5h6l-1.5 8 8.5-11h-6z" />;
    case 'scales':
      return <><path {...L} d="M12 4v15M6 7h12M8 19h8" /><path {...W} d="M3 13l3-6 3 6a3 3 0 0 1-6 0zM15 13l3-6 3 6a3 3 0 0 1-6 0z" /></>;
    case 'rise':
      return <><path {...L} d="M4 18 9.5 12.5l3 3L20 8" /><path {...W} d="M15 6.5h6v6z" /></>;
    case 'clock':
      return <><circle {...W} cx="12" cy="13" r="7.5" /><path d="M12 9v4.4l3 1.8" fill="none" stroke="#1d1430" strokeWidth="2" strokeLinecap="round" /><path {...W} d="M10 3h4v2h-4z" /></>;
    case 'skull':
      return <><path {...W} d="M12 3.5c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.5 5v3h10v-3c1.4-1 2.5-2.6 2.5-5 0-4-3.1-7-7.5-7z" /><circle cx="9" cy="11" r="1.9" fill="#1d1430" /><circle cx="15" cy="11" r="1.9" fill="#1d1430" /><path d="M10.5 18.5v-2M13.5 18.5v-2" stroke="#1d1430" strokeWidth="1.3" /></>;
    case 'tornado':
      return <path {...L} d="M4 5h16M6 9h12M8 13h8M9.5 17h5M11 20.5h2.5" />;
    case 'team':
      return <><circle {...W} cx="8.5" cy="8" r="3" /><circle {...W} cx="15.5" cy="8" r="3" /><path {...W} d="M3 19c0-3.5 2.4-5.5 5.5-5.5S14 15.5 14 19zM10 19c0-3.5 2.4-5.5 5.5-5.5S21 15.5 21 19z" /></>;
    case 'globe':
      return <><circle {...W} cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" fill="none" stroke="#1d1430" strokeWidth="1.3" /></>;
    case 'map':
      return <><path {...W} d="M3 6.5 8.5 4.5l7 2 5.5-2v13l-5.5 2-7-2L3 19.5z" /><path d="M8.5 4.5v13M15.5 6.5v13" stroke="#1d1430" strokeWidth="1.3" /><circle cx="12" cy="11" r="1.8" fill="#e5413a" /></>;
    case 'rainbow':
      return <>
        <path d="M3 17a9 9 0 0 1 18 0" fill="none" stroke="#e5413a" strokeWidth="2.6" />
        <path d="M5.8 17a6.2 6.2 0 0 1 12.4 0" fill="none" stroke="#f2bf16" strokeWidth="2.6" />
        <path d="M8.6 17a3.4 3.4 0 0 1 6.8 0" fill="none" stroke="#26a556" strokeWidth="2.6" />
        <path d="M2 19h20" stroke="#2c79dc" strokeWidth="2.6" strokeLinecap="round" />
      </>;
    case 'marathon':
      return <><path {...W} d="M5 20V4.5l12 3.5-12 4" /><path {...L} d="M5 20h14" /><text x="16" y="18" textAnchor="middle" fontSize="6.5" fontWeight="900" fontFamily="var(--display), sans-serif" fill="#fff">100</text></>;
  }
}

/** An achievement's medal: the tier's rim, a ribbon, and its picture. Locked ones are grey. */
export function Badge({ glyph, tier, locked, size = 64 }: { glyph: BadgeGlyph; tier: BadgeTier; locked?: boolean; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const [hi, lo, ribbon] = TIER[tier];
  return (
    <svg viewBox="0 0 64 72" width={size} height={size * 1.125} aria-hidden className={`badge ${locked ? 'locked' : ''}`}>
      <defs>
        <linearGradient id={`r${uid}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={hi} /><stop offset="1" stopColor={lo} /></linearGradient>
        <radialGradient id={`d${uid}`} cx="40%" cy="30%" r="80%"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.6" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      {/* ribbon tails */}
      <path d="M20 50 14 70l8-4 5 6 5-18zM44 50l6 20-8-4-5 6-5-18z" fill={ribbon} stroke="#1d1430" strokeWidth="1.5" strokeLinejoin="round" />
      {/* rim and disc */}
      <circle cx="32" cy="30" r="27" fill={`url(#r${uid})`} stroke="#1d1430" strokeWidth="2" />
      <circle cx="32" cy="30" r="21" fill={DISC[glyph]} stroke="#1d1430" strokeWidth="1.5" />
      <circle cx="32" cy="30" r="21" fill={`url(#d${uid})`} />
      <g transform="translate(17 15) scale(1.25)">
        <Glyph g={glyph} />
      </g>
    </svg>
  );
}
