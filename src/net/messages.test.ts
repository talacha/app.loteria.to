import { describe, expect, it } from 'vitest';
import { isValidName, parseMsg, sanitizeName } from './messages.ts';

describe('parseMsg', () => {
  it('accepts every variant', () => {
    const ok = [
      {
        t: 'round',
        seed: 's',
        roundNo: 1,
        mode: 'normal',
        pattern: 'line',
        callLang: 'rotating',
        speedSec: 5,
        hostKey: 'k',
        called: [],
      },
      { t: 'assign', seat: 'a', tablaIndex: 5, roundNo: 1 },
      { t: 'call', i: 0, cardId: 'gallo', lang: 'nah', at: 1 },
      { t: 'claimResult', seat: 'a', roundNo: 1, valid: false, missing: ['x'] },
      { t: 'end', roundNo: 1, winners: ['a'] },
      { t: 'hello', seat: 'a', name: 'Ana', glyph: '*', labelLang: 'es' },
      { t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 3, marks: ['x'] },
    ];
    for (const m of ok) expect(parseMsg(m)).toEqual(m);
  });
  it('rejects malformed input', () => {
    expect(parseMsg(null)).toBeNull();
    expect(parseMsg({ t: 'nope' })).toBeNull();
    expect(parseMsg({ t: 'call', i: -1, cardId: 'x', lang: 'es', at: 1 })).toBeNull();
    expect(parseMsg({ t: 'call', i: 1001, cardId: 'x', lang: 'es', at: 1 })).toBeNull();
    expect(parseMsg({ t: 'call', i: 0, cardId: 'x', lang: 'es', at: 1.5 })).toBeNull();
    expect(parseMsg({ t: 'call', i: 0, cardId: 'x', lang: 'fr', at: 1 })).toBeNull();
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 1 })).toBeNull();
    expect(
      parseMsg({ t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 99999, marks: [] }),
    ).toBeNull();
    expect(
      parseMsg({ t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 1, marks: ['x', 'x'] }),
    ).toBeNull();
    expect(parseMsg({ t: 'end', roundNo: 1, winners: ['a', 'a'] })).toBeNull();
  });
  it('validates lobby', () => {
    const p = (i: number) => ({ seat: 's' + i, name: 'N' + i, glyph: '*' });
    const lobby = (n: number) => ({
      t: 'lobby',
      status: 'waiting',
      players: Array.from({ length: n }, (_, i) => p(i)),
    });
    expect(parseMsg({ ...lobby(2), status: 'started', roundNo: 1 })).not.toBeNull();
    expect(parseMsg(lobby(60))).not.toBeNull();
    expect(parseMsg(lobby(61))).toBeNull();
    expect(parseMsg({ ...lobby(0), players: [p(1), p(1)] })).toBeNull();
    expect(parseMsg({ ...lobby(0), players: [{ ...p(1), name: 'a\u202Eb' }] })).toBeNull();
    expect(parseMsg({ ...lobby(0), status: 'bogus' })).toBeNull();
  });
  it('requires roundNo and defaults called', () => {
    expect(parseMsg({ t: 'end', winners: [] })).toBeNull();
    expect(parseMsg({ t: 'claimResult', seat: 'a', valid: true })).toBeNull();
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 1, marks: [] })).toBeNull();
    const r = parseMsg({
      t: 'round',
      seed: 's',
      roundNo: 1,
      mode: 'normal',
      pattern: 'line',
      callLang: 'es',
      speedSec: 5,
    });
    expect(r).toMatchObject({ called: [] });
    expect(
      parseMsg({
        t: 'round',
        seed: 's',
        roundNo: 1,
        mode: 'normal',
        pattern: 'line',
        callLang: 'es',
        speedSec: 5,
        called: ['a', 'a'],
      }),
    ).toBeNull();
  });
  it('names: ZWJ emoji ok, zero-width space and bidi rejected', () => {
    const hello = { t: 'hello', seat: 'a', glyph: '*', labelLang: 'es' };
    expect(parseMsg({ ...hello, name: '\u{1F469}\u200D\u{1F4BB} Ana' })).not.toBeNull();
    expect(parseMsg({ ...hello, name: 'a\u200Bb' })).toBeNull();
    expect(parseMsg({ ...hello, name: 'a\u202Eb' })).toBeNull();
    expect(isValidName('a\u2067b')).toBe(false);
    expect(isValidName('Ana')).toBe(true);
    expect(sanitizeName('  a\u200Bb\u202E\u200D\u0007c ')).toBe('ab\u200Dc');
  });
  it('rejects unsafe names and bad speeds', () => {
    const hello = { t: 'hello', seat: 'a', glyph: '*', labelLang: 'es' };
    expect(parseMsg({ ...hello, name: '   ' })).toBeNull();
    expect(parseMsg({ ...hello, name: 'a‮b' })).toBeNull();
    expect(parseMsg({ ...hello, name: 'a\u0000b' })).toBeNull();
    expect(parseMsg({ ...hello, name: 'x'.repeat(41) })).toBeNull();
    const r = {
      t: 'round',
      seed: 's',
      roundNo: 1,
      mode: 'normal',
      pattern: 'line',
      callLang: 'es',
    };
    expect(parseMsg({ ...r, speedSec: 2 })).toBeNull();
    expect(parseMsg({ ...r, speedSec: Infinity })).toBeNull();
    expect(parseMsg({ ...r, speedSec: 61 })).toBeNull();
  });
});
