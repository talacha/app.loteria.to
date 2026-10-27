import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cards,
  cardsAvailableIn,
  availableCards,
  callableLangs,
  cardName,
  getCard,
  isAvoidedPair,
  langsForDeck,
  LANG_COLORS,
  LANG_LABELS,
} from './index.ts';
import { CATEGORIES, INDIGENOUS_LANGS, LANGS, LANG_PLAYABLE } from './types.ts';
import es from './i18n/es.json';
import en from './i18n/en.json';
import expansion from './expansion-manifest.json';

const keys = (o: unknown, p = ''): string[] =>
  o !== null && typeof o === 'object'
    ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

describe('deck', () => {
  it('preserves every original card id', () => {
    expect(cards.slice(0, 54).map((card) => card.id)).toEqual([
      'jaguar',
      'colibri',
      'llama',
      'condor',
      'mariposa',
      'guajolote',
      'tortuga',
      'rana',
      'serpiente',
      'maiz',
      'nopal',
      'frijol',
      'pina',
      'chile',
      'papa',
      'aguacate',
      'tomate',
      'girasol',
      'sol',
      'luna',
      'estrella',
      'lluvia',
      'rayo',
      'arcoiris',
      'nube',
      'viento',
      'cometa',
      'montana',
      'volcan',
      'manantial',
      'mar',
      'desierto',
      'selva',
      'cristal',
      'isla',
      'cueva',
      'olla',
      'cesto',
      'tambor',
      'adobe',
      'hilo',
      'canoa',
      'puente',
      'vela',
      'martillo',
      'casa',
      'milpa',
      'tienda',
      'plaza',
      'puerto',
      'pueblo',
      'escuela',
      'observatorio',
      'biblioteca',
    ]);
  });

  it('has 144 unique cards numbered 1..144 and retains the original 54 first', () => {
    expect(cards).toHaveLength(144);
    expect(new Set(cards.map((c) => c.id)).size).toBe(144);
    expect(cards.map((c) => c.n).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 144 }, (_, i) => i + 1),
    );
    expect(cards.slice(0, 54).every((card) => card.n <= 54)).toBe(true);
    expect(cards.slice(54).every((card) => card.n > 54)).toBe(true);
  });
  it('has 24 cards per category', () => {
    for (const cat of CATEGORIES) {
      const n = cards.filter((c) => c.category === cat).length;
      expect(n).toBe(24);
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
  it('has approved es/en names and retains bilingual copy on the original 54', () => {
    for (const c of cards.slice(0, 54)) {
      expect(c.names.es?.status).toBe('approved');
      expect(c.names.en?.status).toBe('approved');
      expect(c.verso?.es.split('\n')).toHaveLength(2);
      expect(c.riddle?.en.length).toBeGreaterThan(0);
    }
    for (const c of cards.slice(54)) {
      expect(c.names.es?.status).toBe('approved');
      expect(c.names.en?.status).toBe('approved');
      for (const lang of ['es', 'en'] as const) {
        expect(c.names[lang]?.audio).toMatch(
          new RegExp(`^/audio/${lang}/${c.id}\\.[0-9a-f]{8}\\.m4a$`),
        );
        expect(c.names[lang]?.audioReason).toBeUndefined();
      }
    }
  });
  it('has internally consistent clip metadata whenever a name has a generated clip', () => {
    for (const c of cards)
      for (const l of LANGS) {
        const n = c.names[l];
        if (!n?.audio) continue;
        expect(n?.audio).toMatch(new RegExp(`^/audio/${l}/${c.id}\\.[0-9a-f]{8}\\.m4a$`));
        expect(n?.clip?.file).toBe(n?.audio);
        expect(n?.clip?.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(n?.audio).toContain((n?.clip?.sha256 ?? '').slice(0, 8));
      }
  });
  it('preserves existing cjp and bzd records without requiring them on expansion cards', () => {
    expect(LANG_PLAYABLE.cjp).toBe(false);
    expect(LANG_PLAYABLE.bzd).toBe(false);
    for (const c of cards.slice(0, 54))
      for (const l of ['cjp', 'bzd'] as const) {
        const n = c.names[l];
        expect(n).toBeDefined();
        if (n!.text === null)
          expect(n).toMatchObject({ status: 'missing', audio: null, audioReason: 'missing-word' });
        else if (l === 'bzd')
          expect(n).toMatchObject({ audio: null, audioReason: 'needs-recording' });
        else expect(n!.clip?.engine).toBe('mms');
      }
  });
  it('requires sourced Indigenous names on existing cards and does not merge draft candidates', () => {
    for (const c of cards.slice(0, 54))
      for (const l of INDIGENOUS_LANGS) expect(c.names[l]?.source).toBeTruthy();
    for (const c of cards.slice(54))
      for (const l of INDIGENOUS_LANGS) expect(c.names[l]).toBeUndefined();
  });
});

describe('languages', () => {
  it('offers languages that have at least one approved voiced card', () => {
    expect(callableLangs({ hideUnreviewed: true })).toEqual([...LANGS]);
  });
  it('does not turn draft names into voiceable names when unreviewed is shown', () => {
    const langs = callableLangs({ hideUnreviewed: false });
    expect(langs).toEqual([...LANGS]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it('reads VITE_HIDE_UNREVIEWED from the env', () => {
    const c = getCard('jaguar')!;
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'false');
    expect(cardName(c, 'nah')).toEqual({ text: 'ocelotl', status: 'approved' });
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'true');
    expect(cardName(c, 'nah')).toEqual({ text: 'ocelotl', status: 'approved' });
    vi.unstubAllEnvs();
    expect(cardName(c, 'nah')?.text).toBe('ocelotl');
  });
  it('cardName honours the hideUnreviewed option', () => {
    expect(cardName(getCard('sol')!, 'quz', { hideUnreviewed: false })?.text).toBe('inti');
  });
  it('cardName returns null for missing names', () => {
    const c = getCard('cueva')!;
    expect(cardName(c, 'es')).toEqual({ text: 'La Cueva', status: 'approved' });
    expect(cardName(c, 'nah')?.status).toBe('approved');
    expect(cardName(getCard('perro')!, 'nah')).toBeNull();
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
  it('existing cards retain Indigenous names; expansion cards are absent until sourced and reviewed', () => {
    for (const c of cards.slice(0, 54))
      for (const l of INDIGENOUS_LANGS) {
        expect(c.names[l]?.status).toBe('approved');
        if (c.names[l]?.confidence !== 'high') expect(c.names[l]?.reviewQuestion).toBeTruthy();
      }
    for (const c of cards.slice(54))
      for (const l of INDIGENOUS_LANGS) expect(c.names[l]).toBeUndefined();
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
    expect(mk((c) => delete c.names.nah!.audio)).toBe(false);
    expect(mk((c) => delete c.names.es!.audio)).toBe(false);
    expect(mk((c) => delete c.names.quz)).toBe(true);
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

describe('144-card expansion manifest and availability', () => {
  it('matches the canonical expansion ids and the 12 reserve ids', () => {
    const proposed = expansion.proposed.map((item) => item.id);
    expect(proposed).toHaveLength(90);
    expect(cards.slice(54).map((card) => card.id)).toEqual(proposed);
    expect(expansion.reserve).toHaveLength(12);
    for (const item of expansion.proposed) expect(item.research.drafts.nah).toContain(item.id);
  });

  it('keeps candidate Indigenous names in draft files only and validates manifest counts', async () => {
    const langCounts: Record<string, Record<string, number>> = {};
    for (const lang of ['nah', 'yua', 'quz', 'bzd', 'cjp'] as const) {
      const file = await import(`./drafts/expansion/${lang}.json`);
      const draft = file.default as { cards: Record<string, { kind: string }> };
      langCounts[lang] = {};
      for (const item of expansion.proposed) {
        const candidate = draft.cards[item.id];
        expect(candidate).toBeDefined();
        langCounts[lang]![candidate!.kind] = (langCounts[lang]![candidate!.kind] ?? 0) + 1;
      }
      for (const id of expansion.proposed.map((item) => item.id))
        expect(getCard(id)?.names[lang as keyof (typeof cards)[number]['names']]).toBeUndefined();
      expect(langCounts[lang]).toEqual(expansion.coverage.languages[lang].counts);
    }
  });

  it('intersects cards by real approved names and clips, never substituting Spanish', () => {
    expect(availableCards('nah')).toHaveLength(54);
    expect(cardsAvailableIn(['nah', 'yua', 'quz'])).toHaveLength(54);
    expect(cardsAvailableIn(['es', 'nah']).every((card) => card.n <= 54)).toBe(true);
    expect(cardsAvailableIn(['nah', 'quz']).every((card) => card.n <= 54)).toBe(true);
    expect(
      cardsAvailableIn(['es', 'nah']).every((card) =>
        ['es', 'nah'].every((lang) =>
          Boolean(card.names[lang as keyof (typeof cards)[number]['names']]?.audio),
        ),
      ),
    ).toBe(true);
    const perro = getCard('perro')!;
    expect(langsForDeck(['perro'])).toEqual(
      LANGS.filter(
        (lang) => perro.names[lang]?.status === 'approved' && !!perro.names[lang]?.audio,
      ),
    );
    expect(langsForDeck(['perro'])).not.toContain('nah');
    expect(langsForDeck(cards.slice(0, 54).map((card) => card.id))).toEqual([...LANGS]);
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
