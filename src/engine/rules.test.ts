import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  ROOM_MIN_PLAYERS,
  ROOM_MAX_PLAYERS,
  crossedAfterCall,
  isCardComplete,
  resolveFullCardWinners,
  soloCpuPick,
  mulberry32,
  tabla,
  pickTablaIndex,
  MAX_SHARED_CARDS,
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
  it('first correct 2, others 1, wrong 0, repeats idempotent', () => {
    let st = initialPickState();
    let r = scorePick(st, { seat: 'a', i: 4, cardId: 'c1' }, call);
    expect(r.result).toEqual({ seat: 'a', i: 4, correct: false, points: 0, first: false });
    st = r.state;
    r = scorePick(st, { seat: 'a', i: 4, cardId: 'c9' }, call);
    expect(r.result).toMatchObject({ correct: true, points: 2, first: true });
    st = r.state;
    r = scorePick(st, { seat: 'b', i: 4, cardId: 'c9' }, call);
    expect(r.result).toEqual({ seat: 'b', i: 4, correct: true, points: 1, first: false });
    st = r.state;
    const again = scorePick(st, { seat: 'a', i: 4, cardId: 'c9' }, call);
    expect(again.state).toEqual(st);
    expect(again.result).toMatchObject({ points: 2, first: true });
    expect(st.points).toEqual({ a: 2, b: 1 });
  });
  it('allows at most 2 picks per seat per call', () => {
    let st = initialPickState();
    for (const c of ['c1', 'c2']) st = scorePick(st, { seat: 'a', i: 4, cardId: c }, call).state;
    const r = scorePick(st, { seat: 'a', i: 4, cardId: 'c9' }, call);
    expect(r.result.points).toBe(0);
    expect(r.state).toEqual(st);
  });
  it('a correct second try earns 1 if not first', () => {
    let st = scorePick(initialPickState(), { seat: 'b', i: 4, cardId: 'c9' }, call).state;
    st = scorePick(st, { seat: 'a', i: 4, cardId: 'c1' }, call).state;
    const r = scorePick(st, { seat: 'a', i: 4, cardId: 'c9' }, call);
    expect(r.result).toMatchObject({ correct: true, points: 1, first: false });
  });
  it('per call: one first, total = 2 + (n-1), each seat scores once', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom('a', 'b', 'c', 'd'), { maxLength: 20 }), (seats) => {
        let st = initialPickState();
        for (const seat of seats) st = scorePick(st, { seat, i: 4, cardId: 'c9' }, call).state;
        const n = new Set(seats).size;
        const total = Object.values(st.points).reduce((x, y) => x + y, 0);
        expect(total).toBe(n === 0 ? 0 : 2 + (n - 1));
        expect(Object.values(st.points).filter((p) => p === 2).length).toBe(n ? 1 : 0);
      }),
    );
  });
});

describe('crossing and full card', () => {
  const t = { index: 0, cards: Array.from({ length: 16 }, (_, i) => `c${i + 1}`) };
  it('crosses every called card on the tabla regardless of picks', () => {
    expect(crossedAfterCall(t, ['c3', 'zz', 'c1'])).toEqual(['c1', 'c3']);
    expect(crossedAfterCall(t, [])).toEqual([]);
  });
  it('is complete only with all 16', () => {
    expect(isCardComplete(t, t.cards)).toBe(true);
    expect(isCardComplete(t, t.cards.slice(1))).toBe(false);
    expect(isCardComplete(t, crossedAfterCall(t, [...t.cards, 'x']))).toBe(true);
  });
  it('resolveFullCardWinners: highest points, ties share', () => {
    expect(resolveFullCardWinners(['a', 'b'], { a: 3, b: 5 })).toEqual(['b']);
    expect(resolveFullCardWinners(['a', 'b', 'c'], { a: 5, b: 5, c: 1 })).toEqual(['a', 'b']);
    expect(resolveFullCardWinners(['a', 'b'], {})).toEqual(['a', 'b']);
    expect(resolveFullCardWinners([], { a: 1 })).toEqual([]);
  });
});

describe('room limits and soloCpuPick', () => {
  it('constants', () => {
    expect([ROOM_MIN_PLAYERS, ROOM_MAX_PLAYERS]).toEqual([2, 20]);
  });
  it('accuracy 0/1 are absolute and delay stays inside the window', () => {
    fc.assert(
      fc.property(fc.nat(1000), (n) => {
        const rng = mulberry32(n);
        expect(soloCpuPick({ accuracy: 1, rng }).correct).toBe(true);
        expect(soloCpuPick({ accuracy: 0, rng }).correct).toBe(false);
        const p = soloCpuPick({ accuracy: 0.5, rng });
        expect(p.delayMs(4000)).toBeGreaterThan(0);
        expect(p.delayMs(4000)).toBeLessThan(4000);
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

describe('pickTablaIndex', () => {
  const overlap = (s: string, a: number, b: number) => {
    const x = new Set(tabla(s, a, pool).cards);
    return tabla(s, b, pool).cards.filter((c) => x.has(c)).length;
  };
  it('20 assignments are distinct, share <= 8 cards, and are deterministic', () => {
    fc.assert(
      fc.property(seedArb, (s) => {
        const run = () => {
          const taken: number[] = [];
          for (let k = 0; k < 20; k++) taken.push(pickTablaIndex(s, taken, pool));
          return taken;
        };
        const t = run();
        expect(t).toEqual(run());
        expect(new Set(t).size).toBe(20);
        for (let a = 0; a < 20; a++)
          for (let b = a + 1; b < 20; b++)
            expect(overlap(s, t[a]!, t[b]!)).toBeLessThanOrEqual(MAX_SHARED_CARDS);
      }),
      { numRuns: 8 },
    );
  });
});
