import type { Category, Lang } from '@engine';

export type { CardId, Category, Lang } from '@engine';

export const LANGS = ['es', 'en', 'nah', 'yua', 'quz'] as const satisfies readonly Lang[];
/** Languages present in the content. cjp and bzd are imported but not playable until the owner enables them. */
export const CONTENT_LANGS = [...LANGS, 'cjp', 'bzd'] as const;
export type ContentLang = (typeof CONTENT_LANGS)[number];
export const LANG_PLAYABLE: Record<ContentLang, boolean> = {
  es: true,
  en: true,
  nah: true,
  yua: true,
  quz: true,
  cjp: false,
  bzd: false,
};
export const CATEGORIES = [
  'animals',
  'plants_food',
  'sky',
  'land',
  'handmade',
  'places',
] as const satisfies readonly Category[];
export const INDIGENOUS_LANGS = ['nah', 'yua', 'quz'] as const satisfies readonly Lang[];
export const DECK_SIZE = 54;
