import { useEffect, useMemo, useState } from 'react';
import type { RoomInfo } from '../../../net/protocol';

/** what the host may change in the room */
type HostChanges = Partial<Pick<RoomInfo, 'rules' | 'table' | 'theme'>>;

/** a change the server has not confirmed by then is dropped (the server may have refused it) */
const HOLD_MS = 2500;

/**
 * The server is a round trip away (about half a second on the hosted server), so the host's own changes show
 * at once and the server's next room update confirms them: each local change is dropped once the server shows it.
 * The same for bots: a bot asked for gets its seat on screen right away, waiting for the server.
 */
export function useOptimisticRoom(serverRoom: RoomInfo) {
  const [mine, setMine] = useState<HostChanges>({});
  useEffect(() => {
    setMine(m => {
      const left = { ...m };
      for (const k of Object.keys(left) as (keyof HostChanges)[]) if (JSON.stringify(left[k]) === JSON.stringify(serverRoom[k])) delete left[k];
      return Object.keys(left).length === Object.keys(m).length ? m : left;
    });
  }, [serverRoom]);
  useEffect(() => {
    if (!Object.keys(mine).length) return;
    const tm = setTimeout(() => setMine({}), HOLD_MS);
    return () => clearTimeout(tm);
  }, [mine]);
  const room: RoomInfo = useMemo(() => ({ ...serverRoom, ...mine }), [serverRoom, mine]);
  const change = <K extends keyof HostChanges>(k: K, v: NonNullable<HostChanges[K]>) => setMine(m => ({ ...m, [k]: v }));

  // bots asked for but not seated yet
  const botsNow = serverRoom.members.filter(m => m.bot).length;
  const [botsWanted, setBotsWanted] = useState(0);
  const pendingBots = Math.max(0, botsWanted - botsNow);
  useEffect(() => {
    if (!pendingBots) return;
    const tm = setTimeout(() => setBotsWanted(0), HOLD_MS);
    return () => clearTimeout(tm);
  }, [pendingBots, botsWanted]);
  const botAsked = () => setBotsWanted(w => Math.max(w, botsNow) + 1);

  return { room, change, pendingBots, botAsked };
}
