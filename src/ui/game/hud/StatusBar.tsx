import { CNAME, HEX, teamName } from '../../../game/content';
import type { GameView } from '../../../game/view';
import { useT } from '../../../i18n';
import { EventIcon } from '../../components/EventIcon';

/** all four colours: the round opened with a Wild and the colour is not named yet */
const ALL_COLOURS = `conic-gradient(${HEX.red} 0 25%, ${HEX.yellow} 0 50%, ${HEX.green} 0 75%, ${HEX.blue} 0)`;

/**
 * The pill in the top-left corner: the colour in play, the direction, a stacked penalty, the round clock,
 * your team, and the timed events (blind, blitz, bomb).
 */
export function StatusBar({ game, bombLeft, roundLeft }: { game: GameView; bombLeft: number; roundLeft?: number | null }) {
  const t = useT();
  const s = game.s;
  const viewer = game.viewer();
  const naming = s.discard.length === 1 && s.discard[0].color === 'wild' && s.phase === 'choose';
  return (
    <div className="hud-top">
      <div className="status">
        <span className="swatch" style={{ background: naming ? ALL_COLOURS : HEX[s.color] }} />
        <span className="cname">{naming ? t('hud.picking') : CNAME[s.color]}</span>
        <span className={`dirIcon ${s.dir < 0 ? 'ccw' : ''}`} title={s.dir < 0 ? t('hud.ccw') : t('hud.cw')}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
            <path d="M19.5 3.5v4.6h-4.6" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        {s.pending > 0 && <span className="pen">+{s.pending}</span>}
        {roundLeft != null && (
          <span className={`round-clock ${roundLeft <= 30 ? 'hot' : ''}`} title={t('hud.roundLeft')}>
            ⏱ {Math.floor(roundLeft / 60)}:{String(roundLeft % 60).padStart(2, '0')}
          </span>
        )}
        {s.teams && viewer !== null && (
          <span className={`team-pill t${s.teams[viewer]}`} title={t('hud.yourTeam')}>{teamName(s.teams[viewer])}</span>
        )}
        {s.blindTurns > 0 && <span className="ev-chip" title={t('hud.blindTitle')}><EventIcon id="blind" size={18} /></span>}
        {s.blitzTurns > 0 && !bombLeft && <span className="ev-chip" title={t('hud.blitzTitle')}><EventIcon id="blitz" size={18} /></span>}
        {bombLeft > 0 && (
          <span className={`bombTimer ${bombLeft <= 3 ? 'hot' : ''}`}>{s.timerKind === 'blitz' ? <EventIcon id="blitz" size={16} /> : '💣'} {bombLeft}</span>
        )}
      </div>
    </div>
  );
}
