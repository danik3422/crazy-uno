import { useEffect, useRef, useState } from 'react';
import { sound } from '../../audio/sound';
import {
  EMOTES, PHRASES, REACTION_MS, ReactionLimiter, isEmote, reactionBus,
  type ReactionId, type ShownReaction,
} from '../../game/reactions';
import type { CardType } from '../../game/types';
import type { GameView } from '../../game/view';
import { useT } from '../../i18n';
import { EmoteFace } from './EmoteFace';
import './Reactions.css';

/** The newest reaction over one seat's plate, gone after a moment. */
export function ReactionBubble({ seat, below, mine }: { seat: number; below?: boolean; mine?: boolean }) {
  const t = useT();
  const [shown, setShown] = useState<ShownReaction | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = reactionBus.subscribe(r => {
      if (r.seat !== seat) return;
      setShown(r);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(null), REACTION_MS);
    });
    return () => { off(); clearTimeout(timer); };
  }, [seat]);
  if (!shown) return null;
  const emote = isEmote(shown.id);
  return (
    <div key={shown.key} className={`react-bubble ${below ? 'below' : ''} ${mine ? 'mine' : ''} ${emote ? 'emote' : 'phrase'}`} role="status">
      {isEmote(shown.id) ? <EmoteFace id={shown.id} size={54} /> : <span>{t(`react.${shown.id}`)}</span>}
    </div>
  );
}

const SmileIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden>
    <rect x="4.5" y="2.5" width="15" height="19" rx="3" fill="#fffdf6" transform="rotate(-8 12 12)" />
    <ellipse cx="12" cy="12" rx="5" ry="7.6" fill="currentColor" transform="rotate(20 12 12)" />
    <circle cx="10" cy="10.6" r="1.1" fill="#1d1430" />
    <circle cx="14" cy="10.6" r="1.1" fill="#1d1430" />
    <path d="M9.4 13.6 Q12 16.4 14.6 13.6" fill="none" stroke="#1d1430" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/**
 * The smiley button by your plate: a panel of drawn faces and set phrases.
 * After each one the button rests for a moment (and after a burst, a bit longer): nobody can flood the table.
 */
