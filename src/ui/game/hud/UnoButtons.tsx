import type { GameView } from '../../../game/view';
import { useT } from '../../../i18n';
import { AvatarImg } from '../../components/AvatarImg';

/**
 * The round "UNO!" badge in the game's logo style: an oval with big letters, rings rippling out
 * and a short line under it. `wide`: a longer word ("Caught!") gets a wider oval.
 */
function UnoBadge({ wide, word, caption, label, onClick, avatar }: {
  wide?: boolean;
  word: string;
  caption: string;
  label: string;
  onClick: () => void;
  /** a little portrait stuck to the oval (whoever is being caught) */
  avatar?: { id?: string; name: string; bot: boolean };
}) {
  return (
    <button className={`uno-call ${wide ? 'wide' : ''}`} onClick={onClick} aria-label={label}>
      <span className="uno-rings" aria-hidden><i /><i /></span>
      <span className="uno-oval" aria-hidden>
        <span className="uno-word">{word}</span>
      </span>
      {avatar && (
        <span className="uno-who" aria-hidden>
          <AvatarImg id={avatar.id} name={avatar.name} bot={avatar.bot} size={44} />
        </span>
      )}
      <span className="uno-cap" aria-hidden>{caption}</span>
    </button>
  );
}

/** Two cards left: a big "UNO!" floats above the dock until it is pressed, then it goes (the table shows the shout). */
export function UnoCall({ onCall }: { onCall: () => void }) {
  const t = useT();
  return (
    <div className="uno-call-zone">
      <UnoBadge word="UNO!" caption={t('hud.unoCap')} label={t('hud.unoAria')} onClick={onCall} />
    </div>
  );
}

/**
 * Someone is down to one card and nobody heard "UNO!":
 * everyone else gets a big "Caught you!" over the table, the one caught gets one last chance to shout it.
 */
export function UnoCatch({ game, online }: { game: GameView; online: boolean }) {
  const t = useT();
  const s = game.s;
  const caught = s.unoCatch;
  if (!game.catchable() || !caught) return null;
  const victim = caught.victim;
  const viewer = game.viewer();
  const p = s.players[victim];
  if (viewer === victim) {
    return (
      <div className="catch-zone">
        <UnoBadge word="UNO!" caption={t('hud.lateCap')} label={t('hud.lateAria')} onClick={() => game.lateUno()} />
      </div>
    );
  }
  // online spectators have no seat to catch from; on a shared screen anyone at the table may press it
  if (online && viewer === null) return null;
  return (
    <div className="catch-zone">
      <UnoBadge
        wide
        word={t('hud.caught')}
        caption={t('hud.catchCap', { who: p.name })}
        label={t('hud.catchAria', { who: p.name })}
        onClick={() => game.catchUno()}
        avatar={{ id: p.avatar, name: p.name, bot: p.bot }}
      />
    </div>
  );
}
