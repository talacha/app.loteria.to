import type { Level, PatternId } from './types';
import { rng } from './rng';

const range = (n: number, f: (i: number) => number): number[] =>
  Array.from({ length: n }, (_, i) => f(i));

/** Winning index sets (catalogo.md section A). Cells are numbered row-major 0..15. */
export const PATTERNS: Record<PatternId, number[][]> = {
  line: [
    ...range(4, (r) => r).map((r) => range(4, (c) => r * 4 + c)),
    ...range(4, (c) => c).map((c) => range(4, (r) => r * 4 + c)),
    [0, 5, 10, 15],
    [3, 6, 9, 12],
  ],
  square: [
    [0, 1, 4, 5],
    [1, 2, 5, 6],
    [2, 3, 6, 7],
    [4, 5, 8, 9],
    [5, 6, 9, 10],
    [6, 7, 10, 11],
    [8, 9, 12, 13],
    [9, 10, 13, 14],
    [10, 11, 14, 15],
  ],
  corners: [[0, 3, 12, 15]],
  center: [[5, 6, 9, 10]],
  ele: [[0, 4, 8, 12, 13, 14, 15]],
  x: [[0, 3, 5, 6, 9, 10, 12, 15]],
  frame: [[0, 1, 2, 3, 4, 7, 8, 11, 12, 13, 14, 15]],
  full: [range(16, (i) => i)],
};

export const PATTERN_LEVEL: Record<PatternId, 'easy' | 'medium' | 'hard'> = {
  line: 'easy',
  square: 'easy',
  corners: 'medium',
  center: 'medium',
  ele: 'medium',
  x: 'medium',
  frame: 'hard',
  full: 'hard',
};

/** PatternId order. */
export const PATTERN_IDS = Object.keys(PATTERNS) as PatternId[];

/**
 * R-17: pick a figure of `level` with the host's secret; deterministic per (secret, round);
 * never the previous round's figure when the level has more than one.
 */
export function surpriseFigure(
  deckSecret: string,
  roundNo: number,
  level: Level,
  previous?: PatternId | null,
): PatternId {
  const all = PATTERN_IDS.filter((p) => level === 'any' || PATTERN_LEVEL[p] === level);
  const pool = all.length > 1 && previous ? all.filter((p) => p !== previous) : all;
  const r = rng(`${deckSecret}:figure:${roundNo}`);
  return pool[Math.floor(r() * pool.length)] as PatternId;
}
