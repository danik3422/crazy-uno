import { useEffect, useState } from 'react';

/** above 2×, at most this many pixels drawn per frame (a phone at 3× fits) */
const MAX_PIXELS = 4.7e6;
/** a struggling device never drops below this many pixels (a phone stays sharp at about 2×) */
const MIN_PIXELS = 1.3e6;

function limits() {
  if (typeof window === 'undefined') return { max: 1, min: 1 };
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const device = window.devicePixelRatio || 1;
  // phones are small, so they can afford their full 3× screen; a big monitor stays near 1×–2×
  const max = Math.min(device, Math.max(2, Math.min(3, Math.sqrt(MAX_PIXELS / area))));
  const min = Math.max(1, Math.min(max, 2, Math.sqrt(MIN_PIXELS / area)));
  return { max, min };
}

/**
 * Render resolution, from the screen's own pixel density and size.
 * A struggling device steps down a notch at a time (see drei's PerformanceMonitor) and goes back up when it can,
 * but never below about 2× on a phone: under that the cards turn blurry.
 */
export function useAdaptiveDpr() {
  const [lim, setLim] = useState(limits);
  const [dpr, setDpr] = useState(lim.max);
  useEffect(() => {
    const upd = () => {
      const n = limits();
      setLim(n);
      setDpr(d => Math.min(n.max, Math.max(n.min, d)));
    };
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, []);
  return {
    dpr,
    lower: () => setDpr(d => Math.max(lim.min, d * 0.8)),
    raise: () => setDpr(d => Math.min(lim.max, d * 1.25)),
    fallback: () => setDpr(lim.min),
  };
}
