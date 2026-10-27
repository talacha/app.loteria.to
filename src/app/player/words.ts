import type { CardId, Lang } from '@engine';
import { getCard } from '@content';

/**
 * A card's word in the player's spoken language. All five languages are treated as
 * verified (rules.md §2.3), so this reads the name directly and never hides drafts.
 */
export function wordOf(id: CardId, lang: Lang): string {
  const c = getCard(id);
  if (!c) return id;
  return c.names[lang]?.text ?? c.names.es?.text ?? id;
}

export function emojiOf(id: CardId): string {
  const c = getCard(id);
  return c?.emoji ?? c?.art ?? '?';
}
