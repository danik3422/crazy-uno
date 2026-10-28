import { useEffect, useRef } from 'react';

interface Props {
  /** server time (ms) when the turn runs out */
  deadline: number;
  total: number;
  /** server clock minus local clock */
  offset: number;
}

/**
 * A ring around the avatar that drains as the turn clock runs down:
 * green, then yellow, red and pulsing in the last five seconds.
 * Animated with requestAnimationFrame straight on the SVG, no React re-renders.
 */
export function TurnRing({ deadline, total, offset }: Props) {
  const arc = useRef<SVGCircleElement>(null);
  const root = useRef<SVGSVGElement>(null);
  const C = 2 * Math.PI * 46;
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const left = Math.max(0, deadline - (Date.now() + offset));
      const frac = Math.min(1, left / total);
      const el = arc.current;
      if (el) {
        el.style.strokeDashoffset = String(C * (1 - frac));
        el.style.stroke = left < 5000 ? '#ff4a3a' : left < 12000 ? '#ffc61a' : '#3fe07a';
      }
      root.current?.classList.toggle('hurry', left < 5000);
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [deadline, total, offset, C]);
  return (
    <svg ref={root} className="turn-ring" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r="46" className="turn-ring-bg" />
      <circle ref={arc} cx="50" cy="50" r="46" className="turn-ring-arc" strokeDasharray={C} />
    </svg>
  );
}
