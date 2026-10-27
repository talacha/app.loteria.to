import { cardsAvailableIn } from '@content';
import type { Card, Lang } from '@content';
import { tabla } from '@engine';
import { cardArtUrl } from '../app/ui/cardArtIndex';
import { clampCount, GRID, type PrintOptions } from './layout';

/** Paper labels never borrow a word from another language. */
export function printPool(lang: Lang): Card[] {
  const pool = cardsAvailableIn([lang]);
  if (pool.length < GRID * GRID) throw new Error('Not enough covered cards for a printed board');
  return pool;
}

/** Only load pictures used by this PDF; repeated boards share one embedded illustration. */
export function printArt(opts: PrintOptions): { id: string; art: string; url: string | null }[] {
  const pool = printPool(opts.labelLang);
  const used = new Set<string>();
  for (let index = 0; index < clampCount(opts.count); index++)
    for (const id of tabla(opts.seed, index, pool).cards) used.add(id);
  return pool
    .filter((card) => used.has(card.id))
    .map((card) => ({
      id: card.id,
      art: card.art,
      url: cardArtUrl(card.id),
    }));
}
