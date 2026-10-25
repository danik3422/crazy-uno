/** Small line icons for the game's buttons (all 24×24, drawn with currentColor). */
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const IconMusic = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path {...P} d="M9 18V6l10-2v12" /><circle {...P} cx="6.5" cy="18" r="2.5" /><circle {...P} cx="16.5" cy="16" r="2.5" /></svg>
);
export const IconSound = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path {...P} d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path {...P} d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></svg>
);
export const IconMute = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path {...P} d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" /><path {...P} d="M16 9.5l5 5M21 9.5l-5 5" /></svg>
);
export const IconCards = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <rect {...P} x="9" y="3.5" width="10" height="14" rx="2" transform="rotate(10 14 10.5)" />
    <rect {...P} x="5" y="6.5" width="10" height="14" rx="2" transform="rotate(-8 10 13.5)" />
  </svg>
);
export const IconMenu = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden><path {...P} d="M5 7h14M5 12h14M5 17h14" /></svg>
);
/** A tiny stack of card backs, for card counters. */
export const IconStack = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
    <rect x="5" y="1.5" width="8.5" height="11" rx="1.6" fill="currentColor" opacity="0.45" />
    <rect x="2.5" y="3.5" width="8.5" height="11" rx="1.6" fill="currentColor" />
  </svg>
);
