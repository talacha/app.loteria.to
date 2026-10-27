import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cards } from '@content';
import {
  PATTERNS,
  PATTERN_LEVEL,
  checkClaim,
  codeMatchesRoom,
  deckOrder,
  decodeTablaCode,
  MAX_TABLA_INDEX,
  pickTablaIndex,
  roomCode,
  seedRef,
  surpriseFigure,
  tabla,
  tablaCode,
  type CardId,
  type PatternId,
} from './index';

const SEED = 'K7M2Q9R4T6V8X3Z1';
const ids = cards.map((c) => c.id);
const catOf = new Map(cards.map((c) => [c.id, c.category]));
const patternArb = fc.constantFrom(...(Object.keys(PATTERNS) as PatternId[]));
const seedArb = fc.string({ minLength: 1, maxLength: 20 });

describe('deck', () => {
  it('R-09.2 same seed, different deckSecret: other order, same tablas', () => {
    expect(deckOrder('secret-A', 1)).not.toEqual(deckOrder('secret-B', 1));
    expect(tabla(SEED, 3)).toEqual(tabla(SEED, 3));
  });
  it('deckOrder is a deterministic permutation of the 54 cards', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(30), (s, r) => {
        const a = deckOrder(s, r);
        expect(a).toEqual(deckOrder(s, r));
        expect([...a].sort()).toEqual([...ids].sort());
      }),
      { numRuns: 200 },
    );
  });
  it('golden: deck order does not drift', () => {
    expect(deckOrder('golden-secret', 1)).toMatchSnapshot();
  });
});

describe('tablas', () => {
  it('R-04.1 16 distinct cards, at most 5 per category (property)', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(40000), (s, i) => {
        const t = tabla(s, i);
        expect(t.cards).toHaveLength(16);
        expect(new Set(t.cards).size).toBe(16);
        const n: Record<string, number> = {};
        for (const id of t.cards) n[catOf.get(id)!] = (n[catOf.get(id)!] ?? 0) + 1;
        expect(Math.max(...Object.values(n))).toBeLessThanOrEqual(5);
        expect(t).toEqual(tabla(s, i));
      }),
      { numRuns: 300 },
    );
  });
  it('R-05.1 same seed and index give identical tablas in the same order', () => {
    expect(tabla(SEED, 3).cards).toEqual(tabla(SEED, 3).cards);
  });
  it('R-05.2 tabla 3 is the same in round 2 (no round input)', () => {
    expect(tabla(SEED, 3)).toEqual(tabla(SEED, 3));
    expect(tabla(SEED, 3).cards).not.toEqual(tabla(SEED, 4).cards);
  });
  it('golden: three tablas do not drift', () => {
    expect([tabla(SEED, 3), tabla(SEED, 10000), tabla('other', 0)]).toMatchSnapshot();
  });
  it('R-06.1 40 tablas from pickTablaIndex share at most 8 cards per pair', () => {
    const taken: number[] = [];
    for (let n = 0; n < 40; n++) taken.push(pickTablaIndex(SEED, taken));
    expect(new Set(taken).size).toBe(40);
    const ts = taken.map((i) => new Set(tabla(SEED, i).cards));
    for (let a = 0; a < 40; a++)
      for (let b = a + 1; b < 40; b++) {
        expect([...ts[a]!].filter((c) => ts[b]!.has(c)).length).toBeLessThanOrEqual(8);
      }
    expect(Math.min(...taken)).toBeGreaterThanOrEqual(10000);
  });
});

