import { COLORS, EVENTS, NO_MERCY_TYPES, SPECIAL, WILD_TYPES } from '../../game/content';
import { buildDeck } from '../../game/deck';
import type { Card, CardType, EventId, Rules, ThemeId } from '../../game/types';
import { cardImage } from '../../three/textures';
import { EventIcon } from './EventIcon';
import './Legend.css';

const ALL = Object.keys(SPECIAL) as Exclude<CardType, 'num'>[];

/** What every special card does, drawn in the table's style. With `rules`, only the cards that are in that deck. */
export function Legend({ rules, theme = 'classic' }: { rules?: Rules; theme?: ThemeId }) {
  const types = rules ? ALL.filter(t => buildDeck(rules).some(c => c.type === t)) : ALL.filter(t => !NO_MERCY_TYPES.includes(t));
  return (
    <div className="legend">
      {types.map((t, i) => {
        const card: Card = { id: i, type: t, color: WILD_TYPES.includes(t) ? 'wild' : COLORS[i % 4] };
        return (
          <div className="li" key={t}>
            <img src={cardImage(card, theme)} alt="" width={44} height={66} />
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
