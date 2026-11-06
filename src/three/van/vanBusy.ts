/*
 * Whether a knock-out van is on screen (or about to be). The finale of a round that a knock-out ended waits for it,
 * so the podium and the results do not cover the van (ui/game/hooks/useFinale).
 */
let busy = false;
const listeners = new Set<() => void>();

export const vanBusy = {
  get: () => busy,
  set(next: boolean) {
    if (next === busy) return;
    busy = next;
    listeners.forEach(f => f());
  },
  subscribe(f: () => void) {
    listeners.add(f);
    return () => listeners.delete(f);
  },
};
