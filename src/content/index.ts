import esUi from './i18n/es.json';
import enUi from './i18n/en.json';
import cardsJson from './cards.json';
import { cardsSchema, type Card } from './schema.ts';
import type { CardId, Lang } from './types.ts';
import { INDIGENOUS_LANGS, LANGS } from './types.ts';

export type { CardId, Category, Lang } from './types.ts';
export { CATEGORIES, LANGS, CONTENT_LANGS, LANG_PLAYABLE } from './types.ts';
export type { ContentLang } from './types.ts';

export type { Card } from './schema.ts';
export type NameStatus = 'draft' | 'reviewed' | 'approved';

/** Validated at module load; throws on malformed content. */
export const cards: Card[] = cardsSchema.parse(cardsJson);

const byId = new Map<CardId, Card>(cards.map((c) => [c.id, c]));

export function getCard(id: CardId): Card | undefined {
  return byId.get(id);
}

function hasPlayableName(card: Card, lang: Lang, allowUnreviewed = false): boolean {
  const name = card.names[lang];
  if (!name || name.text === null || !name.audio) return false;
  if (!allowUnreviewed && name.status !== 'approved') return false;
  // Preserve the published 54-card pool exactly. New Indigenous names remain gated on
  // attestation and a source until the community review process approves their entry.
  if (card.n <= 54) return true;
  if ((INDIGENOUS_LANGS as readonly Lang[]).includes(lang))
    return (name.kind === 'attested' || name.kind === 'loanword') && !!name.source;
  return true;
}

/** Cards with an approved, sourced name and a real clip in the requested language. */
export function availableCards(lang: Lang): Card[] {
  return cards.filter((card) => hasPlayableName(card, lang));
}

/** Cards callable in every language present in a room. */
export function cardsAvailableIn(langs: readonly Lang[]): Card[] {
  if (langs.length === 0) return [];
  return cards.filter((card) => langs.every((lang) => hasPlayableName(card, lang)));
}

/** Languages that can voice every id in an already frozen deck. */
export function langsForDeck(ids: readonly CardId[]): Lang[] {
  if (ids.some((id) => !byId.has(id))) return [];
  return LANGS.filter((lang) =>
    ids.every((id) => {
      const card = byId.get(id);
      return card !== undefined && hasPlayableName(card, lang);
    }),
  );
}

function defaultHideUnreviewed(): boolean {
  // Keep the literal `import.meta.env` so Vite/Vitest can substitute it; undefined under plain Node.
  const env = import.meta.env as unknown as { VITE_HIDE_UNREVIEWED?: string } | undefined;
  return env?.VITE_HIDE_UNREVIEWED !== 'false';
}

/** Languages with at least one currently voiceable card; use cardsAvailableIn for a room pool. */
export function callableLangs(opts?: { hideUnreviewed?: boolean }): Lang[] {
  const hide = opts?.hideUnreviewed ?? defaultHideUnreviewed();
  return LANGS.filter((lang) => cards.some((card) => hasPlayableName(card, lang, !hide)));
}

export function cardName(
  card: Card,
  lang: Lang,
  opts?: { hideUnreviewed?: boolean },
): { text: string; status: string } | null {
  const n = card.names[lang];
  if (!n || n.text === null) return null;
  const hide = opts?.hideUnreviewed ?? defaultHideUnreviewed();
  if (hide && (INDIGENOUS_LANGS as readonly Lang[]).includes(lang) && n.status === 'draft')
    return null;
  return { text: n.text, status: n.status };
}

/** Derived from the ui catalog (`lang` section). */
export const LANG_LABELS: Record<Lang, string> = esUi.lang;

/** UI string catalogs for i18next, namespace 'ui'. */
export const uiCatalogs = { es: esUi, en: enUi } as const;
export const UI_NAMESPACE = 'ui';
export { default as credits } from './credits.json';

/** True if any of `langs` (default all) lists the pair in avoidWith, or confusableWith lists it. */
export function isAvoidedPair(a: CardId, b: CardId, langs: readonly Lang[] = LANGS): boolean {
  const ca = byId.get(a);
  const cb = byId.get(b);
  if (!ca || !cb || a === b) return false;
  if (ca.confusableWith?.includes(b) || cb.confusableWith?.includes(a)) return true;
  return langs.some(
    (l) => ca.names[l]?.avoidWith?.includes(b) || cb.names[l]?.avoidWith?.includes(a),
  );
}

export const LANG_COLORS: Record<Lang, string> = {
  es: 'var(--lang-es)',
  en: 'var(--lang-en)',
  nah: 'var(--lang-nah)',
  yua: 'var(--lang-yua)',
  quz: 'var(--lang-quz)',
};
