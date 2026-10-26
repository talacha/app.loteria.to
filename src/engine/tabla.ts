import type { CardId, Category, Tabla } from './types';
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
