import { describe, expect, it } from 'vitest';
import { matcherProvider } from './hint.ts';

describe('matcherProvider', () => {
  it('matches held card', async () => {
    expect(await matcherProvider.pick({ cardId: 'a', audioOnly: false }, ['a', 'b'])).toEqual({
      cardId: 'a',
      confidence: 1,
    });
  });
  it('lower confidence for audio only', async () => {
    expect((await matcherProvider.pick({ cardId: 'a', audioOnly: true }, ['a'])).confidence).toBe(
      0.6,
    );
  });
  it('no match', async () => {
    expect(await matcherProvider.pick({ cardId: 'z', audioOnly: false }, ['a'])).toEqual({
      cardId: null,
      confidence: 0,
    });
    expect(await matcherProvider.pick({ audioOnly: false }, ['a'])).toEqual({
      cardId: null,
      confidence: 0,
    });
  });
});
