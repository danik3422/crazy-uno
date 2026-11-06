import { useEffect, useRef, useState } from 'react';

/** Gap kept between the log and an opponent's plate (px). */
const MARGIN = 6;

/**
 * How many lines of the game log fit before it would run into an opponent's name plate.
 * A crowded table on a short screen puts the plates of the left-hand seats right under the log:
 * then only the newest lines that fit are shown (none at all if the first one would already cover a plate).
 * Measured on the laid-out lines (hidden ones keep their place), a few times a second.
 */
export function useLogRoom(lines: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState(lines);
  useEffect(() => {
    const check = () => {
      const box = ref.current;
      if (!box || !box.children.length) return;
      const b = box.getBoundingClientRect();
      if (!b.width) return; // the log is hidden on this screen anyway
      const plates = [...document.querySelectorAll('.oplate')].map(e => e.getBoundingClientRect());
      // the line slots from the top down
      const slots = [...box.children].map(e => e.getBoundingClientRect()).sort((p, q) => p.top - q.top);
      let k = 0;
      for (const r of slots) {
        const top = k === 0 ? b.top : r.top;
        const hit = plates.some(p => p.left < b.right + MARGIN && p.right > b.left - MARGIN && p.top < r.bottom + MARGIN && p.bottom > top - MARGIN);
        if (hit) break;
        k++;
      }
      setRoom(k);
    };
    check();
    const id = setInterval(check, 400);
    window.addEventListener('resize', check);
    return () => {
      clearInterval(id);
      window.removeEventListener('resize', check);
    };
  }, []);
  return { ref, room: Math.min(room, lines) };
}
