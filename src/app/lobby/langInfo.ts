import { cards, cardName, getCard, type Lang } from '@content';

/** Sample card used on the language picker (the sun). */
export function sampleWord(lang: Lang): string {
  const card = getCard('sol') ?? cards[0];
  if (!card) return '';
  return cardName(card, lang, { hideUnreviewed: false })?.text ?? '';
}

/** True while any of the language's names is not yet approved by speakers. */
export function langInReview(lang: Lang): boolean {
  return cards.some((c) => {
    const n = c.names[lang];
    return !n || n.status !== 'approved';
  });
}
