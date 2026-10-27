import index from '../../content/card-art.json';

export interface CardArtEntry {
  id: string;
  sha256: string;
  width: number;
  height: number;
}

const byId = new Map<string, CardArtEntry>((index as CardArtEntry[]).map((e) => [e.id, e]));

/** Entry for a card that has an illustration, else undefined. */
export function cardArtEntry(id: string): CardArtEntry | undefined {
  return byId.get(id);
}

/** '/cards/<id>.webp' when the illustration exists (src/content/card-art.json), else null. */
export function cardArtUrl(id: string): string | null {
  return byId.has(id) ? `/cards/${id}.webp` : null;
}
