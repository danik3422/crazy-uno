import { msg, type Msg } from '../i18n/msg';

/**
 * Teams (the "2 on 2" format): who plays with whom, whether the split works, and where everyone sits.
 * Shared by the local setup, the online lobby, the server and the engine.
 */

export type TeamId = 0 | 1;

export const isTeamId = (t: unknown): t is TeamId => t === 0 || t === 1;

/**
 * Everyone's team: their own pick, and for whoever has not picked, the team that is short of players
 * at that point (so by default the table splits evenly, alternating).
 */
export function teamsOf(list: readonly { team?: number }[]): TeamId[] {
  const size = [0, 0];
  return list.map((p, i) => {
    const t: TeamId = isTeamId(p.team) ? p.team : size[0] === size[1] ? ((i % 2) as TeamId) : size[0] < size[1] ? 0 : 1;
    size[t]++;
    return t;
  });
}

/** Why these teams cannot play (null when they can): at least 4 players, the same number on each side. */
export function teamsProblem(teams: readonly number[]): Msg | null {
  if (teams.length < 4) return msg('teams.need4');
  if (teams.length % 2) return msg('teams.even');
  const red = teams.filter(t => t === 0).length;
  if (red * 2 !== teams.length) return msg('teams.uneven', { a: red, b: teams.length - red });
  return null;
}

/**
 * Seats the players so the teams alternate around the table (with four, partners sit opposite),
 * keeping the order within each team. Returns the players in seat order with their teams.
 */
export function seatByTeams<T>(list: readonly T[], teams: readonly TeamId[]): { list: T[]; teams: TeamId[] } {
  const side = [0, 1].map(t => list.filter((_, i) => teams[i] === t));
  const out: T[] = [];
  const outTeams: TeamId[] = [];
  for (let k = 0; k < Math.max(side[0].length, side[1].length); k++) {
    for (const t of [0, 1] as TeamId[]) {
      if (k < side[t].length) {
        out.push(side[t][k]);
        outTeams.push(t);
      }
    }
  }
  return { list: out, teams: outTeams };
}
