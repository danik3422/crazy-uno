import type { Card, Player, State } from './types';

/**
 * What the UI and the 3D scene need from a game.
 * Implemented by the local engine (`Game`) and by the online mirror (`RemoteGame`).
 */
export interface GameView {
  s: State;
  readonly isLocal: boolean;
  /** server clock minus local clock, ms */
  readonly clockOffset: number;
  /** effects with an id up to this were already shown (e.g. after a reconnect) */
  readonly fxBaseline: number;
  subscribe(f: () => void): () => void;
  getVersion(): number;

  cp(): Player;
  nextIdx(from?: number, steps?: number): number;
  /** whose hand faces up on this screen (null = nobody's) */
  viewer(): number | null;
  /** who sits at the near edge of the table */
  seat(): number;
  playable(c: Card): boolean;

  play(cardId: number): unknown;
  draw(): void;
  pass(): void;
  callUno(): void;
  resolveChoice(value: string | number): void;
  confirmHandover(): void;
  resolveDare(accepted: boolean): void;
  doneGroup(): void;
  guessCoin(guess: 'heads' | 'tails'): void;
  finishCoin(): void;
  /** the UNO window is open (someone forgot to call it) */
  catchable(): boolean;
  /** catch the player who forgot to call UNO (the viewer is the catcher) */
  catchUno(): void;
  /** the victim calls UNO just in time */
  lateUno(): void;
  challengeWild4(): void;
  declineChallenge(): void;
}
