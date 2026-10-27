// Shared by the client, prerender script and invite middleware. Keep this module
// free of DOM, React and the card catalog so the edge runtime stays small.
export const SITE = 'https://app.loteria.to';
export const SITE_NAME = 'Lotería de los Pueblos';
export const OG_DEFAULT = `${SITE}/og/default.png?v=2`;
export const OG_INVITE = `${SITE}/og/invite.png?v=2`;
export const OG_DEFAULT_ALT = 'Lotería de los Pueblos: juego de lotería y catálogo de 144 cartas.';
export const OG_INVITE_ALT = 'Invitación a una sala de Lotería de los Pueblos.';

export type SeoLang = 'es' | 'en';
export const PUBLIC_PATHS = ['/', '/deck', '/solo', '/print', '/creditos'] as const;
type PublicPath = (typeof PUBLIC_PATHS)[number];

export interface RouteSeo {
  title?: string;
  description: string;
  keywords?: string;
  /** Indexable page URL; private and unknown routes have no canonical. */
  canonical?: string;
  /** Private invitation URL for social previews only. */
  sharePath?: string;
  noindex: boolean;
  image: string;
  imageAlt: string;
}

export const HOME_TITLE = {
  es: 'Lotería en línea gratis · Lotería de los Pueblos',
  en: 'Free online lotería · Lotería de los Pueblos',
} as const;

const HOME_DESC = {
  es: 'Juega lotería gratis con familia y amistades, practica contra la computadora o imprime tablas en PDF. Explora 144 cartas en español e inglés, sin crear una cuenta.',
  en: 'Play free picture lotería with family and friends, practice against computer players or print PDF boards. Explore 144 Spanish and English cards. No account needed.',
} as const;

