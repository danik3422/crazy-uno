/*
 * Touch hit testing for your hand, as plain numbers (screen x in CSS pixels), so it can be tested on its own.
 * A finger picks a card by where it is along the hand, not by the sliver of the card that happens to show.
 */

/** the narrowest strip of screen a card gets under the finger (CSS pixels): about a fingertip's width */
export const MIN_SLOT = 28;

/**
 * The strips of screen (left to right) that pick each card of one row of the hand.
 * `natural` are the n + 1 edges of what shows of each card (its left edge up to the next card's left edge, the last
 * card whole). Every strip is at least `minW` wide: narrow ones grow, wide ones (a raised card, the last card) give
 * some of their width back, and the row spreads past the hand when it has to, kept within `lo`..`hi`.
 * Returns the n + 1 edges of the strips.
 */
export function slotEdges(natural: number[], minW: number, lo: number, hi: number): number[] {
  const n = natural.length - 1;
  if (n <= 0) return natural.slice();
  const nat = Array.from({ length: n }, (_, i) => Math.max(0, natural[i + 1] - natural[i]));
  const span = natural[n] - natural[0];
  const avail = Math.max(1, hi - lo);
  // a hand so big that even the whole screen has no fingertip per card: the screen, shared equally
  const m = Math.min(minW, avail / n);
  const total = Math.min(avail, Math.max(span, n * m));
  // widths max(m, nat * k): find the k that adds up to the total (the sum grows with k)
  const sum = (k: number) => nat.reduce((a, w) => a + Math.max(m, w * k), 0);
  let k = 1;
  if (n * m >= total) k = 0;
  else {
    let a = 0;
    let b = 1;
    while (sum(b) < total && b < 1e6) b *= 2;
    for (let i = 0; i < 48; i++) {
      const mid = (a + b) / 2;
      if (sum(mid) < total) a = mid;
      else b = mid;
    }
    k = b;
  }
  const widths = nat.map(w => Math.max(m, w * k));
  const got = widths.reduce((a, w) => a + w, 0) || 1;
  // centred on the hand, slid back on screen if it would leave it
  const mid = (natural[0] + natural[n]) / 2;
  let x = Math.min(Math.max(mid - total / 2, lo), hi - total);
  const edges = [x];
  for (const w of widths) {
    x += (w * total) / got;
    edges.push(x);
  }
  return edges;
}

/**
 * Which strip the finger is in. The one already picked keeps the finger a little past its edges (a quarter of its
 * width, at most `hyst` pixels), so a finger resting on the line between two cards does not flicker between them.
 */
export function pickSlot(edges: number[], x: number, cur: number | null, hyst = 6): number {
  const n = edges.length - 1;
  if (n <= 0) return -1;
  if (cur !== null && cur >= 0 && cur < n) {
    const h = Math.min(hyst, (edges[cur + 1] - edges[cur]) * 0.25);
    if (x >= edges[cur] - h && x < edges[cur + 1] + h) return cur;
  }
  for (let i = 0; i < n; i++) if (x < edges[i + 1]) return i;
  return n - 1;
}
