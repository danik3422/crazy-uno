import type { MemberInfo, Rematch } from '../../net/protocol';

/** Extra context when the game is an online room. */
export interface OnlineCtx {
  code: string;
  isHost: boolean;
  /** this player is only watching this round */
  spectator: boolean;
  /** host: back to the room lobby */
  onLobby: () => void;
  me: string;
  members: MemberInfo[];
  rematch: Rematch | null;
  roomAt: number;
  onVote: (ready: boolean) => void;
  onForce: () => void;
}
