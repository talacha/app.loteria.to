import type { CardId } from './types';
import { rngFromString, shuffle } from './rng';

export const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function deckOrder(roomSeed: string, roundNo: number, cardIds: CardId[]): CardId[] {
  const sorted = [...cardIds].sort(cmp);
  return shuffle(sorted, rngFromString(`deck|${roomSeed}|${roundNo}`));
}
