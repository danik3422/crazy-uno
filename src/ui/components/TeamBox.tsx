import type { ReactNode } from 'react';
import { TEAM_NAMES } from '../../game/content';
import './TeamBox.css';

/**
 * One side in the teams format: a tinted box with the team's name and head count,
 * holding that team's players. Used by the local setup and the online lobby.
 */
export function TeamBox({ team, count, children, empty }: { team: number; count: number; children: ReactNode; empty?: string }) {
  return (
    <section className={`team-box t${team}`} aria-label={`Команда «${TEAM_NAMES[team]}»`}>
      <header className="team-head">
        <span className="team-dot" aria-hidden />
        <b>{TEAM_NAMES[team]}</b>
        <span className="team-n">{count}</span>
      </header>
      {children}
      {count === 0 && empty && <p className="team-empty">{empty}</p>}
    </section>
  );
}

/** Two arrows: "move to the other team". */
export function SwapTeamIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M4 8h13M13.5 4.5 17 8l-3.5 3.5M20 16H7M10.5 12.5 7 16l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
