/* The small pictures of the phone hints. */

/** a phone lying on its side */
export function PhoneSideIcon() {
  return (
    <svg viewBox="0 0 32 24" width="30" height="22" aria-hidden>
      <rect x="2" y="3" width="28" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2.2" />
      <rect x="6" y="6.5" width="20" height="11" rx="1.5" fill="currentColor" opacity="0.35" />
      <circle cx="28" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** the iPhone share button (for "Add to Home Screen") */
export function ShareIcon() {
  return (
    <svg className="share-ic" viewBox="0 0 24 24" width="15" height="15" aria-hidden>
      <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
