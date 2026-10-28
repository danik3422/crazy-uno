import { useEffect, useState } from 'react';
import { cardName } from '../game/rules';
import type { GameView } from '../game/view';
import { keySel } from '../three/drag';

/**
 * Play without a mouse: ← → pick a card, Enter or Space plays it, D draws, U calls UNO, P passes,
 * Esc lets go. Keys are matched by position (e.code), so they work on a Russian layout too.
 * Returns a sentence about the picked card for screen readers, and whether the keyboard is in use.
 */
export function useKeyboardPlay(game: GameView, locked: boolean, onCard: (id: number) => void) {
  const [said, setSaid] = useState('');
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input, textarea, select, [contenteditable]') || t.closest('.ov'))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = game.s;
      const v = game.viewer();
      const mine = !locked && v !== null && v === s.cur && s.phase !== 'over';
      const hand = v !== null ? s.players[v].hand : [];
      const pickable = (id: number) => {
        const c = hand.find(x => x.id === id);
        if (!c || !mine) return false;
        return s.phase === 'play' ? game.playable(c) : s.phase === 'choose' && s.choice?.kind === 'card';
      };
      const describe = (id: number) => {
        const c = hand.find(x => x.id === id);
        if (!c) return '';
        return `${cardName(c)}${pickable(id) ? ', можно сходить' : ''}. Карта ${hand.indexOf(c) + 1} из ${hand.length}`;
      };

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!hand.length) return;
        e.preventDefault();
        setActive(true);
        const at = hand.findIndex(c => c.id === keySel.id);
        const step = e.key === 'ArrowRight' ? 1 : -1;
        const next = at < 0 ? (step > 0 ? 0 : hand.length - 1) : (at + step + hand.length) % hand.length;
        keySel.id = hand[next].id;
        setSaid(describe(keySel.id));
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        if (keySel.id === null) return;
        e.preventDefault();
        if (pickable(keySel.id)) {
          onCard(keySel.id);
          keySel.id = null;
        } else setSaid(mine ? 'Этой картой сейчас не сходить' : 'Сейчас не твой ход');
        return;
      }
      if (e.key === 'Escape') {
        keySel.id = null;
        setSaid('');
        return;
      }
      if (!mine) return;
      if (e.code === 'KeyD') {
        if (s.phase === 'play' && (!s.drawn || s.pending > 0)) game.draw();
      } else if (e.code === 'KeyU') {
        if (s.phase === 'play') game.callUno();
        else if (game.catchable()) game.lateUno();
      } else if (e.code === 'KeyP') {
        if (s.phase === 'play' && s.drawn && s.pending === 0) game.pass();
      } else return;
      setActive(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, locked, onCard]);

  // a played or given-away card is no longer picked
  const hand = game.viewer() !== null ? game.s.players[game.viewer()!].hand : [];
  if (keySel.id !== null && !hand.some(c => c.id === keySel.id)) keySel.id = null;

  useEffect(() => () => { keySel.id = null; }, [game]);
  return { said, active };
}
