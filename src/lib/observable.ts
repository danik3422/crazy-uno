/**
 * A tiny observable for React's `useSyncExternalStore`:
 * components subscribe, read a version number, and re-render when it changes.
 */
export class Observable {
  private listeners = new Set<() => void>();
  protected version = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  getVersion = () => this.version;

  /** Mark the state as changed without telling anyone (the caller re-renders by other means). */
  protected bumpVersion() {
    this.version++;
  }

  /** Mark the state as changed and tell every subscriber. */
  protected emitChange() {
    this.version++;
    this.listeners.forEach(f => f());
  }
}