describe('figures', () => {
  const t = tabla(SEED, 5);
  const at = (cells: number[]): CardId[] => cells.map((c) => t.cards[c]!);
  it('R-16.1 line: column 2 called and marked is valid', () => {
    const c = at([2, 6, 10, 14]);
    expect(checkClaim(t, c, 'line', c)).toEqual({ valid: true, cells: [2, 6, 10, 14] });
  });
  it('R-16.2 square: block 9,10,13,14 called and marked is valid', () => {
    const c = at([9, 10, 13, 14]);
    expect(checkClaim(t, c, 'square', c).valid).toBe(true);
  });
  it('R-16.3 x missing cell 6 is almost, and cell 6 is missing', () => {
    const cells = PATTERNS.x[0]!.filter((c) => c !== 6);
    const r = checkClaim(t, at(cells), 'x', at(cells));
    expect(r).toEqual({ valid: false, missing: [t.cards[6]] });
  });
  it('R-16.4 PATTERNS equal catalogo.md section A cell by cell', () => {
    const expected: Record<PatternId, number[][]> = {
      line: [
        [0, 1, 2, 3],
        [4, 5, 6, 7],
        [8, 9, 10, 11],
        [12, 13, 14, 15],
        [0, 4, 8, 12],
        [1, 5, 9, 13],
        [2, 6, 10, 14],
        [3, 7, 11, 15],
        [0, 5, 10, 15],
        [3, 6, 9, 12],
      ],
      square: [
        [0, 1, 4, 5],
        [1, 2, 5, 6],
        [2, 3, 6, 7],
        [4, 5, 8, 9],
        [5, 6, 9, 10],
        [6, 7, 10, 11],
        [8, 9, 12, 13],
        [9, 10, 13, 14],
        [10, 11, 14, 15],
      ],
      corners: [[0, 3, 12, 15]],
      center: [[5, 6, 9, 10]],
      ele: [[0, 4, 8, 12, 13, 14, 15]],
      x: [[0, 3, 5, 6, 9, 10, 12, 15]],
      frame: [[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]],
      full: [Array.from({ length: 16 }, (_, i) => i)],
    };
    expect(PATTERNS).toEqual(expected);
    expect(PATTERN_LEVEL).toEqual({
      line: 'easy',
      square: 'easy',
      corners: 'medium',
      center: 'medium',
      ele: 'medium',
      x: 'medium',
      frame: 'hard',
      full: 'hard',
    });
  });
  it('R-17.1 surprise easy is line or square', () => {
    for (let r = 1; r < 50; r++)
      expect(['line', 'square']).toContain(surpriseFigure('s', r, 'easy'));
  });
  it('R-17.2 surprise medium never repeats the previous figure', () => {
    for (let r = 1; r < 100; r++)
      expect(surpriseFigure('s', r, 'medium', 'corners')).not.toBe('corners');
  });
  it('R-17.3 same secret and round give the same figure', () => {
    fc.assert(
      fc.property(
        seedArb,
        fc.nat(99),
        fc.constantFrom('easy', 'medium', 'hard', 'any' as const),
        (s, r, l) => {
          expect(surpriseFigure(s, r, l)).toBe(surpriseFigure(s, r, l));
        },
      ),
    );
  });
  it('R-18.1 corners called and marked, extra mark uncalled: valid', () => {
    const c = at([0, 3, 12, 15]);
    const extra = t.cards[7]!;
    expect(checkClaim(t, c, 'corners', [...c, extra])).toEqual({
      valid: true,
      cells: [0, 3, 12, 15],
    });
  });
  it('R-18.2 three corners called, fourth marked but not called: almost', () => {
    const c = at([0, 3, 12]);
    const r = checkClaim(t, c, 'corners', [...c, t.cards[15]!]);
    expect(r).toEqual({ valid: false, missing: [t.cards[15]] });
  });
  it('R-18.3 four corners called, one unmarked: almost, missing that one', () => {
    const c = at([0, 3, 12, 15]);
    expect(checkClaim(t, c, 'corners', c.slice(0, 3))).toEqual({
      valid: false,
      missing: [t.cards[15]],
    });
  });
  it('R-19.1 a pattern complete since call 20 is valid at call 25', () => {
    const c = at([0, 3, 12, 15]);
    const called = [...c, ...ids.filter((x) => !c.includes(x)).slice(0, 21)];
    expect(checkClaim(t, called, 'corners', c).valid).toBe(true);
  });
  it('checkClaim is never valid with an uncalled cell; marks required (property)', () => {
    fc.assert(
      fc.property(
        patternArb,
        fc.shuffledSubarray(ids),
        fc.shuffledSubarray(ids),
        (p, called, marks) => {
          const r = checkClaim(t, called, p, marks);
          if (r.valid) {
            for (const cell of r.cells!) {
              expect(called).toContain(t.cards[cell]);
              expect(marks).toContain(t.cards[cell]);
            }
          } else {
            for (const m of r.missing!) expect(called.includes(m) && marks.includes(m)).toBe(false);
          }
          const noMarks = checkClaim(t, called, p);
          if (r.valid) expect(noMarks.valid).toBe(true);
        },
      ),
      { numRuns: 300 },
    );
  });
  it('malformed tabla is never valid', () => {
    expect(checkClaim({ index: 0, cards: ['a'] }, ['a'], 'corners')).toEqual({
      valid: false,
      missing: [],
    });
  });
});

