import cards from '../../src/content/cards.json' with { type: 'json' };

/** Real card ids, read straight from the content file. */
export const CARD_IDS: ReadonlySet<string> = new Set(cards.map((c) => c.id));
