import { cards } from '@content';
import type { CardId } from './types';
import { rng, shuffle } from './rng';

/** R-09: depends only on the host's secret and the round number, never the public seed. */
export function deckOrder(deckSecret: string, roundNo: number): CardId[] {
  return shuffle(
    cards.map((c) => c.id),
    rng(`${deckSecret}:deck:${roundNo}`),
  );
}