type PublicCopy = {
  title: Record<SeoLang, string>;
  description: Record<SeoLang, string>;
  keywords: Record<SeoLang, string>;
  image: string;
  imageAlt: Record<SeoLang, string>;
  label: Record<SeoLang, string>;
};
const PUBLIC_COPY: Record<PublicPath, PublicCopy> = {
  '/': {
    title: HOME_TITLE,
    description: HOME_DESC,
    keywords: {
      es: 'lotería en línea, lotería gratis, juego de lotería, lotería en familia, Lotería de los Pueblos',
      en: 'online lotería, free lotería, picture bingo, family game, Lotería de los Pueblos',
    },
    image: OG_DEFAULT,
    imageAlt: {
      es: OG_DEFAULT_ALT,
      en: 'Lotería de los Pueblos: picture lotería and a catalog of 144 cards.',
    },
    label: { es: 'Inicio', en: 'Home' },
  },
  '/deck': {
    title: {
      es: '144 cartas de lotería · Lotería de los Pueblos',
      en: '144 lotería cards · Lotería de los Pueblos',
    },
    description: {
      es: 'Explora las 144 cartas de Lotería de los Pueblos con nombres en español e inglés. Filtra animales, plantas y comida, cielo, tierra, objetos y lugares.',
      en: 'Explore all 144 Lotería de los Pueblos cards with Spanish and English names. Browse animals, plants and food, sky, land, handmade objects and places.',
    },
    keywords: {
      es: 'cartas de lotería, baraja de lotería, 144 cartas, nombres de cartas, lotería español inglés',
      en: 'lotería cards, lotería deck, 144 cards, picture bingo cards, Spanish English card names',
    },
    image: `${SITE}/og/deck.png?v=2`,
    imageAlt: {
      es: 'Catálogo de 144 cartas de Lotería de los Pueblos.',
      en: 'Catalog of 144 Lotería de los Pueblos cards.',
    },
    label: { es: 'Cartas', en: 'Cards' },
  },
  '/solo': {
    title: {
      es: 'Lotería contra la computadora · Lotería de los Pueblos',
      en: 'Play lotería solo · Lotería de los Pueblos',
    },
    description: {
      es: 'Practica lotería contra 1 a 3 jugadores de la computadora. Elige dificultad, tamaño de tabla, velocidad e idioma de las llamadas. Gratis y sin cuenta.',
      en: 'Practice lotería against 1 to 3 computer players. Choose the difficulty, board size, call speed and spoken language. Free to play, with no account needed.',
    },
    keywords: {
      es: 'lotería solo, lotería contra computadora, practicar lotería, juego de lotería gratis',
      en: 'solo lotería, lotería computer players, practice lotería, free picture bingo',
    },
    image: `${SITE}/og/solo.png?v=2`,
    imageAlt: {
      es: 'Lotería de los Pueblos para jugar contra la computadora.',
      en: 'Play Lotería de los Pueblos against computer players.',
    },
    label: { es: 'Jugar a solas', en: 'Play solo' },
  },
  '/print': {
    title: {
      es: 'Tablas de lotería para imprimir en PDF · Lotería de los Pueblos',
      en: 'Printable lotería boards in PDF · Lotería de los Pueblos',
    },
    description: {
      es: 'Genera tablas de lotería en PDF para imprimir y jugar con papel y frijoles. Prepara una partida en familia o en el aula con Lotería de los Pueblos.',
      en: 'Generate printable lotería boards as a PDF and play with paper and beans. Prepare a family or classroom game with Lotería de los Pueblos.',
    },
    keywords: {
      es: 'lotería para imprimir, tablas de lotería PDF, cartones de lotería, lotería en papel',
      en: 'printable lotería, lotería boards PDF, print picture bingo boards, classroom lotería',
    },
    image: `${SITE}/og/print.png?v=2`,
    imageAlt: {
      es: 'Tablas de Lotería de los Pueblos para imprimir en PDF.',
      en: 'Printable PDF boards for Lotería de los Pueblos.',
    },
    label: { es: 'Imprimir tablas', en: 'Print boards' },
  },
  '/creditos': {
    title: {
      es: 'Créditos y fuentes · Lotería de los Pueblos',
      en: 'Credits and sources · Lotería de los Pueblos',
    },
    description: {
      es: 'Consulta los créditos, fuentes y licencias de las ilustraciones, voces sintéticas, tipografías y software que usa Lotería de los Pueblos.',
      en: 'Read the credits, sources and licenses for the illustrations, synthetic voices, typefaces and software used by Lotería de los Pueblos.',
    },
    keywords: {
      es: 'Lotería de los Pueblos créditos, fuentes de cartas, licencias, voces sintéticas',
      en: 'Lotería de los Pueblos credits, card sources, licenses, synthetic voices',
    },
    image: `${SITE}/og/credits.png?v=2`,
    imageAlt: {
      es: 'Créditos y fuentes de Lotería de los Pueblos.',
      en: 'Credits and sources for Lotería de los Pueblos.',
    },
    label: { es: 'Créditos', en: 'Credits' },
  },
};

export const INVITE_DESC =
  'Únete a una sala de Lotería de los Pueblos desde tu teléfono y elige el idioma de las llamadas. Juega con familia y amistades, sin crear una cuenta.';
const INVITE_DESC_EN =
  'Join a Lotería de los Pueblos room from your phone and choose your spoken call language. Play with family and friends, with no account needed.';
/** Room codes: 5 chars, no I, L, O, 0 or 1. */
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;

export function inviteTitle(code: string | null, lang: SeoLang = 'es'): string {
  const title = lang === 'en' ? 'You are invited to play lotería!' : '¡Te invitaron a la Lotería!';
  return code ? `${title} · ${lang === 'en' ? 'Room' : 'Sala'} ${code}` : title;
}

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function isPrivatePath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === '/host' || p.startsWith('/host/') || p === '/r' || p.startsWith('/r/') || p === '/ui'
  );
}

