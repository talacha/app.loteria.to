import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cards,
  callableLangs,
  cardById,
  cardLabel,
  cardName,
  getCard,
  nameLabel,
  LANG_LABEL,
} from './index.ts';
import cardsJson from './cards.json';
import { cardSchema, deckFileSchema } from './schema.ts';
import { INDIGENOUS_LANGS, LANGS } from './types.ts';
import es from './i18n/es.json';
import en from './i18n/en.json';
import { validateContent } from '../../scripts/validate-content.ts';

const keys = (o: unknown, p = ''): string[] =>
  o !== null && typeof o === 'object'
    ? Object.entries(o).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k))
    : [p];

afterEach(() => vi.unstubAllEnvs());

describe('deck', () => {
  it('has 54 unique cards sorted by n', () => {
    expect(cards).toHaveLength(54);
    expect(new Set(cards.map((c) => c.id)).size).toBe(54);
    expect(cards.map((c) => c.n)).toEqual(Array.from({ length: 54 }, (_, i) => i + 1));
  });
  it('has a name in all five languages; nah/yua/quz carry a source', () => {
    for (const c of cards) {
      for (const l of LANGS) expect(c.names[l].text.length).toBeGreaterThan(0);
      for (const l of INDIGENOUS_LANGS) expect(c.names[l].source).toBeTruthy();
      expect(c.names.es.status).toBe('approved');
    }
  });
  it('validates clean', () => {
    expect(validateContent()).toEqual([]);
  });
  it('rejects broken decks', () => {
    const bad = (f: (d: typeof cardsJson) => void) => {
      const d = structuredClone(cardsJson);
      f(d);
      return deckFileSchema.safeParse(d).success;
    };
    expect(bad(() => {})).toBe(true);
    expect(bad((d) => d.cards.pop())).toBe(false);
    expect(bad((d) => (d.cards[1]!.id = d.cards[0]!.id))).toBe(false);
    expect(bad((d) => delete (d.cards[0]!.names as Record<string, unknown>).quz)).toBe(false);
    expect(cardSchema.safeParse({ ...cards[0], extra: 1 }).success).toBe(false);
  });
});

describe('lookup', () => {
  it('cardById throws on unknown ids, getCard returns undefined', () => {
    expect(cardById(cards[0]!.id)).toBe(cards[0]);
    expect(() => cardById('nope')).toThrow();
    expect(getCard('nope')).toBeUndefined();
  });
  it('cardLabel flags AI voice for nah/yua/quz and weak words', () => {
    const c = cards[0]!;
    expect(cardLabel(c, 'es').aiVoice).toBe(false);
    for (const l of INDIGENOUS_LANGS) {
      expect(cardLabel(c, l).aiVoice).toBe(true);
      expect(cardLabel(c, l).weak).toBe(c.names[l].confidence === 'weak');
    }
  });
});

describe('languages (reglas D1/D4)', () => {
  it('all five langs are callable, with the flag on or off', () => {
    expect(callableLangs({ hideUnreviewed: true })).toEqual([...LANGS]);
    expect(callableLangs({ hideUnreviewed: false })).toEqual([...LANGS]);
  });
  it('shows sourced drafts with the dictionary/AI label', () => {
    const c = cards[0]!;
    expect(cardName(c, 'nah')?.text).toBe(c.names.nah.text);
    expect(nameLabel(c, 'nah')).toBe('dictionary-ai-voice');
    expect(nameLabel(c, 'es')).toBeNull();
  });
  it('never shows an Indigenous name without a source when hiding', () => {
    const c = structuredClone(cards[0]!);
    delete c.names.yua.source;
    expect(cardName(c, 'yua')).toBeNull();
    expect(nameLabel(c, 'yua')).toBeNull();
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'false');
    expect(cardName(c, 'yua')?.text).toBe(c.names.yua.text);
  });
  it('labels every lang', () => {
    expect(LANG_LABEL.yua).toBe("Maaya t'aan");
    for (const l of LANGS) expect(LANG_LABEL[l]).toBeTruthy();
  });
});

describe('ui catalogs', () => {
  it('have key parity', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort());
  });
  it('contain the required strings', () => {
    expect(es.lotto.shout).toBe('¡Lotería!');
    expect(es.lotto.almost).toBe('¡Casi!');
    expect(es.host.speeds).toEqual({ calm: 'Calmado', normal: 'Normal', fast: 'Rápido' });
  });
  it('avoid forbidden framing and gendered player counts', () => {
    const text = JSON.stringify([es, en]).toLowerCase();
    for (const w of ['prize', 'premio', 'apuesta', 'chips', 'dinero', 'money', 'jugador']) {
      expect(text).not.toContain(w);
    }
  });
});
