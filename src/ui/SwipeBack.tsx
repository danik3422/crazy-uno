import { useEffect, useRef } from 'react';
import { isStandalone } from './phone';

/** how far from the left edge a swipe has to start, and how far it has to go */
const EDGE = 28;
const GO = 90;

/**
 * Swipe in from the left edge to go back, like a native iPhone app. Only in the home-screen app:
 * in Safari the browser already has its own edge swipe, and two would fight.
 * A round arrow follows the finger and fills up once letting go would go back.
 */
export function SwipeBack({ onBack }: { onBack: () => void }) {
  const knob = useRef<HTMLDivElement>(null);
  const backRef = useRef(onBack);
  backRef.current = onBack;

  useEffect(() => {
    if (!isStandalone()) return;
    let start: { x: number; y: number } | null = null;
    let dx = 0;
    let live = false;
    const show = (d: number) => {
      const el = knob.current;
      if (!el) return;
      const k = Math.min(1, d / GO);
      el.style.opacity = String(Math.min(1, d / 30));
      el.style.transform = `translate(${Math.min(d, GO + 20) * 0.6 - 30}px, -50%) scale(${0.7 + k * 0.3})`;
      el.classList.toggle('ready', d >= GO);
    };
    const hide = () => {
      const el = knob.current;
      if (!el) return;
      el.style.opacity = '0';
      el.style.transform = 'translate(-30px, -50%) scale(0.7)';
      el.classList.remove('ready');
    };
    const down = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length !== 1 || t.clientX > EDGE) return;
      start = { x: t.clientX, y: t.clientY };
      dx = 0;
      live = false;
      if (knob.current) knob.current.style.top = `${t.clientY}px`;
    };
    const move = (e: TouchEvent) => {
      if (!start) return;
      const t = e.touches[0];
      dx = t.clientX - start.x;
      const dy = Math.abs(t.clientY - start.y);
      // a mostly vertical move is a scroll, not a swipe back
      if (!live && dy > 14 && dy > dx) {
        start = null;
        hide();
        return;
      }
      if (dx > 8) live = true;
      if (live) {
        e.preventDefault();
        show(Math.max(0, dx));
      }
    };
    const up = () => {
      if (start && live && dx >= GO) {
        navigator.vibrate?.(8);
        backRef.current();
      }
      start = null;
      live = false;
      hide();
    };
    window.addEventListener('touchstart', down, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    window.addEventListener('touchcancel', up);
    return () => {
      window.removeEventListener('touchstart', down);
      window.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', up);
      window.removeEventListener('touchcancel', up);
    };
  }, []);

  return (
    <div ref={knob} className="swipe-back" aria-hidden>
      <svg viewBox="0 0 24 24" width="22" height="22">
        <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
