import { describe, expect, it } from 'vitest';
import { parseMsg } from './messages.ts';

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
      },
      { t: 'call', i: 0, cardId: 'gallo', lang: 'nah', at: 1 },
      { t: 'claimResult', seat: 'a', valid: false, missing: ['x'] },
      { t: 'end', winners: ['a'] },
      { t: 'hello', seat: 'a', name: 'Ana', glyph: '*', labelLang: 'es' },
      { t: 'claim', seat: 'a', tablaIndex: 3, marks: ['x'] },
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
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 99999, marks: [] })).toBeNull();
    expect(parseMsg({ t: 'claim', seat: 'a', tablaIndex: 1, marks: ['x', 'x'] })).toBeNull();
    expect(parseMsg({ t: 'end', winners: ['a', 'a'] })).toBeNull();
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
