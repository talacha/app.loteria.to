/** Workbox transform: enforce the complete install payload, rather than only individual files. */
export const PRECACHE_LIMIT_BYTES = 10 * 1024 * 1024;
export const CARD_ART_LIMIT_BYTES = 6_000_000;

export function assertPrecacheBudget(entries: readonly { url: string; size: number }[]): void {
  let total = 0;
  let art = 0;
  for (const entry of entries) {
    if (!Number.isFinite(entry.size) || entry.size < 0)
      throw new Error(`Invalid precache size for ${entry.url}`);
    total += entry.size;
    if (entry.url.replace(/^\//, '').startsWith('cards/')) art += entry.size;
  }
  if (art > CARD_ART_LIMIT_BYTES)
    throw new Error(`Card art is ${art} bytes; maximum is ${CARD_ART_LIMIT_BYTES} bytes.`);
  if (total >= PRECACHE_LIMIT_BYTES)
    throw new Error(
      `Precache is ${total} bytes; it must be below ${PRECACHE_LIMIT_BYTES} bytes (10 MiB).`,
    );
}

/** Retained historical clips stay on the CDN but do not inflate installation. */
export function filterUnusedAudio<T extends { url: string }>(
  entries: T[],
  activeAudio: ReadonlySet<string>,
): T[] {
  return entries.filter(({ url }) => {
    const path = '/' + url.replace(/^\//, '');
    return !path.startsWith('/audio/') || !path.endsWith('.m4a') || activeAudio.has(path);
  });
}
