import type { CardId, PatternId, Tabla } from './types';
import { PATTERNS } from './figures';

export function checkClaim(
  t: Tabla,
  called: CardId[],
  pattern: PatternId,
  marks?: CardId[],
): { valid: boolean; cells?: number[]; missing?: CardId[] } {
  if (t.cards.length !== 16 || t.cards.some((c) => c === undefined)) {
    return { valid: false, missing: [] };
  }
  const calledSet = new Set(called);
  const markSet = marks ? new Set(marks) : null;
  let best: CardId[] | null = null;
  for (const set of PATTERNS[pattern]) {
    const missing: CardId[] = [];
    for (const idx of set) {
      const id = t.cards[idx] as CardId;
      if (!calledSet.has(id) || (markSet && !markSet.has(id))) missing.push(id);
    }
    if (missing.length === 0) return { valid: true, cells: [...set] };
    if (!best || missing.length < best.length) best = missing;
  }
  return { valid: false, missing: best ?? [] };
}
