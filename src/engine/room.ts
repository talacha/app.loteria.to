import type { RoomState } from './types';
import { roomCode } from './codes';

const SECRET_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function token(r: () => number, len: number): string {
  let s = '';
  for (let i = 0; i < len; i++) {
    const x = r();
    const k =
      Number.isFinite(x) && x > 0
        ? Math.min(SECRET_ALPHABET.length - 1, Math.floor(x * SECRET_ALPHABET.length))
        : 0;
    s += SECRET_ALPHABET[k];
  }
  return s;
}

/** All randomness enters here; hostReduce itself is pure. */
export function createRoom(rng: () => number = Math.random): RoomState {
  return {
    code: roomCode(rng),
    seed: token(rng, 16),
    deckSecret: token(rng, 24),
    roundNo: 0,
    settings: { pattern: 'line', callLang: 'es', speedSec: 10, mode: 'normal' },
    round: null,
    seats: {},
    lastClaimAt: {},
    takenIndices: [],
  };
}
