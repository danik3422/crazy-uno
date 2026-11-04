/**
 * The player's own record: what they did across all their games on this device, and the achievements it unlocks.
 * Plain data, no screen: the recorder (ui/game/useStatsRecorder) feeds it, the profile screen shows it.
 */
import type { Color } from './types';

export type ModeId = 'classic' | 'nomercy' | 'party' | 'chaos' | 'custom';

export interface Stats {
  v: 1;
  games: number;
  wins: number;
  /** wins in a row right now, and the best run ever */
  streak: number;
  bestStreak: number;
  cardsPlayed: number;
  cardsDrawn: number;
  /** +4, +6, +10 and the other "draw" wilds thrown at someone */
  bigDraws: number;
  /** a draw card laid on top of a penalty, passing it on */
  stacks: number;
  unoCalls: number;
  /** you caught someone who forgot "UNO!", and someone caught you */
  catches: number;
  caught: number;
  jumpIns: number;
  challengesWon: number;
  biggestHand: number;
  /** the fewest turns a won round took (null: no win yet) */
  fastestWin: number | null;
  /** won a round after holding at least COMEBACK cards in it */
  comebacks: number;
  teamWins: number;
  online: { games: number; wins: number };
  colors: Record<Color, number>;
  modes: Partial<Record<ModeId, { games: number; wins: number }>>;
  /** the tables played on */
  themes: string[];
  /** achievement id -> when it was unlocked (ms) */
  unlocked: Record<string, number>;
}

export const COMEBACK = 12;

export const emptyStats = (): Stats => ({
  v: 1, games: 0, wins: 0, streak: 0, bestStreak: 0, cardsPlayed: 0, cardsDrawn: 0, bigDraws: 0, stacks: 0,
  unoCalls: 0, catches: 0, caught: 0, jumpIns: 0, challengesWon: 0, biggestHand: 0, fastestWin: null, comebacks: 0, teamWins: 0,
  online: { games: 0, wins: 0 }, colors: { red: 0, yellow: 0, green: 0, blue: 0 }, modes: {}, themes: [], unlocked: {},
});

/** Fills in anything added since the record was saved, and drops whatever is not a record at all. */
export function cleanStats(raw: unknown): Stats {
  const base = emptyStats();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Stats>;
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
  const out: Stats = { ...base };
  for (const k of Object.keys(base) as (keyof Stats)[]) {
    if (typeof base[k] === 'number') (out[k] as number) = num(r[k]);
  }
  out.v = 1;
  out.fastestWin = typeof r.fastestWin === 'number' && r.fastestWin > 0 ? r.fastestWin : null;
  out.online = { games: num(r.online?.games), wins: num(r.online?.wins) };
  out.colors = { red: num(r.colors?.red), yellow: num(r.colors?.yellow), green: num(r.colors?.green), blue: num(r.colors?.blue) };
  out.modes = {};
  for (const [m, v] of Object.entries(r.modes ?? {})) out.modes[m as ModeId] = { games: num(v?.games), wins: num(v?.wins) };
  out.themes = Array.isArray(r.themes) ? r.themes.filter(x => typeof x === 'string').slice(0, 20) : [];
  out.unlocked = {};
  for (const [id, at] of Object.entries(r.unlocked ?? {})) if (typeof at === 'number') out.unlocked[id] = at;
  return out;
}

/** How a finished round went for the player. */
export interface RoundResult {
  won: boolean;
  turns: number;
  mode: ModeId;
  theme: string;
  online: boolean;
  teams: boolean;
  /** the most cards the player held during the round */
  maxHand: number;
}

/** Adds one finished round to the record (a new object; the old one is left as it was). */
export function addRound(st: Stats, r: RoundResult): Stats {
  const s: Stats = { ...st, online: { ...st.online }, modes: { ...st.modes }, themes: [...st.themes] };
  s.games++;
  const m = { ...(s.modes[r.mode] ?? { games: 0, wins: 0 }) };
  m.games++;
  if (r.online) s.online.games++;
  if (!s.themes.includes(r.theme)) s.themes.push(r.theme);
  if (r.won) {
    s.wins++;
    m.wins++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    if (r.online) s.online.wins++;
    if (r.teams) s.teamWins++;
    if (r.maxHand >= COMEBACK) s.comebacks++;
    if (r.turns > 0) s.fastestWin = s.fastestWin === null ? r.turns : Math.min(s.fastestWin, r.turns);
  } else s.streak = 0;
  s.modes[r.mode] = m;
  return s;
}

/* ---------------- achievements ---------------- */

