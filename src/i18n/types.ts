import type { ruStrings } from './ru';

/**
 * Shared i18n types. The game engine and the server only use these (and `msg.ts`): they never pick a language.
 * Everything a player reads travels as a key + params and is turned into words on each screen, in that screen's language.
 */

export type Lang = 'ru' | 'en' | 'pl' | 'uk';
export const LANGS: readonly Lang[] = ['en', 'uk', 'ru', 'pl'];
export const isLang = (v: unknown): v is Lang => v === 'ru' || v === 'en' || v === 'pl' || v === 'uk';

/** Every text key. Russian is the reference: the other languages must have exactly the same keys. */
export type StrKey = keyof typeof ruStrings;

export type Params = Record<string, unknown>;
/** Translates another key in the same language (for entries built from other entries: a card's name and colour). */
export type Tr = (k: StrKey, p?: Params) => string;
/** A plain string with `{name}` placeholders, or a function for plurals, colour forms and the like. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Entry = string | ((p: any, t: Tr) => string);

export type Strings = Record<StrKey, Entry>;

export interface Pack {
  lang: Lang;
  s: Strings;
  /** fun bot names for this language */
  bots: readonly string[];
}