describe('catalogo section A simulation', () => {
  it('mean calls to first lotería with 40 players matches the catalogue (+-2)', () => {
    const expected: Record<PatternId, number> = {
      line: 13,
      square: 13,
      corners: 21,
      center: 21,
      ele: 32,
      x: 34,
      frame: 40,
      full: 44,
    };
    const sum: Record<string, number> = {};
    const ROUNDS = 2000;
    for (let r = 0; r < ROUNDS; r++) {
      const pos = new Map(deckOrder(`sim${r}`, 1).map((id, k) => [id, k + 1]));
      const best: Record<string, number> = {};
      for (let p = 0; p < 40; p++) {
        const when = tabla(`sim-seed-${r}`, p).cards.map((c) => pos.get(c)!);
        for (const pat of Object.keys(PATTERNS) as PatternId[]) {
          for (const set of PATTERNS[pat]) {
            let m = 0;
            for (const cell of set) m = Math.max(m, when[cell]!);
            if (!(pat in best) || m < best[pat]!) best[pat] = m;
          }
        }
      }
      for (const k of Object.keys(best)) sum[k] = (sum[k] ?? 0) + best[k]!;
    }
    const means = Object.fromEntries(
      Object.entries(sum).map(([k, v]) => [k, +(v / ROUNDS).toFixed(1)]),
    );
    console.log('mean calls to first lotería, 40 players:', JSON.stringify(means));
    for (const k of Object.keys(expected) as PatternId[]) {
      expect(Math.abs(means[k]! - expected[k])).toBeLessThanOrEqual(2);
    }
  }, 60000);
});

describe('codes', () => {
  const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  it('R-23.1 any single changed character is rejected; round-trips', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: MAX_TABLA_INDEX }), (s, i) => {
        const code = tablaCode(s, i);
        expect(decodeTablaCode(code)).toEqual({ ok: true, seedRef: seedRef(s), index: i });
        for (let p = 0; p < 6; p++)
          for (const ch of CROCKFORD)
            if (ch !== code[p])
              expect(decodeTablaCode(code.slice(0, p) + ch + code.slice(p + 1)).ok).toBe(false);
        for (let p = 0; p < 5; p++) {
          if (code[p] === code[p + 1]) continue;
          expect(
            decodeTablaCode(code.slice(0, p) + code[p + 1] + code[p] + code.slice(p + 2)).ok,
          ).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
  it('R-23 accepts lowercase, spaces, hyphens, O/I/L look-alikes', () => {
    const code = tablaCode('abc', 12345);
    const mangled = code.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l');
    expect(decodeTablaCode(mangled)).toEqual(decodeTablaCode(code));
    expect(decodeTablaCode(`${code.slice(0, 3)}-${code.slice(3)}`).ok).toBe(true);
    expect(decodeTablaCode(123 as unknown as string).ok).toBe(false);
  });
  it('R-23.2 a code from another room does not match this room', () => {
    const d = decodeTablaCode(tablaCode('room-A', 7));
    expect(codeMatchesRoom(d, 'room-A')).toBe(true);
    expect(seedRef('room-A')).not.toBe(seedRef('room-B'));
    expect(codeMatchesRoom(d, 'room-B')).toBe(false);
  });
  it('R-25 phone range 10000..32767 fits in a code', () => {
    expect(MAX_TABLA_INDEX).toBe(32767);
    expect(decodeTablaCode(tablaCode('s', 32767)).index).toBe(32767);
    expect(() => tablaCode('s', 32768)).toThrow();
  });
  it('roomCode is 5 chars without 0 O 1 I L, even with bad rng', () => {
    fc.assert(
      fc.property(fc.double({ noNaN: false }), (x) => {
        expect(roomCode(() => x)).toMatch(/^[^0O1IL]{5}$/);
      }),
    );
    expect(roomCode(() => NaN)).toHaveLength(5);
  });
});
