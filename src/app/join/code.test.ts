import { describe, expect, it } from 'vitest';
import { isRoomCode, normalizeCode } from './code';

describe('room code', () => {
  it('normalises case and separators', () => {
    expect(normalizeCode(' k7m-2q ')).toBe('K7M2Q');
    expect(isRoomCode(normalizeCode('k7m 2q'))).toBe(true);
  });
  it('rejects characters outside the alphabet or wrong length', () => {
    expect(isRoomCode('K7M2')).toBe(false);
    expect(isRoomCode('K7M20')).toBe(false);
    expect(isRoomCode('K7MIL')).toBe(false);
  });
});
