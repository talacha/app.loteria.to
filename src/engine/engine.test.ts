import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  PATTERNS,
  checkClaim,
  deckOrder,
  decodeTablaCode,
  roomCode,
  seedRef,
  tabla,
  tablaCode,
  MAX_TABLA_INDEX,
  type Category,
} from './index';

const cats: Category[] = ['animals', 'plants_food', 'sky', 'land', 'handmade', 'places'];
const cards = Array.from({ length: 54 }, (_, i) => ({
  id: `c${i + 1}`,
  category: cats[i % 6] as Category,
}));
const ids = cards.map((c) => c.id);
const seedArb = fc.string({ minLength: 1, maxLength: 20 });
const idxArb = fc.integer({ min: 0, max: MAX_TABLA_INDEX });
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

describe('deckOrder', () => {
  it('is a deterministic permutation', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(50), (s, r) => {
        const a = deckOrder(s, r, ids);
        expect(a).toEqual(deckOrder(s, r, ids));
        expect([...a].sort()).toEqual([...ids].sort());
      }),
    );
  });
  it('differs across rounds', () => {
    expect(deckOrder('x', 1, ids)).not.toEqual(deckOrder('x', 2, ids));
  });
});

describe('tabla', () => {
  it('is deterministic, unique, capped per category', () => {
    fc.assert(
      fc.property(seedArb, idxArb, (s, i) => {
        const t = tabla(s, i, cards);
        expect(t).toEqual(tabla(s, i, cards));
        expect(t.index).toBe(i);
        expect(t.cards).toHaveLength(16);
        expect(new Set(t.cards).size).toBe(16);
        const counts: Record<string, number> = {};
        for (const id of t.cards) {
          const c = cards.find((x) => x.id === id)?.category as string;
          counts[c] = (counts[c] ?? 0) + 1;
        }
        expect(Math.max(...Object.values(counts))).toBeLessThanOrEqual(5);
      }),
      { numRuns: 200 },
    );
  });
});

describe('tablaCode', () => {
  it('round-trips', () => {
    fc.assert(
      fc.property(seedArb, idxArb, (s, i) => {
        const code = tablaCode(s, i);
        expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{6}$/);
        expect(decodeTablaCode(code)).toEqual({ ok: true, seedRef: seedRef(s), index: i });
      }),
    );
  });
  it('supports at least 4096 boards', () => {
    expect(decodeTablaCode(tablaCode('s', 4095)).index).toBe(4095);
  });
  it('detects any single-character typo', () => {
    fc.assert(
      fc.property(seedArb, idxArb, fc.nat(5), fc.nat(31), (s, i, pos, rep) => {
        const code = tablaCode(s, i);
        const ch = CROCKFORD[rep] as string;
        fc.pre(ch !== code[pos]);
        const bad = code.slice(0, pos) + ch + code.slice(pos + 1);
        expect(decodeTablaCode(bad).ok).toBe(false);
      }),
      { numRuns: 500 },
    );
  });
  it('normalizes case and look-alikes', () => {
    const code = tablaCode('abc', 1234);
    const mangled = code.toLowerCase().replace(/0/g, 'o').replace(/1/g, 'l');
    expect(decodeTablaCode(mangled)).toEqual(decodeTablaCode(code));
    expect(decodeTablaCode(code.replace(/1/g, 'I')).ok).toBe(true);
  });
  it('rejects bad length and chars', () => {
    expect(decodeTablaCode('ABC').ok).toBe(false);
    expect(decodeTablaCode('ABCDEU').ok).toBe(false);
  });
});

describe('roomCode', () => {
  it('is 5 chars without ambiguous letters', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (x) => {
        expect(roomCode(() => x)).toMatch(/^[^0O1IL]{5}$/);
      }),
    );
    expect(roomCode()).toMatch(/^[A-Z2-9]{5}$/);
  });
});

