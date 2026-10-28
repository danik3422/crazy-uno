import { useState } from 'react';

/**
 * Render resolution: up to 2× the CSS pixels (phones are 2–3×).
 * A struggling device steps down 2 → 1.5 → 1.25 and goes back up when it can (see drei's PerformanceMonitor).
 */
export function useAdaptiveDpr() {
  const maxDpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const [dpr, setDpr] = useState(maxDpr);
  return {
    dpr,
    lower: () => setDpr(d => (d > 1.5 ? 1.5 : 1.25)),
    raise: () => setDpr(d => Math.min(maxDpr, d < 1.5 ? 1.5 : 2)),
    fallback: () => setDpr(1.25),
  };
}
