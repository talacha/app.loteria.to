export interface LeaderboardEntry {
  seat: string;
  name: string;
  glyph?: string;
  points: number;
  /** Squares crossed out. */
  crossed: number;
}

export type RankedEntry = LeaderboardEntry & { rank: number };

/** Points desc, then squares desc, then name. Equal points and squares share a rank (1, 1, 3). */
export function rankEntries(entries: readonly LeaderboardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort(
    (a, b) =>
      b.points - a.points ||
      b.crossed - a.crossed ||
      a.name.localeCompare(b.name, 'es') ||
      (a.seat < b.seat ? -1 : a.seat > b.seat ? 1 : 0),
  );
  let rank = 0;
  return sorted.map((e, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.points !== e.points || prev.crossed !== e.crossed) rank = i + 1;
    return { ...e, rank };
  });
}
