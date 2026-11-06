import { type ComponentType, lazy } from 'react';

/**
 * React.lazy for a part of the game loaded on demand. After an update the old file may be gone from the server;
 * the page then reloads once to pick up the new version instead of breaking.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the same bound React.lazy itself uses
export function lazyFile<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(() =>
    load().catch(err => {
      const key = 'crazy-uno-reloaded';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        location.reload();
        return new Promise<{ default: T }>(() => undefined);
      }
      throw err;
    }).then(m => {
      sessionStorage.removeItem('crazy-uno-reloaded');
      return m;
    }),
  );
}
