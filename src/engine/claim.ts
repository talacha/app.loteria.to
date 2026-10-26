import type { CardId, PatternId, Tabla } from './types';

const range = (n: number, f: (i: number) => number): number[] =>
  Array.from({ length: n }, (_, i) => f(i));

export const PATTERNS: Record<PatternId, number[][]> = {
  line: [
    ...range(4, (r) => r).map((r) => range(4, (c) => r * 4 + c)),
    ...range(4, (c) => c).map((c) => range(4, (r) => r * 4 + c)),
    [0, 5, 10, 15],
    [3, 6, 9, 12],
  ],
  corners: [[0, 3, 12, 15]],
  center: [[5, 6, 9, 10]],
  full: [range(16, (i) => i)],
};

export function checkClaim(
  t: Tabla,
  called: CardId[],
  pattern: PatternId,
  marks?: CardId[],
): { valid: boolean; completedPattern?: PatternId; missing?: CardId[]; unmarked?: CardId[] } {
  if (t.cards.length !== 16 || t.cards.some((c) => c === undefined)) {
    return { valid: false, missing: [] };
  }
  const calledSet = new Set(called);
  const markSet = marks ? new Set(marks) : null;
  let best: { missing: CardId[]; unmarked: CardId[] } | null = null;
  for (const set of PATTERNS[pattern]) {
    const missing: CardId[] = [];
    const unmarked: CardId[] = [];
    for (const idx of set) {
      const id = t.cards[idx] as CardId;
      if (!calledSet.has(id)) missing.push(id);
      else if (markSet && !markSet.has(id)) unmarked.push(id);
    }
    if (missing.length === 0 && unmarked.length === 0) {
      return { valid: true, completedPattern: pattern };
    }
    if (!best || missing.length + unmarked.length < best.missing.length + best.unmarked.length) {
      best = { missing, unmarked };
    }
  }
  const out: { valid: false; missing: CardId[]; unmarked?: CardId[] } = {
    valid: false,
    missing: best?.missing ?? [],
  };
  if (markSet) out.unmarked = best?.unmarked ?? [];
  return out;
}
