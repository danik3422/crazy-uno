import { teamName } from '../../../game/content';
import type { LocalSetup } from '../../../game/engine/Game';
import type { TeamId } from '../../../game/teams';
import { useT } from '../../../i18n';
import { AvatarImg } from '../../components/AvatarImg';
import { SwapTeamIcon } from '../../components/TeamBox';
import { UiIcon } from '../../components/UiIcon';
import './PlayerRow.css';

type SetupPlayer = LocalSetup['players'][number];

interface Props {
  index: number;
  player: SetupPlayer;
  /** 2 vs 2: the player's side (null: no teams) */
  team: TeamId | null;
  canRemove: boolean;
  onAvatar: () => void;
  onName: (name: string) => void;
  onTeam: (team: TeamId) => void;
  /** person ↔ bot */
  onToggleBot: () => void;
  onRemove: () => void;
}

/** One editable player of the one-device game: avatar, name, team switch (teams format), person/bot, remove. */
export function PlayerRow({ index, player: p, team, canRemove, onAvatar, onName, onTeam, onToggleBot, onRemove }: Props) {
  const t = useT();
  return (
    <div className="prow">
      <button className="ava-btn" title={t('home.changeAvatar')} onClick={onAvatar}>
        <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={42} />
      </button>
      <input
        id={`pname${index}`}
        maxLength={16}
        value={p.name}
        aria-label={t('setup.nameAria', { n: index + 1 })}
        onChange={e => onName(e.target.value)}
      />
      {team !== null && (
        <button
          className={`btn team-swap to${1 - team}`}
          title={t('team.moveTo', { team: teamName(1 - team) })}
          aria-label={t('team.moveAria', { name: p.name, team: teamName(1 - team) })}
          onClick={() => onTeam(team ? 0 : 1)}
        >
          <SwapTeamIcon />
        </button>
      )}
      <button className="btn tog" title={p.bot ? t('setup.botTip') : t('setup.humanTip')} onClick={onToggleBot}>
        <UiIcon name={p.bot ? 'robot' : 'person'} size={22} />
        <span className="tog-label">{p.bot ? t('setup.bot') : t('setup.human')}</span>
      </button>
      <button className="btn x" aria-label={t('setup.remove')} disabled={!canRemove} onClick={onRemove}>
        ✕
      </button>
    </div>
  );
}
