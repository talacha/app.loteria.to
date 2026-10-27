import { afterEach, describe, expect, it, vi } from 'vitest';
import { cards, callableLangs, cardName, getCard, LANG_LABELS } from './index.ts';
import { CATEGORIES, INDIGENOUS_LANGS, LANGS } from './types.ts';
import es from './i18n/es.json';
import en from './i18n/en.json';

const keys = (o: unknown, p = ''): string[] =>
  o !== null && typeof o === 'object'
    ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

describe('deck', () => {
  it('has 54 unique cards numbered 1..54', () => {
    expect(cards).toHaveLength(54);
    expect(new Set(cards.map((c) => c.id)).size).toBe(54);
    expect(cards.map((c) => c.n).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 54 }, (_, i) => i + 1),
    );
  });
  it('has 7-11 cards per category', () => {
    for (const cat of CATEGORIES) {
      const n = cards.filter((c) => c.category === cat).length;
      expect(n).toBeGreaterThanOrEqual(7);
      expect(n).toBeLessThanOrEqual(11);
    }
  });
  it('includes the landing page cards', () => {
    for (const id of [
      'sol',
      'maiz',
      'colibri',
      'nopal',
      'luna',
      'llama',
      'frijol',
      'montana',
      'jaguar',
    ]) {
      expect(getCard(id)).toBeDefined();
    }
  });
  it('has approved es/en names and bilingual copy', () => {
    for (const c of cards) {
      expect(c.names.es?.status).toBe('approved');
      expect(c.names.en?.status).toBe('approved');
      expect(c.verso.es.split('\n')).toHaveLength(2);
      expect(c.riddle.en.length).toBeGreaterThan(0);
    }
  });
  it('never marks Indigenous names approved without audio and source', () => {
    for (const c of cards)
      for (const l of INDIGENOUS_LANGS) {
        const n = c.names[l];
        if (n?.status === 'approved') expect(n.audio && n.source).toBeTruthy();
      }
  });
});

describe('languages', () => {
  it('only es and en are callable when unreviewed is hidden', () => {
    expect(callableLangs({ hideUnreviewed: true })).toEqual(['es', 'en']);
  });
  it('requires a name on every card for a lang when not hiding', () => {
    const langs = callableLangs({ hideUnreviewed: false });
    expect(langs).toEqual(['es', 'en']);
    for (const l of INDIGENOUS_LANGS) {
      expect(cards.every((c) => c.names[l])).toBe(false);
    }
  });
  afterEach(() => vi.unstubAllEnvs());
  it('reads VITE_HIDE_UNREVIEWED from the env', () => {
    const c = getCard('jaguar')!;
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'false');
    expect(cardName(c, 'nah')).toEqual({ text: 'ocelotl', status: 'draft' });
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'true');
    expect(cardName(c, 'nah')).toBeNull();
    vi.unstubAllEnvs();
    expect(cardName(c, 'nah')).toBeNull();
  });
  it('cardName honours the hideUnreviewed option', () => {
    expect(cardName(getCard('sol')!, 'quz', { hideUnreviewed: false })?.text).toBe('inti');
  });
  it('cardName returns null for missing names', () => {
    const c = getCard('cueva')!;
    expect(cardName(c, 'es')).toEqual({ text: 'La Cueva', status: 'approved' });
    expect(cardName(c, 'nah')).toBeNull();
  });
  it('labels every lang', () => {
    for (const l of LANGS) expect(LANG_LABELS[l]).toBeTruthy();
  });
});

describe('confusableWith', () => {
  it('is symmetric', () => {
    for (const c of cards)
      for (const o of c.confusableWith ?? []) expect(getCard(o)?.confusableWith).toContain(c.id);
  });
});

describe('schema', () => {
  it('rejects unknown fields and bad art', async () => {
    const { cardSchema } = await import('./schema.ts');
    const base = structuredClone(cards[0]!);
    expect(cardSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, art: '👍🏽' }).success).toBe(false);
    expect(cardSchema.safeParse({ ...base, art: 'ab' }).success).toBe(false);
    expect(cardSchema.safeParse(base).success).toBe(true);
  });
});

describe('ui catalogs', () => {
  it('have key parity', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
  it('has gender-neutral Spanish player counts and lang labels', () => {
    expect(JSON.stringify(es)).not.toMatch(/jugador/i);
    expect(LANG_LABELS.quz).toBe('Quechua (Cusco-Collao)');
  });
  it('contain the required strings', () => {
    expect(es.lotto.shout).toBe('¡Lotería!');
    expect(es.lotto.almost).toBe('¡Casi!');
    expect(es.host.speeds).toEqual({ calm: 'Calmado', normal: 'Normal', fast: 'Rápido' });
  });
  it('avoid forbidden framing', () => {
    const text = JSON.stringify([es, en]).toLowerCase();
    for (const w of ['prize', 'premio', 'bet ', 'apuesta', 'chips', 'dinero', 'money']) {
      expect(text).not.toContain(w);
    }
  });
});
