import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { cards } from '@content';
import {
  evaluateNotInTabla,
  evaluateTap,
  practiceSummary,
  tabla,
  checkClaim,
  type TapInput,
} from './index';

const t = tabla('K7M2Q9R4T6V8X3Z1', 1);
const ids = cards.map((c) => c.id);
const off = ids.find((x) => !t.cards.includes(x))!;
const base = (o: Partial<TapInput>): TapInput => ({
  mode: 'practice',
  tabla: t,
  called: [t.cards[0]!, t.cards[1]!],
  current: t.cards[1]!,
  marks: [],
  cardId: t.cards[1]!,
  attempts: 0,
  ...o,
});

describe('player-side rules', () => {
  it('R-38.1 Jugar: tapping an uncalled card marks it with no feedback', () => {
    expect(evaluateTap(base({ mode: 'play', cardId: t.cards[9]! }))).toEqual({
      mark: true,
      feedback: null,
      attempts: 0,
    });
  });
  it('R-39.1 Practicar: tapping the card just called is ok and marks', () => {
    expect(evaluateTap(base({}))).toEqual({ mark: true, feedback: 'ok', attempts: 0 });
  });
  it('R-39.2 Practicar: an earlier called card is late and marks', () => {
    expect(evaluateTap(base({ cardId: t.cards[0]! }))).toEqual({
      mark: true,
      feedback: 'late',
      attempts: 0,
    });
  });
  it('R-39.3 Practicar: an uncalled card does not mark and counts an attempt', () => {
    expect(evaluateTap(base({ cardId: t.cards[9]! }))).toEqual({
      mark: false,
      feedback: 'wrong',
      attempts: 1,
    });
  });
  it('R-39.4 "No la tengo": ok when absent, an attempt when present', () => {
    const { cardId: _c, ...rest } = base({ current: off, called: [off] });
    void _c;
    expect(evaluateNotInTabla(rest)).toEqual({ mark: false, feedback: 'ok', attempts: 0 });
    const { cardId: _d, ...rest2 } = base({});
    void _d;
    expect(evaluateNotInTabla(rest2)).toEqual({ mark: false, feedback: 'wrong', attempts: 1 });
  });
  it('R-39.5 third wrong attempt reveals the card (or not-in-tabla)', () => {
    expect(evaluateTap(base({ cardId: t.cards[9]!, attempts: 2 }))).toMatchObject({
      attempts: 3,
      reveal: t.cards[1],
    });
    expect(
      evaluateTap(
        base({ current: off, called: [t.cards[0]!, off], cardId: t.cards[9]!, attempts: 2 }),
      ),
    ).toMatchObject({ reveal: 'not-in-tabla' });
    const { cardId: _c, ...rest } = base({ attempts: 2 });
    void _c;
    expect(evaluateNotInTabla(rest)).toMatchObject({ reveal: t.cards[1] });
  });
  it('R-39.6/R-40 Practicar never marks an uncalled card (property)', () => {
    fc.assert(
      fc.property(
        fc.shuffledSubarray(ids),
        fc.constantFrom(...ids),
        fc.constantFrom(null, ...ids),
        fc.nat(5),
        (called, cardId, current, attempts) => {
          const r = evaluateTap(base({ called, cardId, current, attempts }));
          if (r.mark) expect(called).toContain(cardId);
          expect(
            evaluateTap(base({ mode: 'play', called, cardId, current, attempts })).feedback,
          ).toBeNull();
        },
      ),
      { numRuns: 300 },
    );
  });
  it('R-40.1 marks made in Practicar are all called, so lotería validates like Jugar', () => {
    const corners = [0, 3, 12, 15].map((c) => t.cards[c]!);
    let marks: string[] = [];
    for (const c of corners) {
      const r = evaluateTap(base({ called: corners, cardId: c, current: c, marks }));
      if (r.mark) marks = [...marks, c];
    }
    expect(checkClaim(t, corners, 'corners', marks).valid).toBe(true);
  });
  it('R-41.1 12 heard, 9 first try, 3 helped', () => {
    const log = ids.slice(0, 12).map((cardId, k) => ({ cardId, firstTry: k < 9, helped: k >= 9 }));
    expect(practiceSummary(log)).toEqual({ heard: 12, firstTry: 9, review: ids.slice(9, 12) });
  });
});
