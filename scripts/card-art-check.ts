export interface IndexedArtwork {
  id: string;
  sha256: string;
  width: number;
  height: number;
}

/** A complete production catalog has one delivery-size illustration for every card. */
export function assertCatalogArt(
  index: readonly IndexedArtwork[],
  catalog: readonly { id: string }[],
): void {
  const byId = new Map(index.map((entry) => [entry.id, entry]));
  if (byId.size !== index.length) throw new Error('Duplicate card IDs in illustration index.');
  const missing = catalog.filter(({ id }) => !byId.has(id)).map(({ id }) => id);
  if (missing.length)
    throw new Error(`Missing catalog illustrations (${missing.length}): ${missing.join(', ')}`);
  for (const card of catalog) {
    const entry = byId.get(card.id)!;
    if (entry.width !== 600 || entry.height !== 900)
      throw new Error(
        `${card.id}: illustration must be 600×900, got ${entry.width}×${entry.height}.`,
      );
  }
}

/** Hash/dimension drift must be resolved before publishing an existing index. */
export function assertArtworkIndexMatches(
  index: readonly IndexedArtwork[],
  actual: readonly IndexedArtwork[],
): void {
  const byId = new Map(actual.map((entry) => [entry.id, entry]));
  if (
    index.length !== actual.length ||
    new Set(index.map((entry) => entry.id)).size !== index.length ||
    index.some((entry) => {
      const file = byId.get(entry.id);
      return (
        !file ||
        file.sha256 !== entry.sha256 ||
        file.width !== entry.width ||
        file.height !== entry.height
      );
    })
  )
    throw new Error(
      'Card art index is stale. Run pnpm cards:index after asset production finishes.',
    );
}
