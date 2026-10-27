import { describe, expect, it } from 'vitest';
import { HOST_ONLY, isValidName, parseMsg, sanitizeName } from './messages.ts';

describe('parseMsg', () => {
  it('limits names to 24 characters on the wire and in form validation', () => {
    const hello = { t: 'hello', seat: 'a', glyph: '*', labelLang: 'es' };
    expect(isValidName('a'.repeat(24))).toBe(true);
    expect(isValidName('a'.repeat(25))).toBe(false);
    expect(parseMsg({ ...hello, name: 'a'.repeat(24) })).not.toBeNull();
    expect(parseMsg({ ...hello, name: 'a'.repeat(25) })).toBeNull();
  });
  it('accepts every variant', () => {
    const ok = [
      {
        t: 'round',
        seed: 's',
        roundNo: 1,
        speedSec: 5,
        hostKey: 'k',
      },
      { t: 'assign', seat: 'a', tablaIndex: 5, roundNo: 1 },
      { t: 'call', i: 0, cardId: 'gallo', choices: ['gallo', 'luna', 'sol'], at: 1 },
      { t: 'pick', seat: 'a', roundNo: 1, i: 0, cardId: 'x' },
      { t: 'pickResult', roundNo: 1, i: 0, seat: 'a', correct: true, points: 1, first: false },
      { t: 'scores', roundNo: 1, points: { a: 3, b: 0 }, crossed: { a: 4, b: 0 } },
      { t: 'scores', roundNo: 1, points: { a: 3 } },
      { t: 'callClosed', roundNo: 1, i: 0 },
      { t: 'end', roundNo: 1, winners: ['a'], reason: 'full-card' },
      { t: 'lobby', status: 'full', players: [], hostKey: 'k' },
      { t: 'hello', seat: 'a', name: 'Ana', glyph: '*', labelLang: 'es' },
      { t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 3, marks: ['x'] },
    ];
    for (const m of ok) expect(parseMsg(m)).toEqual(m);
  });
  it('rejects malformed input', () => {
    expect(parseMsg(null)).toBeNull();
    expect(parseMsg({ t: 'nope' })).toBeNull();
    expect(parseMsg({ t: 'call', i: -1, cardId: 'x', choices: ['x', 'y', 'z'], at: 1 })).toBeNull();
    expect(
      parseMsg({ t: 'call', i: 1001, cardId: 'x', choices: ['x', 'y', 'z'], at: 1 }),
    ).toBeNull();
    expect(
      parseMsg({ t: 'call', i: 0, cardId: 'x', choices: ['x', 'y', 'z'], at: 1.5 }),
    ).toBeNull();
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 1 })).toBeNull();
    expect(
      parseMsg({ t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 99999, marks: [] }),
    ).toBeNull();
    expect(
      parseMsg({ t: 'claim', seat: 'a', roundNo: 1, tablaIndex: 1, marks: ['x', 'x'] }),
    ).toBeNull();
    expect(parseMsg({ t: 'end', roundNo: 1, winners: ['a', 'a'], reason: 'full-card' })).toBeNull();
  });
  it('accepts optional closed call history on assign and rejects duplicates or oversized history', () => {
    const assign = { t: 'assign', seat: 'a', tablaIndex: 5, roundNo: 1 };
    expect(parseMsg({ ...assign, closed: ['sol', 'luna'] })).toEqual({
      ...assign,
      closed: ['sol', 'luna'],
    });
    expect(parseMsg({ ...assign, closed: [] })).not.toBeNull();
    expect(parseMsg({ ...assign, closed: ['sol', 'sol'] })).toBeNull();
    expect(parseMsg({ ...assign, closed: [''] })).toBeNull();
    expect(
      parseMsg({ ...assign, closed: Array.from({ length: 55 }, (_, i) => `c${i}`) }),
    ).toBeNull();
  });

  it('validates lobby', () => {
    const p = (i: number) => ({ seat: 's' + i, name: 'N' + i, glyph: '*' });
    const lobby = (n: number) => ({
      t: 'lobby',
      status: 'waiting',
      players: Array.from({ length: n }, (_, i) => p(i)),
    });
    expect(parseMsg({ ...lobby(2), status: 'started', roundNo: 1 })).not.toBeNull();
    expect(parseMsg(lobby(20))).not.toBeNull();
    expect(parseMsg(lobby(21))).toBeNull();
    expect(parseMsg({ ...lobby(0), players: [p(1), p(1)] })).toBeNull();
    expect(parseMsg({ ...lobby(0), players: [{ ...p(1), name: 'a\u202Eb' }] })).toBeNull();
    expect(parseMsg({ ...lobby(0), status: 'bogus' })).toBeNull();
  });
  it('round carries an optional gridSize 3..8', () => {
    const r = { t: 'round', seed: 's', roundNo: 1, speedSec: 8 };
    expect(parseMsg(r)).not.toBeNull();
    expect(parseMsg({ ...r, gridSize: 8 })).toMatchObject({ gridSize: 8 });
    expect(parseMsg({ ...r, gridSize: 2 })).toBeNull();
    expect(parseMsg({ ...r, gridSize: 9 })).toBeNull();
    expect(parseMsg({ ...r, gridSize: 4.5 })).toBeNull();
  });

  it('lobby carries optional room defaults', () => {
    const l = { t: 'lobby', status: 'waiting', players: [] };
    expect(parseMsg({ ...l, defaults: { spokenLang: 'nah', uiLang: 'en' } })).not.toBeNull();
    expect(parseMsg({ ...l, defaults: { spokenLang: 'xx', uiLang: 'en' } })).toBeNull();
    expect(parseMsg({ ...l, defaults: { spokenLang: 'nah', uiLang: 'nah' } })).toBeNull();
  });

  it('validates choices, pick, pickResult, scores', () => {
    const call = { t: 'call', i: 0, cardId: 'x', at: 1 };
    expect(parseMsg(call)).toBeNull();
    expect(parseMsg({ ...call, choices: ['y', 'z', 'w'] })).toBeNull(); // missing cardId
    expect(parseMsg({ ...call, choices: ['x', 'x', 'z'] })).toBeNull(); // not distinct
    expect(parseMsg({ ...call, choices: ['x', 'z'] })).toBeNull();
    expect(parseMsg({ t: 'pick', seat: 'a', roundNo: 1, i: 0 })).toBeNull();
    expect(
      parseMsg({ t: 'pickResult', roundNo: 1, i: 0, seat: 'a', correct: true, first: true }),
    ).toBeNull();
    expect(
      parseMsg({
        t: 'pickResult',
        roundNo: 1,
        i: 0,
        seat: 'a',
        correct: true,
        points: 3,
        first: true,
      }),
    ).toBeNull();
    expect(parseMsg({ t: 'end', roundNo: 1, winners: [], reason: 'line' })).toBeNull();
    expect(parseMsg({ t: 'scores', roundNo: 1, points: { a: 201 } })).toBeNull();
    expect(parseMsg({ t: 'scores', roundNo: 1, points: { a: 1.5 } })).toBeNull();
    expect(parseMsg({ t: 'scores', roundNo: 1, points: {}, crossed: { a: 65 } })).toBeNull();
    expect(parseMsg({ t: 'scores', roundNo: 1, points: {}, crossed: { a: 1.5 } })).toBeNull();
    expect(parseMsg({ t: 'scores', roundNo: 1, points: {}, crossed: { a: -1 } })).toBeNull();
    const many = Object.fromEntries(Array.from({ length: 61 }, (_, i) => ['s' + i, 1]));
    expect(parseMsg({ t: 'scores', roundNo: 1, points: many })).toBeNull();
  });
  it('requires roundNo', () => {
    expect(parseMsg({ t: 'end', winners: [] })).toBeNull();
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 1, marks: [] })).toBeNull();
    expect(parseMsg({ t: 'round', seed: 's', speedSec: 5 })).toBeNull();
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
    };
    expect(parseMsg({ ...r, speedSec: 2 })).toBeNull();
    expect(parseMsg({ ...r, speedSec: Infinity })).toBeNull();
    expect(parseMsg({ ...r, speedSec: 61 })).toBeNull();
  });
  it('signed host-only set', () => {
    expect([...HOST_ONLY].sort()).toEqual(
      ['assign', 'call', 'callClosed', 'end', 'lobby', 'pickResult', 'round', 'scores'].sort(),
    );
  });
});
