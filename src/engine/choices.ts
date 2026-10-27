import type { CardId, Category } from './types';
import { rngFromString, shuffle } from './rng';
import { cmp } from './deck';

/**
 * Three picture choices for call `i`: `correct` plus two distractors.
 * Deterministic in (seed, roundNo, i, correct, pool as a set); pool order is irrelevant.
 *
 * Distractors minimise, in order: (1) `exclude` violations among the pairs
 * (correct, a), (correct, b), (a, b) -- zero whenever satisfiable; if the pool cannot
 * satisfy `exclude`, the least-bad pair is used instead of throwing; (2) how many
 * share the correct card's category (rules 3.6); (3) shuffled order. The final
 * three positions are shuffled deterministically. Throws only if the pool has
 * fewer than two cards besides `correct`.
 */
export function choicesFor(
  seed: string,
  roundNo: number,
  i: number,
  correct: CardId,
  pool: { id: CardId; category: Category }[],
  exclude?: (a: CardId, b: CardId) => boolean,
): [CardId, CardId, CardId] {
  const unique = new Map<CardId, Category>();
  for (const c of pool) if (!unique.has(c.id)) unique.set(c.id, c.category);
  const sorted = [...unique.keys()].sort(cmp);
  const correctCat = unique.get(correct);
  const rng = rngFromString(`choices|${seed}|${roundNo}|${i}|${correct}`);
  const cands = shuffle(
    sorted.filter((id) => id !== correct),
    rng,
  );
  if (cands.length < 2) throw new Error('choicesFor: pool needs at least 3 distinct cards');
  const ex = (a: CardId, b: CardId): number =>
    exclude && (exclude(a, b) || exclude(b, a)) ? 1 : 0;
  const same = (id: CardId): number =>
    correctCat !== undefined && unique.get(id) === correctCat ? 1 : 0;

  let best: [CardId, CardId] | null = null;
  let bestKey = Infinity;
  for (let a = 0; a < cands.length; a++) {
    for (let b = a + 1; b < cands.length; b++) {
      const x = cands[a] as CardId;
      const y = cands[b] as CardId;
      const key = (ex(correct, x) + ex(correct, y) + ex(x, y)) * 4 + same(x) + same(y);
      if (key < bestKey) {
        bestKey = key;
        best = [x, y];
      }
    }
  }
  const [x, y] = best as [CardId, CardId];
  const out = shuffle([correct, x, y], rng);
  return [out[0] as CardId, out[1] as CardId, out[2] as CardId];
}
