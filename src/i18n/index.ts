import { useSyncExternalStore } from 'react';
import { lang, onLangChange, t, type Lang } from './core';

export * from './core';

const subscribe = (f: () => void) => onLangChange(f);

/** The current language; the component re-renders when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, lang, lang);
}

/** `t` bound to the current language; the component re-renders when it changes. */
export function useT() {
  useLang();
  return t;
}