/** the picture on the badge (drawn in ui/profile/Badge.tsx) */
export type BadgeGlyph = 'trophy' | 'crown' | 'flame' | 'card' | 'stack' | 'shout' | 'eye' | 'bolt' | 'scales' | 'rise' | 'clock' | 'skull' | 'tornado' | 'team' | 'globe' | 'map' | 'rainbow' | 'marathon';
export type BadgeTier = 'bronze' | 'silver' | 'gold';

export type AchId =
  | 'firstWin' | 'wins10' | 'wins50' | 'streak3' | 'streak5' | 'villain' | 'stacker' | 'loud' | 'sheriff' | 'ninja'
  | 'lawyer' | 'comeback' | 'speedrun' | 'noMercy' | 'chaos' | 'team' | 'online' | 'tourist' | 'rainbow' | 'marathon';

export interface Achievement {
  id: AchId;
  glyph: BadgeGlyph;
  tier: BadgeTier;
  /** how far along the player is: [now, goal] */
  progress: (s: Stats) => [number, number];
}

const count = (get: (s: Stats) => number, goal: number) => (s: Stats): [number, number] => [Math.min(goal, get(s)), goal];

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstWin', glyph: 'trophy', tier: 'bronze', progress: count(s => s.wins, 1) },
  { id: 'wins10', glyph: 'trophy', tier: 'silver', progress: count(s => s.wins, 10) },
  { id: 'wins50', glyph: 'crown', tier: 'gold', progress: count(s => s.wins, 50) },
  { id: 'streak3', glyph: 'flame', tier: 'silver', progress: count(s => s.bestStreak, 3) },
  { id: 'streak5', glyph: 'flame', tier: 'gold', progress: count(s => s.bestStreak, 5) },
  { id: 'villain', glyph: 'card', tier: 'silver', progress: count(s => s.bigDraws, 25) },
  { id: 'stacker', glyph: 'stack', tier: 'silver', progress: count(s => s.stacks, 10) },
  { id: 'loud', glyph: 'shout', tier: 'bronze', progress: count(s => s.unoCalls, 20) },
  { id: 'sheriff', glyph: 'eye', tier: 'silver', progress: count(s => s.catches, 5) },
  { id: 'ninja', glyph: 'bolt', tier: 'silver', progress: count(s => s.jumpIns, 10) },
  { id: 'lawyer', glyph: 'scales', tier: 'bronze', progress: count(s => s.challengesWon, 3) },
  { id: 'comeback', glyph: 'rise', tier: 'gold', progress: count(s => s.comebacks, 1) },
  { id: 'speedrun', glyph: 'clock', tier: 'gold', progress: s => [s.fastestWin !== null && s.fastestWin <= 12 ? 1 : 0, 1] },
  { id: 'noMercy', glyph: 'skull', tier: 'silver', progress: count(s => s.modes.nomercy?.wins ?? 0, 1) },
  { id: 'chaos', glyph: 'tornado', tier: 'silver', progress: count(s => s.modes.chaos?.wins ?? 0, 1) },
  { id: 'team', glyph: 'team', tier: 'bronze', progress: count(s => s.teamWins, 1) },
  { id: 'online', glyph: 'globe', tier: 'bronze', progress: count(s => s.online.wins, 1) },
  { id: 'tourist', glyph: 'map', tier: 'silver', progress: count(s => s.themes.length, 5) },
  { id: 'rainbow', glyph: 'rainbow', tier: 'silver', progress: count(s => Math.min(s.colors.red, s.colors.yellow, s.colors.green, s.colors.blue), 50) },
  { id: 'marathon', glyph: 'marathon', tier: 'gold', progress: count(s => s.games, 100) },
];

export const isDone = (a: Achievement, s: Stats) => {
  const [now, goal] = a.progress(s);
  return now >= goal;
};

/** Marks newly reached achievements as unlocked; returns the new record and the ones just unlocked. */
export function unlockNew(s: Stats, now = Date.now()): { stats: Stats; fresh: Achievement[] } {
  const fresh = ACHIEVEMENTS.filter(a => !s.unlocked[a.id] && isDone(a, s));
  if (!fresh.length) return { stats: s, fresh };
  const unlocked = { ...s.unlocked };
  for (const a of fresh) unlocked[a.id] = now;
  return { stats: { ...s, unlocked }, fresh };
}

/** The favourite colour: the one played most (null before any card). */
export function favouriteColor(s: Stats): Color | null {
  const best = (Object.entries(s.colors) as [Color, number][]).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : null;
}
