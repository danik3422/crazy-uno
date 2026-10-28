import { useLayoutEffect, useRef } from 'react';

/**
 * A letter that always fits its tile: after layout (and again once fonts load) it measures
 * the glyph and shrinks it if it is wider than the tile. Wide letters like W and M differ a lot between
 * browsers and fallback fonts, so CSS sizing alone is not enough.
 */
export function FitLetter({ ch, room = 0.72 }: { ch: string; room?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const box = el.parentElement;
      if (!box) return;
      el.style.transform = '';
      const w = el.getBoundingClientRect().width;
      const max = box.clientWidth * room;
      if (w > max && w > 0) el.style.transform = `scale(${max / w})`;
    };
    fit();
    document.fonts?.ready.then(fit).catch(() => {});
    const ro = new ResizeObserver(fit);
    if (el.parentElement) ro.observe(el.parentElement);
    return () => ro.disconnect();
  }, [ch, room]);
  return <span ref={ref} className="fit-letter">{ch}</span>;
}
