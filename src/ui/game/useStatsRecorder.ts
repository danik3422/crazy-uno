import { useEffect, useRef } from 'react';
import { presetOf } from '../../game/content';
import { type ModeId, addRound } from '../../game/stats';
import type { CardType } from '../../game/types';
import type { GameView } from '../../game/view';
import { profile } from '../profile/store';

const DRAWS = new Set<CardType>(['draw2', 'draw4', 'wild4', 'wildRev4', 'wild6', 'wild10']);
const BIG_DRAWS = new Set<CardType>(['draw4', 'wild4', 'wildRev4', 'wild6', 'wild10']);

interface Snap {
  game: GameView | null;
  round: number;
  phase: string;
  /** ids of the cards in the player's hand */
  mine: Set<number>;
  top: number;
  pending: number;
  fx: number;
  maxHand: number;
  /** the turn "UNO!" was last counted on (calling it and then laying the card is one call) */
  unoTurn: number;
}

/**
 * Adds what the player at this screen does to their record: cards laid and drawn, "UNO!", catches, Jump-Ins,
 * and each finished round. Works the same at home and online (it reads the table, not the rules engine).
 * A shared phone with several people on it records nothing: whose record would it be?
 */
export function useStatsRecorder(game: GameView, version: number) {
  const prev = useRef<Snap>({ game: null, round: -1, phase: '', mine: new Set(), top: -1, pending: 0, fx: 0, maxHand: 0, unoTurn: -1 });
  useEffect(() => {
    const s = game.s;
    const me = game.viewer();
    const humans = s.players.filter(p => !p.bot).length;
    if (me === null || (game.isLocal && humans > 1)) return;
    const p = prev.current;
    const hand = s.players[me]?.hand ?? [];
    const top = s.discard[s.discard.length - 1];
    const fresh = p.game !== game || p.round !== s.round;
    if (fresh) {
      prev.current = { game, round: s.round, phase: s.phase, mine: new Set(hand.map(c => c.id)), top: top?.id ?? -1, pending: s.pending, fx: game.fxBaseline, maxHand: hand.length, unoTurn: -1 };
      return;
    }

    let played = 0, drawn = 0, big = 0, stacks = 0, uno = 0, catches = 0, caught = 0, jumps = 0, challenges = 0;
    const colors = { red: 0, yellow: 0, green: 0, blue: 0 };
    // a card of mine is on the pile now: I laid it (on my turn, or jumping in)
    if (top && top.id !== p.top && p.mine.has(top.id)) {
      played++;
      if (top.color !== 'wild') colors[top.color]++;
      if (BIG_DRAWS.has(top.type)) big++;
      if (p.pending > 0 && DRAWS.has(top.type)) stacks++;
    }
    const grew = hand.length - p.mine.size + played;
    if (grew > 0) drawn += grew;

    for (const f of s.fx) {
      if (f.id <= p.fx) continue;
      if (f.kind === 'uno' && f.target === me && p.unoTurn !== s.turn) { uno++; p.unoTurn = s.turn; }
      if (f.kind === 'caught' && f.from === me) catches++;
      if (f.kind === 'caught' && f.target === me) caught++;
      if (f.kind === 'jump' && f.target === me) jumps++;
      if (f.kind === 'challenge' && f.target === me && f.text?.k === 'fx.challengeWon') challenges++;
    }
    const lastFx = s.fx.length ? s.fx[s.fx.length - 1].id : p.fx;
    const maxHand = Math.max(p.maxHand, hand.length);

    const over = s.phase === 'over' && p.phase !== 'over';
    if (played || drawn || uno || catches || caught || jumps || challenges || hand.length > p.maxHand || over) {
      profile.update(st => {
        let n = {
          ...st,
          cardsPlayed: st.cardsPlayed + played,
          cardsDrawn: st.cardsDrawn + drawn,
          bigDraws: st.bigDraws + big,
          stacks: st.stacks + stacks,
          unoCalls: st.unoCalls + uno,
          catches: st.catches + catches,
          caught: st.caught + caught,
          jumpIns: st.jumpIns + jumps,
          challengesWon: st.challengesWon + challenges,
          biggestHand: Math.max(st.biggestHand, hand.length),
          colors: { red: st.colors.red + colors.red, yellow: st.colors.yellow + colors.yellow, green: st.colors.green + colors.green, blue: st.colors.blue + colors.blue },
        };
        if (over) {
          const won = s.winTeam !== null && s.teams ? s.teams[me] === s.winTeam : s.winner === me;
          const mode: ModeId = presetOf(s.rules)?.id ?? 'custom';
          n = addRound(n, { won, turns: s.turn, mode, theme: s.theme ?? 'classic', online: !game.isLocal, teams: !!s.teams, maxHand });
        }
        return n;
      });
    }
    prev.current = { game, round: s.round, phase: s.phase, mine: new Set(hand.map(c => c.id)), top: top?.id ?? -1, pending: s.pending, fx: lastFx, maxHand, unoTurn: p.unoTurn };
  }, [game, version]);
}
