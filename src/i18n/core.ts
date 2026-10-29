import { en } from './en';
import { isMsg, type Msg } from './msg';
import { pl } from './pl';
import { ru } from './ru';
import { isLang, type Lang, type Pack, type Params, type StrKey } from './types';

export type { Lang, StrKey } from './types';
export { LANGS } from './types';
export type { Msg } from './msg';

/**
 * A tiny i18n layer: three dictionaries with the same keys, the current language (saved, else the browser's),
 * `t()` for plain text, `render()` for messages that came from the game or the server, and a hook that re-renders.
 * Switching the language is local to this screen: other players keep theirs.
 */

export const PACKS: Record<Lang, Pack> = { ru, en, pl };

const STORAGE_KEY = 'crazy-uno-lang';

/** ru / uk / be → Russian, pl → Polish, anything else → English. */
export function langFrom(list: readonly string[]): Lang {
  for (const raw of list) {
    const l = raw.toLowerCase().split(/[-_]/)[0];
    if (l === 'ru' || l === 'uk' || l === 'be') return 'ru';
    if (l === 'pl') return 'pl';
    if (l === 'en') return 'en';
  }
  return 'en';
}

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    /* storage blocked */
  }
  if (typeof navigator !== 'undefined') return langFrom(navigator.languages?.length ? navigator.languages : [navigator.language ?? '']);
  return 'en';
}

let cur: Lang = initialLang();
const subs = new Set<() => void>();

export const lang = () => cur;

export function setLang(l: Lang) {
  if (l === cur) return;
  cur = l;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* the choice just won't survive a reload */
  }
  applyDocument();
  subs.forEach(f => f());
}

/** Called on every language change (outside React: card textures). */
export function onLangChange(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}

/** `<html lang>` and the tab title. */
export function applyDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = cur;
  document.title = t('app.title');
}

const resolve = (p: Params | undefined, l: Lang): Params | undefined => {
  if (!p) return p;
  const out: Params = {};
  for (const [k, v] of Object.entries(p)) out[k] = isMsg(v) ? render(v, l) : v;
  return out;
};

/** The text for `k` in language `l`. */
export function tr(l: Lang, k: StrKey, p?: Params): string {
  const e = PACKS[l].s[k] ?? PACKS.en.s[k];
  if (e === undefined) return k;
  const params = resolve(p, l);
  if (typeof e === 'function') return e(params ?? {}, (k2, p2) => tr(l, k2, p2));
  if (!params) return e;
  return e.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** The text for `k` in the current language. */
export function t(k: StrKey, p?: Params): string {
  return tr(cur, k, p);
}

/** A message from the game or the server, in language `l` (default: the current one). */
export function render(m: Msg | null | undefined, l: Lang = cur): string {
  return m ? tr(l, m.k, m.p) : '';
}

/** Fun bot names in the current language. */
export const botNames = () => PACKS[cur].bots;

