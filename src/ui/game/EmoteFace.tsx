import { useId } from 'react';
import { HEX } from '../../game/content';
import type { EmoteId } from '../../game/reactions';

const INK = '#1d1430';

/** Each reaction is a tiny UNO card of its own colour; the party one is the four-colour wild. */
const CARD: Record<EmoteId, string> = {
  laugh: HEX.yellow, love: HEX.red, cool: HEX.blue, wow: HEX.green,
  angry: HEX.red, cry: HEX.blue, think: HEX.green, party: 'wild',
};

/** A small heart centred at (x, y), `s` wide. */
const heart = (x: number, y: number, s: number) => {
  const k = s / 20;
  return `M${x} ${y + 7 * k} C${x - 12 * k} ${y - 1 * k} ${x - 9 * k} ${y - 10 * k} ${x - 4 * k} ${y - 9 * k} C${x - 1.5 * k} ${y - 8.5 * k} ${x} ${y - 6 * k} ${x} ${y - 5 * k} C${x} ${y - 6 * k} ${x + 1.5 * k} ${y - 8.5 * k} ${x + 4 * k} ${y - 9 * k} C${x + 9 * k} ${y - 10 * k} ${x + 12 * k} ${y - 1 * k} ${x} ${y + 7 * k}Z`;
};

/**
 * The quick-reaction pictures, in the game's own look: a little card with the white tilted oval of an UNO face,
 * and a face drawn in a few ink lines inside it.
 */
export function EmoteFace({ id, size = 40 }: { id: EmoteId; size?: number }) {
  const uid = useId().replace(/:/g, '');
  const color = CARD[id];
  const ink = { fill: 'none', stroke: INK, strokeWidth: 3.6, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  // the mouth is filled with the card's colour, so every face matches its card
  const mouth = color === 'wild' ? HEX.red : color;
  return (
    <svg viewBox="0 0 80 100" width={size * 0.8} height={size} aria-hidden className="emote-face">
      <defs>
        <clipPath id={`c${uid}`}><rect x="3" y="3" width="74" height="94" rx="11" /></clipPath>
        <linearGradient id={`g${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* the card: white edge, coloured face */}
      <rect x="1" y="1" width="78" height="98" rx="13" fill="#fffdf6" />
      <g clipPath={`url(#c${uid})`}>
        {color === 'wild' ? (
          <>
            <rect x="0" y="0" width="40" height="50" fill={HEX.red} />
            <rect x="40" y="0" width="40" height="50" fill={HEX.blue} />
            <rect x="0" y="50" width="40" height="50" fill={HEX.yellow} />
            <rect x="40" y="50" width="40" height="50" fill={HEX.green} />
          </>
        ) : (
          <rect x="0" y="0" width="80" height="100" fill={color} />
        )}
        <rect x="0" y="0" width="80" height="100" fill={`url(#g${uid})`} />
      </g>
      {/* the white oval, tilted like on every UNO card */}
      <ellipse cx="40" cy="50" rx="27" ry="41" transform="rotate(28 40 50)" fill="#fffdf6" />

      {id === 'laugh' && (
        <>
          <path {...ink} d="M25 42 Q30 35 35 42 M45 42 Q50 35 55 42" />
          <path d="M26 52 H54 Q53 70 40 70 Q27 70 26 52Z" fill={mouth} stroke={INK} strokeWidth="3.6" strokeLinejoin="round" />
          <path {...ink} strokeWidth={2.6} d="M60 30 l5 -4 M62 37 l6 -1 M20 30 l-5 -4 M18 37 l-6 -1" />
        </>
      )}
      {id === 'love' && (
        <>
          <path d={heart(30, 42, 15)} fill={HEX.red} stroke={INK} strokeWidth="2.6" />
          <path d={heart(50, 42, 15)} fill={HEX.red} stroke={INK} strokeWidth="2.6" />
          <path {...ink} d="M29 57 Q40 68 51 57" />
        </>
      )}
      {id === 'cool' && (
        <>
          <path d="M19 38 H61 L59 42 Q58 50 50 50 Q43 50 42 43 H38 Q37 50 30 50 Q22 50 21 42Z" fill={INK} />
          <path d="M25 41 h5 M46 41 h5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.8" />
          <path {...ink} d="M31 61 Q42 66 51 57" />
        </>
      )}
      {id === 'wow' && (
        <>
          <path {...ink} strokeWidth={3} d="M24 32 Q29 28 34 31 M46 31 Q51 28 56 32" />
          <circle cx="30" cy="42" r="4.2" fill={INK} />
          <circle cx="50" cy="42" r="4.2" fill={INK} />
          <ellipse cx="40" cy="60" rx="6" ry="8" fill={mouth} stroke={INK} strokeWidth="3.6" />
        </>
      )}
      {id === 'angry' && (
        <>
          <path {...ink} strokeWidth={4.2} d="M23 33 L35 39 M57 33 L45 39" />
          <circle cx="31" cy="45" r="3.6" fill={INK} />
          <circle cx="49" cy="45" r="3.6" fill={INK} />
          <path {...ink} d="M29 64 Q40 55 51 64" />
          <path d="M58 18 l4 6 l4 -6 l4 6" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {id === 'cry' && (
        <>
          <path {...ink} d="M24 43 Q30 47 35 43 M45 43 Q50 47 56 43" />
          <path d="M28 48 Q25 56 28 60 Q32 56 29 48Z M52 48 Q55 56 52 60 Q48 56 51 48Z" fill="#7cc8ff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
          <path {...ink} d="M32 66 Q40 59 48 66" />
        </>
      )}
      {id === 'think' && (
        <>
          <path {...ink} strokeWidth={3} d="M24 33 Q29 28 35 33 M45 36 L56 35" />
          <circle cx="30" cy="43" r="3.6" fill={INK} />
          <circle cx="50" cy="44" r="3.6" fill={INK} />
          <path {...ink} d="M31 61 q4 -3 8 0 t8 0" />
          <text x="62" y="25" textAnchor="middle" fontFamily="var(--display), sans-serif" fontWeight="900" fontSize="20" fill="#fff" stroke={INK} strokeWidth="1.2">?</text>
        </>
      )}
      {id === 'party' && (
        <>
          <path {...ink} d="M25 43 Q30 36 35 43 M45 43 Q50 36 55 43" />
          <path d="M26 52 H54 Q53 70 40 70 Q27 70 26 52Z" fill={HEX.yellow} stroke={INK} strokeWidth="3.6" strokeLinejoin="round" />
          <circle cx="16" cy="18" r="3" fill="#fff" />
          <circle cx="66" cy="84" r="3" fill="#fff" />
          <path d="M60 14 l6 2 M12 82 l6 -2" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}
