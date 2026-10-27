import type { CardId, Category, Tabla } from './types';
import { MAX_TABLA_INDEX } from './codes';
import { rngFromString, shuffle } from './rng';
import { cmp } from './deck';

export const TABLA_SIZE = 16;
export const DEFAULT_GRID = 4;
export const MIN_GRID = 3;
export const MAX_GRID = 8;
export const MAX_PER_CATEGORY = 5;
const MIN_PER_CATEGORY = 2;

/** Clamp to a whole g in 3..8 (anything else is the default 4). */
export function normalizeGrid(g: unknown): number {
  return typeof g === 'number' && Number.isInteger(g) && g >= MIN_GRID && g <= MAX_GRID
    ? g
    : DEFAULT_GRID;
}
/** Squares on a g x g cartón. */
export const gridCells = (g: number): number => g * g;
/** At most this many of one group on a cartón: today's 5 of 16, scaled. */
export const maxPerCategory = (g: number): number => Math.ceil((g * g * 5) / TABLA_SIZE);
/** Two cartones in a room may share at most this many cards: today's 8 of 16, scaled. */
export const maxShared = (g: number): number => Math.floor((g * g) / 2);

export function tabla(
  seed: string,
  index: number,
  cards: { id: CardId; category: Category }[],
  grid: number = DEFAULT_GRID,
): Tabla {
  const g = normalizeGrid(grid);
  const size = g * g;
  const cap = maxPerCategory(g);
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
    if (picked.length >= size) break;
    if ((counts[r.ci] as number) >= cap) continue;
    counts[r.ci] = (counts[r.ci] as number) + 1;
    picked.push(r.id);
  }
  if (picked.length < size) {
    // The per-group cap cannot be met by this deck: relax it rather than fail.
    const have = new Set(picked);
    for (const r of rest) {
      if (picked.length >= size) break;
      if (!have.has(r.id)) {
        have.add(r.id);
        picked.push(r.id);
      }
    }
  }
  if (picked.length < size) {
    throw new Error(`tabla: not enough cards for ${size} unique squares`);
  }
  // First pass can overshoot with many categories; trim after shuffling.
  return { index, cards: shuffle(picked, rng).slice(0, size) };
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
  grid: number = DEFAULT_GRID,
): number {
  const cap = maxShared(grid);
  const sets = taken.map((t) => new Set(tabla(seed, t, cards, grid).cards));
  const used = new Set(taken);
  let best = -1;
  let bestWorst = Infinity;
  for (let n = 0; n < MAX_ATTEMPTS; n++) {
    const idx = Math.floor(rng() * (MAX_TABLA_INDEX + 1));
    if (used.has(idx)) continue;
    const t = tabla(seed, idx, cards, grid).cards;
    let worst = 0;
    for (const s of sets) {
      let k = 0;
      for (const c of t) if (s.has(c)) k++;
      if (k > worst) worst = k;
    }
    if (worst <= cap) return idx;
    if (worst < bestWorst) {
      bestWorst = worst;
      best = idx;
    }
  }
  return best;
}
