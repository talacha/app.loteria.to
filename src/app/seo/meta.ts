// Pure SEO data shared by the Shell (client), the prerender script and the invite middleware.
// No DOM, no React: it must stay importable from Node and the edge runtime.

export const SITE = 'https://app.loteria.to';
export const SITE_NAME = 'Lotería de los Pueblos';
export const OG_DEFAULT = `${SITE}/og/default.png`;
export const OG_INVITE = `${SITE}/og/invite.png`;
export const OG_DEFAULT_ALT =
  'Lotería de los Pueblos: un cartón de lotería con dibujos y los cinco idiomas: náhuatl, maya yucateco, quechua, español e inglés.';
export const OG_INVITE_ALT = 'Invitación a una sala de Lotería de los Pueblos.';

export type SeoLang = 'es' | 'en';

export interface RouteSeo {
  /** Document title when it differs from the Shell's `<page> · <app>` pattern. */
  title?: string;
  description: string;
  /** Path the canonical URL points to; omitted for private routes. */
  canonical?: string;
  noindex: boolean;
  image: string;
  imageAlt: string;
}

export const HOME_TITLE = {
  es: 'Lotería de los Pueblos — la lotería en cinco idiomas',
  en: 'Lotería de los Pueblos — the lotería in five languages',
} as const;

const HOME_DESC = {
  es: 'Lotería de imágenes para jugar en familia desde tu teléfono. Las voces sintéticas cantan en cinco idiomas; los borradores de nombres en lenguas originarias aún no se verifican. Gratis, sin cuentas.',
  en: 'Picture lotería to play with family from your phone. Synthetic voices call cards in five languages; Indigenous-language name drafts remain unverified. Free, no accounts.',
} as const;

const DESC: Record<string, Record<SeoLang, string>> = {
  '/deck': {
    es: 'Las 54 cartas de la baraja: ilustraciones originales inspiradas en la naturaleza, los oficios y los lugares de Mesoamérica y los Andes, con su nombre en cinco idiomas.',
    en: 'All 54 cards of the deck: original illustrations inspired by the nature, crafts and places of Mesoamerica and the Andes, each named in five languages.',
  },
  '/creditos': {
    es: 'Créditos de Lotería de los Pueblos: ilustraciones, voces sintéticas (Meta MMS-TTS, CC BY-NC 4.0), tipografías, software libre y colaboradores.',
    en: 'Credits for Lotería de los Pueblos: illustrations, synthetic voices (Meta MMS-TTS, CC BY-NC 4.0), typefaces, open-source software and contributors.',
  },
  '/solo': {
    es: 'Juega lotería sin conexión contra 1 a 3 jugadores de la computadora. Elige dificultad, velocidad y el idioma en que se cantan las cartas.',
    en: 'Play lotería offline against 1 to 3 computer players. Pick the difficulty, the speed and the language the cards are called in.',
  },
  '/print': {
    es: 'Genera cartones de lotería en PDF para jugar con papel y frijoles, sin teléfonos. Funciona sin conexión.',
    en: 'Generate lotería boards as PDF to play with paper and beans, no phones needed. Works offline.',
  },
};

export const INVITE_DESC =
  'Toca para unirte desde tu teléfono y elige en qué idioma escuchar las cartas: náhuatl, maya, quechua, español o inglés.';

/** Room codes: 5 chars, no I, L, O, 0 or 1. */
export const ROOM_CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;

export function inviteTitle(code: string | null): string {
  return code ? `¡Te invitaron a la Lotería! · Sala ${code}` : '¡Te invitaron a la Lotería!';
}

export function normalizePath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '');
  return p === '' ? '/' : p;
}

export function isPrivatePath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === '/host' || p.startsWith('/host/') || p.startsWith('/r/') || p === '/ui';
}

export function routeSeo(pathname: string, lang: SeoLang): RouteSeo {
  const p = normalizePath(pathname);
  if (p === '/') {
    return {
      title: HOME_TITLE[lang],
      description: HOME_DESC[lang],
      canonical: '/',
      noindex: false,
      image: OG_DEFAULT,
      imageAlt: OG_DEFAULT_ALT,
    };
  }
  if (p.startsWith('/r/')) {
    const code = p.slice(3).toUpperCase();
    return {
      title: inviteTitle(ROOM_CODE_RE.test(code) ? code : null),
      description: INVITE_DESC,
      noindex: true,
      image: OG_INVITE,
      imageAlt: OG_INVITE_ALT,
    };
  }
  const known = DESC[p];
  return {
    description: known ? known[lang] : HOME_DESC[lang],
    canonical: known ? p : undefined,
    noindex: !known,
    image: OG_DEFAULT,
    imageAlt: OG_DEFAULT_ALT,
  };
}

export const FAQ_KEYS = ['how', 'langs', 'free', 'who'] as const;

export interface FaqItem {
  q: string;
  a: string;
}

/** JSON-LD graph for a route. `faq` must be the same text the page renders. */
export function jsonLdFor(
  pathname: string,
  lang: SeoLang,
  title: string,
  faq: FaqItem[],
): object[] {
  const p = normalizePath(pathname);
  const crumb = (name: string, path: string): object => ({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: SITE_NAME, item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name, item: `${SITE}${path}` },
    ],
  });
  if (p === '/') {
    const out: object[] = [
      {
        '@context': 'https://schema.org',
        '@type': ['WebApplication', 'Game', 'EducationalApplication'],
        '@id': `${SITE}/#app`,
        name: SITE_NAME,
        url: `${SITE}/`,
        description: HOME_DESC[lang],
        applicationCategory: 'GameApplication',
        operatingSystem: 'Any (web browser, installable PWA)',
        browserRequirements: 'Requires a modern browser',
        inLanguage: ['es', 'en', 'nah', 'yua', 'quz'],
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        license: `${SITE}/creditos`,
        image: OG_DEFAULT,
        audience: {
          '@type': 'Audience',
          audienceType: 'Families, classrooms, heritage-language learners',
        },
        numberOfPlayers: { '@type': 'QuantitativeValue', minValue: 2, maxValue: 20 },
      },
    ];
    if (faq.length) {
      out.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      });
    }
    return out;
  }
  if (p === '/deck' || p === '/creditos') return [crumb(title.split(' · ')[0] ?? title, p)];
  return [];
}
