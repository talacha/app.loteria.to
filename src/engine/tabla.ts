import { cards } from '@content';
import type { CardId, Tabla } from './types';
import { rng, shuffle } from './rng';

export const TABLA_SIZE = 16;
export const MAX_PER_CATEGORY = 5;
export const PHONE_START_INDEX = 10000;
export const MAX_SHARED = 8;

export function tabla(seed: string, index: number): Tabla {
  const counts = new Map<string, number>();
  const out: CardId[] = [];
  for (const c of shuffle(cards, rng(`${seed}:tabla:${index}`))) {
    if (out.length === TABLA_SIZE) break;
    const n = counts.get(c.category) ?? 0;
    if (n >= MAX_PER_CATEGORY) continue;
    counts.set(c.category, n + 1);
    out.push(c.id);
  }
  return { index, cards: out };
}

/** R-06: first index >= startAt not taken whose tabla shares <= 8 cards with every taken one. */
export function pickTablaIndex(seed: string, taken: number[], startAt = PHONE_START_INDEX): number {
  const takenSet = new Set(taken);
  const others = taken.map((i) => new Set(tabla(seed, i).cards));
  for (let idx = startAt; ; idx++) {
    if (takenSet.has(idx)) continue;
    const mine = tabla(seed, idx).cards;
    if (others.every((o) => mine.filter((c) => o.has(c)).length <= MAX_SHARED)) return idx;
  }
}
