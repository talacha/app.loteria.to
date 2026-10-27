import { describe, expect, it } from 'vitest';
import cards from './cards.json';
import credits from './credits.json';

describe('credits provenance copy', () => {
  it('does not claim per-card citations while any Indigenous source is unverified', () => {
    const sources = cards.flatMap((card) =>
      (['nah', 'yua', 'quz'] as const).map((lang) => card.names[lang]?.source ?? ''),
    );
    const hasUnverifiedSource = sources.some((source) => /unverified/i.test(source));
    const notes = Object.values(credits.names.note).join('\n');

    if (hasUnverifiedSource) {
      expect(notes).not.toMatch(
        /(?:cited\s+(?:on|in)\s+each\s+card|cited\s+on\s+every\s+card|citad[oa]s?\s+en\s+cada\s+ficha)/i,
      );
    }
  });
});
