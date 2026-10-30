import { COLORS, EVENTS, NO_MERCY_TYPES, SPECIAL, WILD_TYPES } from '../../game/content';
import { buildDeck } from '../../game/deck';
import type { Card, CardType, EventId, Rules, ThemeId } from '../../game/types';
import { useEffect, useMemo } from 'react';
import { cardImage, warmCardImages } from '../../three/textures';
import { EventIcon } from './EventIcon';
import './Legend.css';

const ALL = Object.keys(SPECIAL) as Exclude<CardType, 'num'>[];
/** each card type always in the same colour, so its picture is painted once and reused by every mode */
const sample = (t: Exclude<CardType, 'num'>): Card => ({ id: 0, type: t, color: WILD_TYPES.includes(t) ? 'wild' : COLORS[ALL.indexOf(t) % 4] });

/** What every special card does, drawn in the table's style. With `rules`, only the cards that are in that deck. */
export function Legend({ rules, theme = 'classic' }: { rules?: Rules; theme?: ThemeId }) {
  const types = useMemo(() => {
    if (!rules) return ALL.filter(t => !NO_MERCY_TYPES.includes(t));
    const inDeck = new Set(buildDeck(rules).map(c => c.type));
    return ALL.filter(t => inDeck.has(t));
  }, [rules]);
  // the other modes' cards get painted in idle moments, so switching modes is instant
  useEffect(() => warmCardImages(ALL.map(t => ({ card: sample(t), theme, cssWidth: 44 }))), [theme]);
  return (
    <div className="legend">
      {types.map(t => {
        const card = sample(t);
        return (
          <div className="li" key={t}>
            <img src={cardImage(card, theme, 44)} alt="" width={44} height={66} />
            <div>
              <b>{SPECIAL[t].name}</b>
              <small>{SPECIAL[t].desc}</small>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** What every random event does, each with its drawn icon. */
export function EventLegend() {
  return (
    <div className="legend">
      {(Object.keys(EVENTS) as EventId[]).map(id => (
        <div className="li" key={id}>
          <EventIcon id={id} size={36} className="ev-icon" />
          <div>
            <b>{EVENTS[id].title}</b>
            <small>{EVENTS[id].desc}</small>
          </div>
        </div>
      ))}
    </div>
  );
}
