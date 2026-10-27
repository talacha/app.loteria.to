/** Room codes use 5 characters from this alphabet (no 0/O/1/I/L). Mirrors @engine roomCode. */
const ROOM_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{5}$/;

/** Uppercase and drop spaces/hyphens people add when reading a code aloud. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[\s\-_.]/g, '').toUpperCase();
}

export function isRoomCode(code: string): boolean {
  return ROOM_RE.test(code);
}
