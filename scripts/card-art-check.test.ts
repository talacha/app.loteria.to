import { describe, expect, it } from 'vitest';
import { assertArtworkIndexMatches, assertCatalogArt } from './card-art-check';

const art = { id: 'bee', sha256: 'original', width: 600, height: 900 };
describe('production card illustration inventory', () => {
  it('rejects a partial inventory instead of quietly shipping emoji fallbacks', () => {
    expect(() => assertCatalogArt([art], [{ id: 'bee' }, { id: 'tree' }])).toThrow(
      /Missing catalog illustrations.*tree/,
    );
  });
  it('requires delivery dimensions and unique IDs', () => {
    expect(() => assertCatalogArt([{ ...art, width: 300 }], [{ id: 'bee' }])).toThrow(/600×900/);
    expect(() => assertCatalogArt([art, art], [{ id: 'bee' }])).toThrow(/Duplicate/);
  });
  it('rejects stale hashes, sizes and omitted files in a published index', () => {
    expect(() => assertArtworkIndexMatches([art], [{ ...art, sha256: 'replacement' }])).toThrow(
      /stale/,
    );
    expect(() => assertArtworkIndexMatches([art], [{ ...art, height: 800 }])).toThrow(/stale/);
    expect(() => assertArtworkIndexMatches([], [art])).toThrow(/stale/);
    expect(() => assertArtworkIndexMatches([art, art], [art, { ...art, id: 'tree' }])).toThrow(
      /stale/,
    );
  });
  it('accepts a complete up-to-date catalog independently of entry order', () => {
    const tree = { ...art, id: 'tree' };
    expect(() => assertCatalogArt([tree, art], [{ id: 'bee' }, { id: 'tree' }])).not.toThrow();
    expect(() => assertArtworkIndexMatches([tree, art], [art, tree])).not.toThrow();
  });
});
