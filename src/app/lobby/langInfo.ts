import { cards, getCard, type Lang } from '@content';

/** Sample card used on the language picker (the sun). */
export function sampleWord(lang: Lang): string {
  const card = getCard('sol') ?? cards[0];
  return card?.names[lang]?.text ?? '';
}
