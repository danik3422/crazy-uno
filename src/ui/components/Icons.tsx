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
export const IconGear = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
    <path d="M12.00 4.40 L13.99 2.00 L15.90 2.58 L16.22 5.68 L17.37 6.63 L20.48 6.33 L21.42 8.10 L19.45 10.52 L19.60 12.00 L22.00 13.99 L21.42 15.90 L18.32 16.22 L17.37 17.37 L17.67 20.48 L15.90 21.42 L13.48 19.45 L12.00 19.60 L10.01 22.00 L8.10 21.42 L7.78 18.32 L6.63 17.37 L3.52 17.67 L2.58 15.90 L4.55 13.48 L4.40 12.00 L2.00 10.01 L2.58 8.10 L5.68 7.78 L6.63 6.63 L6.33 3.52 L8.10 2.58 L10.52 4.55Z M12 8.6a3.4 3.4 0 1 0 0 6.8a3.4 3.4 0 1 0 0-6.8Z" fill="currentColor" fillRule="evenodd" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);
