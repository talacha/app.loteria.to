/** Same unambiguous alphabet the cantor's room codes use (see engine roomCode). */
export const ROOM_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeRoomCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, '');
}

export function isValidRoomCode(code: string): boolean {
  return code.length === 5 && [...code].every((c) => ROOM_ALPHABET.includes(c));
}
