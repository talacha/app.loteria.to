import type { CardId, Category, Tabla } from './types';
import { MAX_TABLA_INDEX } from './codes';
import { rngFromString, shuffle } from './rng';
import { cmp } from './deck';

export const TABLA_SIZE = 16;
export const MAX_PER_CATEGORY = 5;
const MIN_PER_CATEGORY = 2;

export function tabla(
  seed: string,
  index: number,
  cards: { id: CardId; category: Category }[],
): Tabla {
  const unique = new Map<CardId, Category>();
  for (const c of cards) if (!unique.has(c.id)) unique.set(c.id, c.category);
  const sorted = [...unique]
    .map(([id, category]) => ({ id, category }))
    .sort((a, b) => cmp(a.id, b.id));
  const rng = rngFromString(`tabla|${seed}|${index}`);

  const byCat = new Map<Category, CardId[]>();
  for (const c of sorted) {
    const l = byCat.get(c.category);
    if (l) l.push(c.id);
    else byCat.set(c.category, [c.id]);
  }
  const catKeys = [...byCat.keys()].sort(cmp);
  const lists = catKeys.map((k) => shuffle(byCat.get(k) as CardId[], rng));

  const picked: CardId[] = [];
  const rest: { id: CardId; ci: number }[] = [];
  const counts = lists.map(() => 0);
  lists.forEach((l, ci) => {
    l.forEach((id, j) => {
      if (j < MIN_PER_CATEGORY) {
        picked.push(id);
        counts[ci] = (counts[ci] as number) + 1;
      } else rest.push({ id, ci });
    });
  });
  for (const r of shuffle(rest, rng)) {
    if (picked.length >= TABLA_SIZE) break;
    if ((counts[r.ci] as number) >= MAX_PER_CATEGORY) continue;
    counts[r.ci] = (counts[r.ci] as number) + 1;
    picked.push(r.id);
  }
  if (picked.length < TABLA_SIZE) {
    // Only reachable if the pool is too small; the first-pass quota never exceeds the cap.
    throw new Error('tabla: not enough cards to satisfy 16 unique with <=5 per category');
  }
  // First pass can overshoot 16 with many categories; trim after shuffling.
  return { index, cards: shuffle(picked, rng).slice(0, TABLA_SIZE) };
}

export const MAX_SHARED_CARDS = 8;
const MAX_ATTEMPTS = 300;

/**
 * Pick a tabla index for a new seat so it shares at most MAX_SHARED_CARDS (rules 4.2) with every
 * already `taken` index. Bounded search; if none qualifies, returns the least-overlapping candidate.
 * Deterministic in (seed, taken, cards) unless `rng` is supplied.
 */
export function pickTablaIndex(
  seed: string,
  taken: number[],
  cards: { id: CardId; category: Category }[],
  rng: () => number = rngFromString(`pick|${seed}|${taken.join(',')}`),
): number {
  const sets = taken.map((t) => new Set(tabla(seed, t, cards).cards));
  const used = new Set(taken);
  let best = -1;
  let bestWorst = Infinity;
  for (let n = 0; n < MAX_ATTEMPTS; n++) {
    const idx = Math.floor(rng() * (MAX_TABLA_INDEX + 1));
    if (used.has(idx)) continue;
    const t = tabla(seed, idx, cards).cards;
    let worst = 0;
    for (const s of sets) {
      let k = 0;
      for (const c of t) if (s.has(c)) k++;
      if (k > worst) worst = k;
    }
    if (worst <= MAX_SHARED_CARDS) return idx;
    if (worst < bestWorst) {
      bestWorst = worst;
      best = idx;
    }
  }
  return best;
}
