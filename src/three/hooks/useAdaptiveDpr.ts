import { useCallback, useEffect, useRef, useState } from 'react';

/** above 2×, at most this many pixels drawn per frame (a phone at 3× fits) */
const MAX_PIXELS = 4.7e6;
/** a struggling device never drops below this many pixels (a phone stays sharp at about 2×) */
const MIN_PIXELS = 1.3e6;
/**
 * …and never below this share of the screen's own density: under about 3/4 of it the card corners and numbers
 * go soft (a 2× laptop stays at 1.5× or more, a 3× phone at 2.25×).
 */
const MIN_SHARE = 0.75;
/** one step down or up: small enough that a step is hard to see, big enough to matter */
const STEP = 0.85;
/**
 * After drei's PerformanceMonitor gives up (it flip-flopped too often) it stops watching for good. A long game must
 * not stay blurry because of one heavy effect, so the watch starts afresh after this long.
 */
const REWATCH_MS = 20000;

function limits() {
  if (typeof window === 'undefined') return { max: 1, min: 1 };
  const area = Math.max(1, window.innerWidth * window.innerHeight);
  const device = window.devicePixelRatio || 1;
  // phones are small, so they can afford their full 3× screen; a big monitor stays near 1×–2×
  const max = Math.min(device, Math.max(2, Math.min(3, Math.sqrt(MAX_PIXELS / area))));
  const min = Math.min(max, Math.max(1, device * MIN_SHARE, Math.min(2, Math.sqrt(MIN_PIXELS / area))));
  return { max, min };
}

/** dpr changes reallocate the canvas: only ever set values on a coarse grid, so tiny moves don't happen at all */
const snap = (d: number) => Math.round(d * 20) / 20;

/**
 * Render resolution, from the screen's own pixel density and size.
 * A struggling device steps down a notch at a time (see drei's PerformanceMonitor) and goes back up when it can,
 * but never below the sharpness floor (see limits). `monitorKey` changes when the watch should start afresh:
 * pass it as the PerformanceMonitor's key, so a fallback (it gave up) can never stick for the rest of the game.
 */
export function useAdaptiveDpr() {
  const [lim, setLim] = useState(limits);
  const [dpr, setDpr] = useState(lim.max);
  const [monitorKey, setMonitorKey] = useState(0);
  const limRef = useRef(lim);
  limRef.current = lim;
  const rewatch = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const upd = () => {
      const n = limits();
      setLim(n);
      setDpr(d => snap(Math.min(n.max, Math.max(n.min, d))));
    };
    window.addEventListener('resize', upd);
    return () => {
      window.removeEventListener('resize', upd);
      if (rewatch.current) clearTimeout(rewatch.current);
    };
  }, []);
  const lower = useCallback(() => setDpr(d => snap(Math.max(limRef.current.min, d * STEP))), []);
  const raise = useCallback(() => setDpr(d => snap(Math.min(limRef.current.max, d / STEP))), []);
  const fallback = useCallback(() => {
    // it flip-flopped: settle halfway between floor and ceiling (not at the floor), then try again later
    const { min, max } = limRef.current;
    setDpr(snap((min + max) / 2));
    if (rewatch.current) clearTimeout(rewatch.current);
    rewatch.current = setTimeout(() => {
      rewatch.current = null;
      setMonitorKey(k => k + 1);
    }, REWATCH_MS);
  }, []);
  return { dpr, monitorKey, lower, raise, fallback };
}
