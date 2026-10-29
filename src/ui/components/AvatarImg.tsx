import { type Avatar, avatarOf, HUMAN_AVATARS, robotDataUrl } from '../../game/avatars';
import { useT } from '../../i18n';
import './AvatarImg.css';

interface Props {
  id?: string;
  name: string;
  bot: boolean;
  size?: number;
  className?: string;
}

export function AvatarImg({ id, name, bot, size = 64, className = '' }: Props) {
  return <AvatarTile a={avatarOf(id, name, bot)} size={size} className={className} />;
}

export function AvatarTile({ a, size = 64, className = '' }: { a: Avatar; size?: number; className?: string }) {
  return (
    <span
      className={`avatar ${className}`}
      style={{ width: size, height: size, background: `linear-gradient(145deg, ${a.bg[0]}, ${a.bg[1]})` }}
      role="img"
      aria-label={a.label}
    >
      {a.robot ? (
        <img src={robotDataUrl(a.robot)} alt="" draggable={false} />
      ) : (
        <span className="avatar-emoji" style={{ fontSize: size * 0.62 }}>{a.emoji}</span>
      )}
    </span>
  );
}

/** Grid of avatars to choose from (only the people ones; robots are reserved for bots). */
export function AvatarPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  return (
    <div className="avatar-grid" role="radiogroup" aria-label={t('avatarPick')}>
      {HUMAN_AVATARS.map(a => (
        <button
          key={a.id}
          type="button"
          role="radio"
          aria-checked={value === a.id}
          className={`avatar-pick ${value === a.id ? 'on' : ''}`}
          onClick={() => onChange(a.id)}
          title={a.label}
        >
          <AvatarTile a={a} size={46} />
        </button>
      ))}
    </div>
  );
}
