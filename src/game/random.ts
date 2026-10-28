/** A source of numbers in [0, 1), like Math.random. Tests pass a seeded one. */
export type Rng = () => number;

/** Shuffles `a` in place (Fisher–Yates) and returns it. */
export function shuffle<T>(a: T[], rng: Rng): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(a: readonly T[], rng: Rng): T {
  return a[Math.floor(rng() * a.length)];
}

export function randomIndex(length: number, rng: Rng): number {
  return Math.floor(rng() * length);
}
