/** Which partner's hand is open in the big view (null: none). The partner's plate on the 3D table opens it. */
let seat: number | null = null;
const subs = new Set<() => void>();
export const peek = {
  get: () => seat,
  open(i: number | null) {
    seat = i;
    subs.forEach(f => f());
  },
  subscribe(f: () => void) {
    subs.add(f);
    return () => { subs.delete(f); };
  },
};
