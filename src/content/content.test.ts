import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cards,
  callableLangs,
  cardName,
  getCard,
  isAvoidedPair,
  LANG_COLORS,
  LANG_LABELS,
} from './index.ts';
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
  it('offers all five langs when not hiding, since every card has a name', () => {
    const langs = callableLangs({ hideUnreviewed: false });
    expect(langs).toEqual([...LANGS]);
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

describe('coverage and avoid pairs', () => {
  it('every card has a draft name in every Indigenous lang', () => {
    for (const c of cards)
      for (const l of INDIGENOUS_LANGS) {
        expect(c.names[l]?.status).toBe('draft');
        if (c.names[l]?.confidence !== 'high') expect(c.names[l]?.reviewQuestion).toBeTruthy();
      }
  });
  it('isAvoidedPair uses confusableWith and per-lang avoidWith', () => {
    expect(isAvoidedPair('sol', 'estrella')).toBe(true);
    expect(isAvoidedPair('estrella', 'sol', ['es'])).toBe(true);
    expect(isAvoidedPair('sol', 'sol')).toBe(false);
    expect(isAvoidedPair('sol', 'nope')).toBe(false);
    let found = false;
    for (const c of cards)
      for (const l of INDIGENOUS_LANGS)
        for (const o of c.names[l]?.avoidWith ?? []) {
          found = true;
          expect(isAvoidedPair(c.id, o, [l])).toBe(true);
          expect(isAvoidedPair(o, c.id, [l])).toBe(true);
        }
    expect(found).toBe(true);
  });
  it('maps every lang to a css var', () => {
    for (const l of LANGS) expect(LANG_COLORS[l]).toBe(`var(--lang-${l})`);
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
  it('rejects bad Indigenous entries', async () => {
    const { cardsSchema } = await import('./schema.ts');
    const mk = (f: (c: (typeof cards)[number]) => void) => {
      const cs = structuredClone(cards);
      f(cs[0]!);
      return cardsSchema.safeParse(cs).success;
    };
    expect(mk(() => {})).toBe(true);
    expect(mk((c) => (c.names.nah!.status = 'approved'))).toBe(false);
    expect(mk((c) => delete c.names.quz)).toBe(false);
    expect(mk((c) => (c.names.yua!.avoidWith = ['nope']))).toBe(false);
    expect(mk((c) => (c.names.yua!.avoidWith = ['sol']))).toBe(false);
    expect(
      mk((c) => {
        c.names.nah!.confidence = 'low';
        delete c.names.nah!.reviewQuestion;
      }),
    ).toBe(false);
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
