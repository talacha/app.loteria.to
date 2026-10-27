import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  FIRST_CORRECT_POINTS,
  choicesFor,
  initialPickState,
  resolveWinners,
  scorePick,
  type Category,
} from './index';

const cats: Category[] = ['animals', 'plants_food', 'sky', 'land', 'handmade', 'places'];
const pool = Array.from({ length: 54 }, (_, i) => ({
  id: `c${i + 1}`,
  category: cats[i % 6] as Category,
}));
const catOf = (id: string) => pool.find((p) => p.id === id)!.category;
const seedArb = fc.string({ minLength: 1, maxLength: 12 });

describe('choicesFor', () => {
  it('is deterministic across pool order, contains correct once, 3 distinct', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(5), fc.nat(53), fc.nat(53), (s, r, i, k) => {
        const correct = `c${k + 1}`;
        const a = choicesFor(s, r, i, correct, pool);
        expect(a).toEqual(choicesFor(s, r, i, correct, [...pool].reverse()));
        expect(new Set(a).size).toBe(3);
        expect(a.filter((x) => x === correct)).toHaveLength(1);
      }),
    );
  });
  it('prefers other categories', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(53), (s, k) => {
        const correct = `c${k + 1}`;
        const a = choicesFor(s, 1, 0, correct, pool);
        for (const id of a) if (id !== correct) expect(catOf(id)).not.toBe(catOf(correct));
      }),
    );
  });
  it('respects exclude when satisfiable', () => {
    fc.assert(
      fc.property(seedArb, fc.nat(53), (s, k) => {
        const correct = `c${k + 1}`;
        // exclude pairs whose numbers differ by exactly 6 (same category neighbours)
        const exclude = (a: string, b: string) =>
          Math.abs(Number(a.slice(1)) - Number(b.slice(1))) <= 2;
        const a = choicesFor(s, 2, 3, correct, pool, exclude);
        for (const x of a) for (const y of a) if (x !== y) expect(exclude(x, y)).toBe(false);
      }),
    );
  });
  it('relaxes exclude instead of throwing', () => {
    const tiny = pool.slice(0, 3);
    expect(choicesFor('s', 1, 1, 'c1', tiny, () => true)).toHaveLength(3);
  });
  it('position of correct is not degenerate', () => {
    const counts = [0, 0, 0];
    for (let i = 0; i < 300; i++) counts[choicesFor('s', 1, i, 'c1', pool).indexOf('c1')]!++;
    for (const c of counts) expect(c).toBeGreaterThan(50);
  });
});

describe('scorePick', () => {
  const call = { i: 4, cardId: 'c9' };
  it('awards first correct only, wrong picks are inert, repeats idempotent', () => {
    let st = initialPickState();
    let r = scorePick(st, { seat: 'a', i: 4, cardId: 'c1', at: 0 }, call);
    expect(r.result).toEqual({ seat: 'a', i: 4, correct: false, first: false });
    st = r.state;
    r = scorePick(st, { seat: 'a', i: 4, cardId: 'c9', at: 1 }, call);
    expect(r.result.first).toBe(true);
    st = r.state;
    r = scorePick(st, { seat: 'b', i: 4, cardId: 'c9', at: 2 }, call);
    expect(r.result).toEqual({ seat: 'b', i: 4, correct: true, first: false });
    st = r.state;
    const again = scorePick(st, { seat: 'a', i: 4, cardId: 'c9', at: 3 }, call);
    expect(again.state).toEqual(st);
    expect(again.result.first).toBe(true);
    expect(st.points).toEqual({ a: FIRST_CORRECT_POINTS, b: 0 });
    expect(st.crossed).toEqual({ a: ['c9'], b: ['c9'] });
  });
  it('total points per call never exceed 2 and seats cross each card once', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c'), { maxLength: 20 }), (seats) => {
        let st = initialPickState();
        seats.forEach((seat, at) => {
          st = scorePick(st, { seat, i: 4, cardId: 'c9', at }, call).state;
        });
        const total = Object.values(st.points).reduce((x, y) => x + y, 0);
        expect(total).toBe(seats.length ? FIRST_CORRECT_POINTS : 0);
        for (const l of Object.values(st.crossed)) expect(l).toEqual(['c9']);
      }),
    );
  });
});

describe('resolveWinners', () => {
  it('returns top scorers, sharing ties', () => {
    expect(resolveWinners([])).toEqual([]);
    expect(
      resolveWinners([
        { seat: 'a', points: 2 },
        { seat: 'b', points: 4 },
      ]),
    ).toEqual(['b']);
    expect(
      resolveWinners([
        { seat: 'a', points: 2 },
        { seat: 'b', points: 2 },
      ]),
    ).toEqual(['a', 'b']);
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 6 }), { minLength: 1, maxLength: 8 }),
        (ps) => {
          const claims = ps.map((points, n) => ({ seat: `s${n}`, points }));
          const w = resolveWinners(claims);
          const max = Math.max(...ps);
          expect(w.length).toBe(ps.filter((p) => p === max).length);
          for (const s of w) expect(claims.find((c) => c.seat === s)!.points).toBe(max);
        },
      ),
    );
  });
});
