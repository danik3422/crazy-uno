import { useEffect, useRef } from 'react';
import './TurnTimer.css';

interface Props {
  /** server time (ms) when the turn runs out */
  deadline: number;
  total: number;
  /** server clock minus local clock */
  offset: number;
}

/**
 * The turn clock: a small pill over the avatar with the seconds left, its fill draining
 * green → yellow → red, pulsing for the last five seconds.
 * Animated with requestAnimationFrame straight on the DOM, no React re-renders.
 */
export function TurnTimer({ deadline, total, offset }: Props) {
  const root = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let raf = 0;
    let shown = -1;
    const loop = () => {
      const left = Math.max(0, deadline - (Date.now() + offset));
      const frac = Math.min(1, left / total);
      const color = left < 5000 ? 'red' : left < 12000 ? 'yellow' : 'green';
      if (fill.current) fill.current.style.transform = `scaleX(${frac})`;
      if (root.current) root.current.dataset.c = color;
      const n = Math.ceil(left / 1000);
      if (num.current && n !== shown) {
        shown = n;
        num.current.textContent = String(n);
      }
      if (left > 0) raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [deadline, total, offset]);
  return (
    <span ref={root} className="turn-timer" data-c="green" aria-hidden>
      <span ref={fill} className="turn-timer-fill" />
      <svg viewBox="0 0 24 24" className="turn-timer-ico"><circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" strokeWidth="2.6" /><path d="M12 9v4.5l2.5 1.5M9.5 2.5h5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" /></svg>
      <span ref={num} className="turn-timer-num" />
    </span>
  );
}
