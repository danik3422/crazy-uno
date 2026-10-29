import type { Lang } from './types';

const rules = new Map<Lang, Intl.PluralRules>();

/**
 * Picks the plural form for `n`: `forms` by CLDR category (one, few, many, other).
 * Russian and Polish use one / few / many; English one / other. A missing category falls back to `other`, then `many`.
 */
export function plural(lang: Lang, n: number, forms: { one: string; few?: string; many?: string; other?: string }): string {
  let r = rules.get(lang);
  if (!r) rules.set(lang, (r = new Intl.PluralRules(lang)));
  const cat = r.select(n) as keyof typeof forms;
  return forms[cat] ?? forms.other ?? forms.many ?? forms.one;
}

/** Joins names: "Ann, Bob and Cid". */
export function list(items: readonly string[], and: string): string {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