export function routeSeo(pathname: string, lang: SeoLang): RouteSeo {
  const p = normalizePath(pathname);
  if (p.startsWith('/r/')) {
    const rawCode = p.slice(3).toUpperCase();
    const code = ROOM_CODE_RE.test(rawCode) ? rawCode : null;
    return {
      title: inviteTitle(code, lang),
      description: lang === 'en' ? INVITE_DESC_EN : INVITE_DESC,
      sharePath: code ? `/r/${code}` : undefined,
      noindex: true,
      image: OG_INVITE,
      imageAlt: lang === 'en' ? 'Invitation to a Lotería de los Pueblos room.' : OG_INVITE_ALT,
    };
  }
  const copy = PUBLIC_PATHS.includes(p as PublicPath) ? PUBLIC_COPY[p as PublicPath] : undefined;
  if (copy)
    return {
      title: copy.title[lang],
      description: copy.description[lang],
      keywords: copy.keywords[lang],
      canonical: p,
      noindex: false,
      image: copy.image,
      imageAlt: copy.imageAlt[lang],
    };
  return {
    description: 'Lotería de los Pueblos.',
    noindex: true,
    image: OG_DEFAULT,
    imageAlt: PUBLIC_COPY['/'].imageAlt[lang],
  };
}

export const FAQ_KEYS = ['how', 'langs', 'free', 'who'] as const;
export interface FaqItem {
  q: string;
  a: string;
}

/** Connected public entities. FAQ text must match what the home page renders. */
export function jsonLdFor(
  pathname: string,
  lang: SeoLang,
  title: string,
  faq: FaqItem[],
): object[] {
  const p = normalizePath(pathname);
  const seo = routeSeo(p, lang);
  if (seo.noindex || !seo.canonical) return [];
  const copy = PUBLIC_COPY[p as PublicPath];
  const url = `${SITE}${p}`;
  const pageId = `${url}#webpage`;
  const websiteId = `${SITE}/#website`;
  const appId = `${SITE}/#app`;
  const crumbsId = `${url}#breadcrumbs`;
  const imageId = `${url}#primaryimage`;
  const context = { '@context': 'https://schema.org' };
  const out: object[] = [
    {
      ...context,
      '@type': 'WebSite',
      '@id': websiteId,
      name: SITE_NAME,
      url: `${SITE}/`,
      inLanguage: ['es', 'en'],
    },
    {
      ...context,
      '@type': p === '/deck' ? 'CollectionPage' : p === '/creditos' ? 'AboutPage' : 'WebPage',
      '@id': pageId,
      url,
      name: seo.title ?? title,
      description: seo.description,
      inLanguage: lang,
      isPartOf: { '@id': websiteId },
      breadcrumb: { '@id': crumbsId },
      primaryImageOfPage: { '@id': imageId },
      about: { '@id': appId },
      ...(p === '/deck' ? { mainEntity: { '@id': `${SITE}/deck#cards` } } : {}),
      ...(p === '/' ? { mainEntity: { '@id': appId } } : {}),
    },
    {
      ...context,
      '@type': 'ImageObject',
      '@id': imageId,
      url: seo.image,
      contentUrl: seo.image,
      caption: seo.imageAlt,
      encodingFormat: 'image/png',
      width: 1200,
      height: 630,
    },
    {
      ...context,
      '@type': 'BreadcrumbList',
      '@id': crumbsId,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
        ...(p === '/'
          ? []
          : [{ '@type': 'ListItem', position: 2, name: copy.label[lang], item: url }]),
      ],
    },
    {
      ...context,
      '@type': 'WebApplication',
      '@id': appId,
      name: SITE_NAME,
      url: `${SITE}/`,
      description: HOME_DESC[lang],
      applicationCategory: 'GameApplication',
      operatingSystem: 'Any',
      browserRequirements: 'Requires a modern web browser',
      inLanguage: ['es', 'en'],
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      image: OG_DEFAULT,
      mainEntityOfPage: { '@id': `${SITE}/#webpage` },
    },
  ];
  if (p === '/' && faq.length)
    out.push({
      ...context,
      '@type': 'FAQPage',
      '@id': `${SITE}/#faq`,
      isPartOf: { '@id': pageId },
      inLanguage: lang,
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  return out;
}
