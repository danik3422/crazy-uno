import { normalizeCode } from '../net/protocol';

/** The room code from an invite link (`?room=CODE`), or '' when there is none. */
export function inviteFromUrl(): string {
  return normalizeCode(new URLSearchParams(location.search).get('room') ?? '');
}

/** Keeps the address bar pointing at the room, so a reload or a copied URL leads back to it. */
export function setUrlRoom(code: string | null) {
  try {
    const u = new URL(location.href);
    if (code) u.searchParams.set('room', code);
    else u.searchParams.delete('room');
    history.replaceState(null, '', u);
  } catch {
    /* sandboxed frames may refuse; the code is still on screen */
  }
}
