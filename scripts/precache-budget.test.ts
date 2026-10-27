import { describe, expect, it } from 'vitest';
import {
  assertPrecacheBudget,
  filterUnusedAudio,
  CARD_ART_LIMIT_BYTES,
  PRECACHE_LIMIT_BYTES,
} from './precache-budget';

describe('aggregate precache budget', () => {
  it('counts shell, fonts, illustrations and voices together', () => {
    expect(() =>
      assertPrecacheBudget([
        { url: 'assets/app.js', size: 2_000_000 },
        { url: 'cards/bee.webp', size: 5_000_000 },
        { url: 'audio/es/bee.hash.m4a', size: 4_000_000 },
      ]),
    ).toThrow(/Precache is 11000000/);
  });
  it('requires strictly less than 10 MiB', () => {
    expect(() =>
      assertPrecacheBudget([{ url: 'shell', size: PRECACHE_LIMIT_BYTES - 1 }]),
    ).not.toThrow();
    expect(() => assertPrecacheBudget([{ url: 'shell', size: PRECACHE_LIMIT_BYTES }])).toThrow(
      /10 MiB/,
    );
  });
  it('enforces the separate art budget even when total precache fits', () => {
    expect(() =>
      assertPrecacheBudget([{ url: '/cards/bee.webp', size: CARD_ART_LIMIT_BYTES + 1 }]),
    ).toThrow(/Card art/);
  });
  it('rejects unknown sizes instead of silently bypassing the cap', () => {
    expect(() => assertPrecacheBudget([{ url: 'broken', size: NaN }])).toThrow(
      /Invalid precache size/,
    );
  });
});

it('precaches referenced recordings while retaining historical clips only on the CDN', () => {
  const entries = [
    { url: 'audio/es/current.hash.m4a' },
    { url: 'audio/nah/old.m4a' },
    { url: 'audio/manifest.json' },
    { url: 'cards/bee.webp' },
  ];
  expect(filterUnusedAudio(entries, new Set(['/audio/es/current.hash.m4a']))).toEqual([
    entries[0],
    entries[2],
    entries[3],
  ]);
});
