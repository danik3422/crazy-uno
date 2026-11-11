/** The player asked the system for less motion (vestibular disorders, motion sickness). Checked each time: it can change. */
export function reducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
