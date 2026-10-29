import type { Card } from '../game/types';
import type { Params, StrKey } from './types';

/**
 * A message as data: a text key and its params. Params may be plain values or other messages
 * (a card name, a team, a dare), which are translated too. Sent over the network as is.
 */
export interface Msg {
  k: StrKey;
  p?: Params;
}

export const msg = (k: StrKey, p?: Params): Msg => (p ? { k, p } : { k });

/** "7 (red)", "+4" — in the reader's language. */
export const cardMsg = (c: Pick<Card, 'type' | 'value' | 'color'>): Msg => msg('cardName', { type: c.type, value: c.value, color: c.color });

export const isMsg = (v: unknown): v is Msg => !!v && typeof v === 'object' && typeof (v as Msg).k === 'string';

/** Every plain text param in a message, nested ones included (to look for a player's name in a log line). */
export function msgWords(m: Msg): string[] {
  const out: string[] = [];
  for (const v of Object.values(m.p ?? {})) {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) out.push(...v.filter((x): x is string => typeof x === 'string'));
    else if (isMsg(v)) out.push(...msgWords(v));
  }
  return out;
}