export function ReactionButton({ game, seat }: { game: GameView; seat: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [wait, setWait] = useState(0);
  const limiter = useRef(new ReactionLimiter());
  const root = useRef<HTMLDivElement>(null);

  // the cooldown counts down on the button
  useEffect(() => {
    if (wait <= 0) return;
    const id = setInterval(() => setWait(limiter.current.wait()), 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one interval while resting, not one per tick
  }, [wait > 0]);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const send = (id: ReactionId) => {
    if (!limiter.current.take()) { setWait(limiter.current.wait()); return; }
    setOpen(false);
    setWait(limiter.current.wait());
    // online the server passes it to everyone (this screen included); at home it shows right away
    if (game.react) game.react(id);
    else reactionBus.push(seat, id);
  };

  const secs = Math.ceil(wait / 1000);
  return (
    <div className="react-menu" ref={root}>
      <button
        type="button"
        className={`react-btn ${open ? 'on' : ''} ${wait > 0 ? 'resting' : ''}`}
        aria-expanded={open}
        aria-label={t('react.btn')}
        title={wait > 0 ? t('react.wait', { n: secs }) : t('react.btn')}
        onClick={() => setOpen(o => !o)}
      >
        <SmileIcon />
        {wait > 0 && <span className="react-wait">{secs}</span>}
      </button>
      {open && (
        <div className="react-pop" role="group" aria-label={t('react.btn')}>
          <div className="react-faces">
            {EMOTES.map(id => (
              <button key={id} type="button" disabled={wait > 0} title={t(`react.${id}`)} aria-label={t(`react.${id}`)} onClick={() => send(id)}>
                <EmoteFace id={id} size={46} />
              </button>
            ))}
          </div>
          <div className="react-phrases">
            {PHRASES.map(id => (
              <button key={id} type="button" disabled={wait > 0} onClick={() => send(id)}>{t(`react.${id}`)}</button>
            ))}
          </div>
          {wait > 0 && <small className="react-hint">{t('react.wait', { n: secs })}</small>}
        </div>
      )}
    </div>
  );
}

/** A soft pop whenever anyone reacts. */
export function useReactionSound() {
  useEffect(() => reactionBus.subscribe(() => sound.play('click')), []);
}

const DRAW_CARDS = new Set<CardType>(['draw2', 'wild4', 'draw4', 'wildRev4', 'wild6', 'wild10']);
/** a stable "random" in [0, 1) from a few numbers: every screen at an online table picks the same */
const roll = (...n: number[]) => {
  const x = Math.sin(n.reduce((a, b, i) => a + b * (12.9898 + i * 78.233), 0)) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Bots react now and then, like people do: a groan at a big penalty, a laugh after hitting someone with a draw card,
 * a cheer when they win. Worked out from the table itself, so every screen at an online table shows the same thing.
 */
/** what a bot may answer when a person reacts */
const REPLIES: Partial<Record<ReactionId, ReactionId[]>> = {
  hi: ['hi', 'party'],
  gg: ['gg', 'thanks'],
  nice: ['thanks', 'cool'],
  thanks: ['love', 'cool'],
  hurry: ['think', 'oops'],
  laugh: ['laugh'],
  angry: ['cool', 'laugh'],
  villain: ['laugh', 'sneaky'],
  sneaky: ['cool', 'laugh'],
  lucky: ['cool', 'thanks'],
  close: ['oops', 'think'],
  revenge: ['laugh', 'think'],
  again: ['party', 'again'],
};

export function useBotReactions(game: GameView, version: number) {
  const gameRef = useRef(game);
  /** when each bot last reacted: a bot never chatters */
  const lastAt = useRef(new Map<number, number>());
  gameRef.current = game;
  // a person says something: sometimes one of the bots answers
  useEffect(() => {
    let n = 0;
    return reactionBus.subscribe(r => {
      const s = gameRef.current.s;
      const from = s.players[r.seat];
      const answers = REPLIES[r.id];
      if (!from || from.bot || !answers) return;
      n++;
      const bots = s.players.map((p, i) => (p.bot && !p.out ? i : -1)).filter(i => i >= 0);
      if (!bots.length || roll(s.turn, r.seat, n, 11) > 0.6) return;
      const bot = bots[Math.floor(roll(s.turn, r.seat, n, 12) * bots.length)];
      const now = Date.now();
      if (now - (lastAt.current.get(bot) ?? 0) < 6000) return;
      lastAt.current.set(bot, now);
      const id = answers[Math.floor(roll(s.turn, bot, n, 13) * answers.length)];
      setTimeout(() => reactionBus.push(bot, id), 900 + roll(s.turn, bot, 14) * 900);
    });
  }, []);

  const prev = useRef<{ game: GameView | null; round: number; hands: number[]; top: number; phase: string }>({ game: null, round: -1, hands: [], top: -1, phase: '' });
  useEffect(() => {
    const s = game.s;
    const p = prev.current;
    const hands = s.players.map(x => x.hand.length);
    const top = s.discard[s.discard.length - 1];
    if (p.game === game && p.round === s.round) {
      const say = (seat: number, id: ReactionId, salt: number) => {
        const pl = s.players[seat];
        if (!pl?.bot || seat === game.viewer()) return;
        const now = Date.now();
        if (now - (lastAt.current.get(seat) ?? 0) < 6000) return;
        lastAt.current.set(seat, now);
        setTimeout(() => reactionBus.push(seat, id), 500 + roll(s.turn, seat, salt) * 700);
      };
      // a big penalty: a groan, or a word for whoever did it
      const GROAN: ReactionId[] = ['angry', 'cry', 'villain', 'revenge'];
      hands.forEach((n, i) => {
        if (n - (p.hands[i] ?? n) >= 4 && roll(s.turn, i, 1) < 0.6) say(i, GROAN[Math.floor(roll(s.turn, i, 2) * GROAN.length)], 3);
      });
      // a bot just hit someone with a draw card: a laugh now and then
      if (top && top.id !== p.top && DRAW_CARDS.has(top.type)) {
        const by = s.players.findIndex((pl, i) => pl.bot && hands[i] < (p.hands[i] ?? 0));
        if (by >= 0 && roll(s.turn, by, 4) < 0.35) say(by, roll(s.turn, by, 5) < 0.5 ? 'laugh' : 'cool', 6);
      }
      if (s.phase === 'over' && p.phase !== 'over' && s.winner !== null) {
        // a bot won the round
        say(s.winner, roll(s.round, s.winner, 7) < 0.5 ? 'party' : 'gg', 8);
        // a bot that was one card away: so close; another one wants a rematch
        const near = s.players.findIndex((pl, i) => pl.bot && i !== s.winner && !pl.out && (p.hands[i] ?? 9) <= 2);
        if (near >= 0 && roll(s.round, near, 9) < 0.7) say(near, 'close', 10);
        const other = s.players.findIndex((pl, i) => pl.bot && i !== s.winner && i !== near);
        if (other >= 0 && roll(s.round, other, 15) < 0.4) {
          const seat = other;
          setTimeout(() => say(seat, 'again', 16), 1800);
        }
      }
    }
    prev.current = { game, round: s.round, hands, top: top?.id ?? -1, phase: s.phase };
  }, [game, version]);
}
