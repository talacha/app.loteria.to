import type { Category, Lang } from '@engine';

export type { CardId, Category, Lang } from '@engine';

export const LANGS: Lang[] = ['es', 'en', 'nah', 'yua', 'quz'];
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
