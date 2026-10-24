import { COLORS, SPECIAL } from '../game/content';
import type { Card, CardType } from '../game/types';
import { cardImage } from '../three/textures';

const TYPES = Object.keys(SPECIAL) as Exclude<CardType, 'num'>[];
const WILDS = ['wild', 'wild4', 'chaos', 'dump'];

export function Legend() {
  return (
    <div className="legend">
      {TYPES.map((t, i) => {
        const card: Card = { id: i, type: t, color: WILDS.includes(t) ? 'wild' : COLORS[i % 4] };
        return (
          <div className="li" key={t}>
            <img src={cardImage(card)} alt="" width={44} height={66} />
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
