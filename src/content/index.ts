import esUi from './i18n/es.json';
import enUi from './i18n/en.json';
import cardsJson from './cards.json';
import { deckFileSchema, type Card, type CardName } from './schema.ts';
import type { CardId, Lang } from './types.ts';
import { INDIGENOUS_LANGS, LANGS } from './types.ts';

export type { CardId, Category, Lang } from './types.ts';
export type { Card, CardName } from './schema.ts';
export { CATEGORIES, LANGS } from './types.ts';

/** From cards.json, validated at load, sorted by n. */
export const cards: Card[] = deckFileSchema.parse(cardsJson).cards.sort((a, b) => a.n - b.n);

const byId = new Map<CardId, Card>(cards.map((c) => [c.id, c]));

export function getCard(id: CardId): Card | undefined {
  return byId.get(id);
}

export function cardById(id: CardId): Card {
  const c = byId.get(id);
  if (!c) throw new Error(`unknown card id: ${id}`);
  return c;
}

const isIndigenous = (lang: Lang) => (INDIGENOUS_LANGS as readonly Lang[]).includes(lang);

function defaultHideUnreviewed(): boolean {
  // Keep the literal `import.meta.env` so Vite/Vitest can substitute it; undefined under plain Node.
  const env = import.meta.env as unknown as { VITE_HIDE_UNREVIEWED?: string } | undefined;
  return env?.VITE_HIDE_UNREVIEWED !== 'false';
}

/** Reglas D1: a word shows only if it carries a source (nah/yua/quz). */
function visibleName(card: Card, lang: Lang, hide: boolean): CardName | null {
  const n = card.names[lang];
  if (!n) return null;
  if (isIndigenous(lang) && hide && !n.source) return null;
  return n;
}

/** Every card needs a visible name in the language (reglas R-03 / D4). */
export function callableLangs(opts?: { hideUnreviewed?: boolean }): Lang[] {
  const hide = opts?.hideUnreviewed ?? defaultHideUnreviewed();
  return LANGS.filter((lang) => cards.every((c) => visibleName(c, lang, hide) !== null));
}

export function cardName(
  card: Card,
  lang: Lang,
  opts?: { hideUnreviewed?: boolean },
): { text: string; status: string } | null {
  const n = visibleName(card, lang, opts?.hideUnreviewed ?? defaultHideUnreviewed());
  return n ? { text: n.text, status: n.status } : null;
}

/**
 * The AI/dictionary label (reglas D1) must accompany any displayed or played nah/yua/quz
 * word that has not been approved by a native speaker.
 */
export function nameLabel(card: Card, lang: Lang): 'dictionary-ai-voice' | null {
  const n = card.names[lang];
  return isIndigenous(lang) && n?.source && n.status !== 'approved' ? 'dictionary-ai-voice' : null;
}

export function cardLabel(c: Card, lang: Lang): { text: string; aiVoice: boolean; weak: boolean } {
  const n = c.names[lang];
  return { text: n.text, aiVoice: isIndigenous(lang), weak: n.confidence === 'weak' };
}

/** Labels shown in the UI, from the ui catalog (`lang` section). */
export const LANG_LABEL: Record<Lang, string> = esUi.lang;
export const LANG_LABELS: Record<Lang, string> = LANG_LABEL;

export const LANG_COLORS: Record<Lang, string> = {
  es: 'var(--lang-es)',
  en: 'var(--lang-en)',
  nah: 'var(--lang-nah)',
  yua: 'var(--lang-yua)',
  quz: 'var(--lang-quz)',
};

/** UI string catalogs for i18next, namespace 'ui'. */
export const uiCatalogs = { es: esUi, en: enUi } as const;
export const UI_NAMESPACE = 'ui';
export { default as credits } from './credits.json';
