import cards from '../../content/cards.json';
import { SITE, type SeoLang } from './meta';

/** Only head rendering imports the catalog; invite middleware imports meta alone. */
export function catalogJsonLd(lang: SeoLang): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': `${SITE}/deck#cards`,
    name: lang === 'en' ? '144 lotería cards' : '144 cartas de lotería',
    numberOfItems: cards.length,
    itemListElement: cards.map((card, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Thing',
        '@id': `${SITE}/deck#card-${card.id}`,
        url: `${SITE}/deck#card-${card.id}`,
        image: `${SITE}/cards/${card.id}.webp`,
        name: card.names[lang].text,
        alternateName: card.names[lang === 'en' ? 'es' : 'en'].text,
      },
    })),
  };
}
