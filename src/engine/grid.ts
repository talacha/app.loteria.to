import { MAX_GRID, MIN_GRID, normalizeGrid } from './tabla';

/** Player counts the table is measured at; any count rounds up to the next one. */
const PLAYER_STEPS = [2, 4, 6, 8, 10, 12, 15, 20] as const;

/**
 * Smallest deck that can deal every player a cartón sharing at most floor(g²/2) cards with any
 * other, per grid size g (3..8), by player step. Measured by simulating `pickTablaIndex` over
 * many seeds with a six-group deck, plus one card of margin. The 20-player column is
 * 27, 38, 58, 80, 110, 138 cards (3x3..8x8).
 */
const MIN_DECK: Record<number, readonly number[]> = {
  3: [16, 19, 20, 21, 23, 23, 24, 27],
  4: [25, 29, 32, 34, 34, 35, 37, 38],
  5: [40, 48, 51, 54, 55, 55, 58, 58],
  6: [59, 67, 70, 73, 75, 77, 77, 80],
  7: [83, 92, 98, 102, 104, 105, 107, 110],
  8: [108, 122, 126, 129, 131, 132, 136, 138],
};

/** Cards the deck needs so `players` (1..20) can each get a g x g cartón. */
export function minDeckFor(grid: number, players: number): number {
  const g = normalizeGrid(grid);
  const n = Math.max(1, Math.min(20, Math.floor(players)));
  const step = PLAYER_STEPS.findIndex((s) => n <= s);
  return (MIN_DECK[g] as readonly number[])[step < 0 ? PLAYER_STEPS.length - 1 : step] as number;
}

/** Largest grid size (3..8) the deck supports for this many players; 0 when not even 3x3 fits. */
export function maxGridFor(deckSize: number, players: number): number {
  for (let g = MAX_GRID; g >= MIN_GRID; g--) if (deckSize >= minDeckFor(g, players)) return g;
  return 0;
}
