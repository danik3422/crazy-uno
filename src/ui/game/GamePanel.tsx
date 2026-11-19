import { type ReactNode, useEffect, useId, useLayoutEffect, useRef } from 'react';
import './GamePanel.css';

interface Props {
  /** the small pill on top: who or what this is about (an avatar or an event icon and a few words) */
  pill?: ReactNode;
  /** the big display-font line */
  title?: ReactNode;
  children?: ReactNode;
  /** extra classes for the panel (its own sizes and parts) */
  className?: string;
  /** the hot-seat curtain: the table is hidden behind it (nobody may see the next hand) */
  opaque?: boolean;
  /** docked: to the bottom, or to the right on a phone on its side (the round's podium stays in view) */
  dock?: boolean;
  /** Escape or a tap beside the panel closes it (only for panels that can simply be put away) */
  onClose?: () => void;
  /** Enter while no button has the focus: the usual answer (what the focused button used to be) */
  onEnter?: () => void;
  /** number keys for the choices ('1' → the first, …); a falsy entry is off */
  keys?: Record<string, (() => void) | undefined | false>;
}

/**
 * Every dialog during a game: a compact dark panel in the middle of a softly vignetted table, a pill line on top
 * (who / what), a big title, the content, then the game's own buttons (in `.gp-actions`).
 *
 * The panel takes the focus itself (no ring on it), so no button looks chosen before the player chose; Tab reaches
 * the buttons (their focus-visible ring), number keys pick (`keys`), Enter gives the usual answer.
 */
export function GamePanel({ pill, title, children, className = '', opaque, dock, onClose, onEnter, keys }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const keysRef = useRef(keys);
  keysRef.current = keys;

  // focus the panel when it opens, and again whenever its focused button goes away (the coin's guesses → "Next")
  useLayoutEffect(() => {
    const el = ref.current;
    const a = document.activeElement;
    if (el && (!a || a === document.body || !a.isConnected)) el.focus({ preventScroll: true });
  });
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true });
  }, []);

  // Escape (when the panel can be put away) and the number keys, only for the topmost dialog and never while typing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const ov = ref.current?.parentElement;
      const all = document.querySelectorAll('.ov');
      if (!ov || all[all.length - 1] !== ov) return;
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) return;
      const fn = e.key === 'Escape' ? onClose : keysRef.current?.[e.key];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className={`ov pick-ov${opaque ? ' opaque' : ''}${dock ? ' dock-ov' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        ref={ref}
        className={`gp${dock ? ' dock' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? id : undefined}
        tabIndex={-1}
        onKeyDown={e => {
          if (e.key === 'Enter' && e.target === e.currentTarget && onEnter) { e.preventDefault(); onEnter(); }
        }}
      >
        {pill && <p className="gp-pill">{pill}</p>}
        {title && <h2 className="gp-title" id={id}>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/** the little key hint inside a button (hidden on touch screens) */
export function Key({ k }: { k: string | number }) {
  return <kbd className="gp-key" aria-hidden>{k}</kbd>;
}