describe('checkClaim', () => {
  const t = tabla('s', 1, cards);
  it('has the right patterns', () => {
    expect(PATTERNS.line).toHaveLength(10);
    expect(PATTERNS.corners).toEqual([[0, 3, 12, 15]]);
    expect(PATTERNS.center).toEqual([[5, 6, 9, 10]]);
    expect(PATTERNS.full[0]).toHaveLength(16);
  });
  it('accepts a completed pattern', () => {
    const called = PATTERNS.corners[0]!.map((i) => t.cards[i]!);
    expect(checkClaim(t, called, 'corners')).toEqual({ valid: true, completedPattern: 'corners' });
  });
  it('requires marks when provided', () => {
    const called = PATTERNS.center[0]!.map((i) => t.cards[i]!);
    const r = checkClaim(t, called, 'center', called.slice(1));
    expect(r.valid).toBe(false);
    expect(r.missing).toEqual([]);
    expect(r.unmarked).toEqual([called[0]]);
  });
  it('rejects malformed tablas without fake ids', () => {
    expect(checkClaim({ index: 0, cards: ['a'] }, ['a'], 'corners')).toEqual({
      valid: false,
      missing: [],
    });
  });
  it('valid implies a fully called and marked set', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(['line', 'corners', 'center', 'full'] as const)),
        fc.shuffledSubarray(ids),
        fc.shuffledSubarray(ids),
        (p, called, marks) => {
          const r = checkClaim(t, called, p, marks);
          if (r.valid) {
            const ok = PATTERNS[p].some((set) =>
              set.every((i) => called.includes(t.cards[i]!) && marks.includes(t.cards[i]!)),
            );
            expect(ok).toBe(true);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
  it('has no false positives', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...(['line', 'corners', 'center', 'full'] as const)),
        fc.shuffledSubarray(ids),
        (p, called) => {
          const r = checkClaim(t, called, p);
          const cs = new Set(called);
          const truth = PATTERNS[p].some((set) => set.every((i) => cs.has(t.cards[i]!)));
          expect(r.valid).toBe(truth);
          if (!r.valid) {
            expect(r.missing!.length).toBeGreaterThan(0);
            for (const m of r.missing!) expect(cs.has(m)).toBe(false);
          }
        },
      ),
      { numRuns: 300 },
    );
  });
  it('reports the closest set as missing', () => {
    const row = [0, 1, 2, 3].map((i) => t.cards[i]!);
    const r = checkClaim(t, row.slice(0, 3), 'line');
    expect(r.missing).toEqual([row[3]]);
  });
});

describe('review fixes', () => {
  it('checksum detects all substitutions and adjacent transpositions', () => {
    fc.assert(
      fc.property(seedArb, idxArb, (s, i) => {
        const code = tablaCode(s, i);
        for (let p = 0; p < 6; p++) {
          for (const ch of CROCKFORD) {
            if (ch === code[p]) continue;
            expect(decodeTablaCode(code.slice(0, p) + ch + code.slice(p + 1)).ok).toBe(false);
          }
        }
        for (let p = 0; p < 5; p++) {
          if (code[p] === code[p + 1]) continue;
          const sw = code.slice(0, p) + code[p + 1] + code[p] + code.slice(p + 2);
          expect(decodeTablaCode(sw).ok).toBe(false);
        }
      }),
      { numRuns: 300 },
    );
  });
  it('supports index 4095 and rejects 4096', () => {
    expect(MAX_TABLA_INDEX).toBe(4095);
    expect(() => tablaCode('s', 4096)).toThrow();
  });
  it('host seedRef check rejects another seed', () => {
    const d = decodeTablaCode(tablaCode('room-A', 7));
    expect(d.seedRef).toBe(seedRef('room-A'));
    expect(seedRef('room-A')).not.toBe(seedRef('room-B'));
    expect(d.seedRef === seedRef('room-B')).toBe(false);
  });
  it('is independent of input order', () => {
    const rev = [...cards].reverse();
    expect(tabla('s', 3, rev)).toEqual(tabla('s', 3, cards));
    expect(deckOrder('s', 1, [...ids].reverse())).toEqual(deckOrder('s', 1, ids));
  });
  it('uses at least 4 categories', () => {
    for (let i = 0; i < 500; i++) {
      const cs = new Set(
        tabla('spread', i, cards).cards.map((id) => cards.find((c) => c.id === id)!.category),
      );
      expect(cs.size).toBeGreaterThanOrEqual(4);
    }
  });
  it('roomCode clamps bad rng', () => {
    expect(roomCode(() => NaN)).toHaveLength(5);
    expect(roomCode(() => -0.5)).toHaveLength(5);
    expect(roomCode(() => 5)).toHaveLength(5);
  });
  it('decode rejects non-strings', () => {
    expect(decodeTablaCode(123 as unknown as string).ok).toBe(false);
  });
});
