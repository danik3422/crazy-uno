import type React from 'react';
import { useT } from '../../i18n';
/** The two sides of the fate coin, embossed in gold: an eagle, and the game's own logo instead of a currency sign. */

const DEEP = '#7a5200';
const LIGHT = '#fff3c4';

/** Raised look: a light edge up-left and a dark edge down-right around the same shape. */
function Embossed({ children }: { children: React.ReactNode }) {
  return (
    <>
      <g transform="translate(-1.2 -1.2)" fill={LIGHT} opacity="0.7">{children}</g>
      <g transform="translate(1.4 1.6)" fill="#5a3a00" opacity="0.55">{children}</g>
      <g fill={DEEP}>{children}</g>
    </>
  );
}

function Rim({ side }: { side: 'heads' | 'tails' }) {
  const t = useT();
  const text = t(side === 'heads' ? 'coin.headsRim' : 'coin.tailsRim');
  return (
    <>
      <circle cx="60" cy="60" r="52" fill="none" stroke={DEEP} strokeWidth="1.6" strokeDasharray="1.5 3.2" opacity="0.6" />
      <path id={`arc-${side}`} d="M 22 60 A 38 38 0 0 0 98 60" fill="none" />
      <text fontFamily="Unbounded, 'Arial Black', sans-serif" fontWeight="900" fontSize="9.5" letterSpacing="2.4" fill={DEEP} opacity="0.85">
        <textPath href={`#arc-${side}`} startOffset="50%" textAnchor="middle">{text}</textPath>
      </text>
    </>
  );
}

export function CoinHeads() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
      <Rim side="heads" />
      <Embossed>
        {/* left wing raised, with feather tips */}
        <path d="M56 54 C48 44 40 34 30 26 L34 34 L26 30 L31 39 L22 37 L29 45 L21 46 L30 51 L24 55 C34 57 44 58 54 60 Z" />
        {/* right wing */}
        <path d="M64 54 C72 44 80 34 90 26 L86 34 L94 30 L89 39 L98 37 L91 45 L99 46 L90 51 L96 55 C86 57 76 58 66 60 Z" />
        {/* body */}
        <path d="M60 46 C67 46 69 54 67 64 C66 70 63 74 60 76 C57 74 54 70 53 64 C51 54 53 46 60 46 Z" />
        {/* head in profile with a hooked beak, looking right */}
        <path d="M55 44 C55 37 60 34 65 36 C68 37 70 39 72 41 C70 41 69 42 69 44 C67 43 65 44 63 46 C60 47 56 47 55 44 Z" />
        {/* fanned tail and talons */}
        <path d="M55 74 L52 86 L57 82 L60 88 L63 82 L68 86 L65 74 Z" />
        <path d="M54 70 L49 74 L52 75 Z M66 70 L71 74 L68 75 Z" />
      </Embossed>
      <circle cx="64.5" cy="39.6" r="1.2" fill={LIGHT} />
    </svg>
  );
}

export function CoinTails() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden>
      <Rim side="tails" />
      <g transform="translate(60 56) rotate(-12)">
        <Embossed>
          <ellipse cx="0" cy="0" rx="34" ry="20" fill="none" stroke={DEEP} strokeWidth="5" />
        </Embossed>
        <g fontFamily="Unbounded, 'Arial Black', sans-serif" fontWeight="900" fontSize="22" textAnchor="middle">
          <text x="-1.2" y="6.8" fill={LIGHT} opacity="0.7">UNO</text>
          <text x="1.4" y="9.6" fill="#5a3a00" opacity="0.55">UNO</text>
          <text x="0" y="8" fill={DEEP}>UNO</text>
        </g>
      </g>
      {/* two little stars, like the marks on a real coin */}
      <path d="M38 84 l2 4 4 .5 -3 2.8 .8 4.2 -3.8 -2 -3.8 2 .8 -4.2 -3 -2.8 4 -.5z" fill={DEEP} opacity="0.75" transform="translate(4 -8) scale(.8)" />
      <path d="M78 84 l2 4 4 .5 -3 2.8 .8 4.2 -3.8 -2 -3.8 2 .8 -4.2 -3 -2.8 4 -.5z" fill={DEEP} opacity="0.75" transform="translate(20 -8) scale(.8)" />
    </svg>
  );
}
