import { afterEach, describe, expect, it } from 'vitest';
import { applyHead } from './head';
import { catalogJsonLd } from './catalog';
import { HOME_TITLE, PUBLIC_PATHS, SITE, jsonLdFor, routeSeo, type SeoLang } from './meta';

const faq = [{ q: '¿Cómo se juega?', a: 'Marca las cartas que se cantan.' }];
function content(key: string): string | null {
  return (
    document.head
      .querySelector(`meta[name="${key}"], meta[property="${key}"]`)
      ?.getAttribute('content') ?? null
  );
}
function entities(): Record<string, unknown>[] {
  return [...document.head.querySelectorAll('script[data-seo-ld]')].map((el) =>
    JSON.parse(el.textContent ?? '{}'),
  );
}
afterEach(() => {
  document.head.innerHTML = '';
  document.documentElement.lang = '';
});

describe('public route metadata', () => {
  for (const lang of ['es', 'en'] as SeoLang[]) {
    it(`gives all five routes distinct ${lang} titles, descriptions, keywords and images`, () => {
      const routes = PUBLIC_PATHS.map((path) => routeSeo(path, lang));
      for (const key of ['title', 'description', 'keywords', 'image'] as const) {
        expect(new Set(routes.map((route) => route[key])).size).toBe(PUBLIC_PATHS.length);
        expect(routes.every((route) => Boolean(route[key]))).toBe(true);
      }
      for (const path of PUBLIC_PATHS) {
        const route = routeSeo(path, lang);
        expect(route.noindex).toBe(false);
        expect(route.canonical).toBe(path);
        expect(route.image).toMatch(/^https:\/\/app\.loteria\.to\/og\/\w+\.png\?v=2$/);
        expect(routeSeo(`${path === '/' ? '' : path}/`, lang)).toEqual(route);
      }
    });
  }

  it('uses connected page, site, app, image and breadcrumb entities on every public page', () => {
    for (const path of PUBLIC_PATHS) {
      const graph = jsonLdFor(path, 'es', 'Fallback', faq) as Record<string, unknown>[];
      const ids = graph.map((node) => node['@id']);
      expect(new Set(ids).size).toBe(ids.length);
      expect(graph.find((node) => node['@type'] === 'WebSite')).toMatchObject({
        '@id': `${SITE}/#website`,
      });
      const page = graph.find((node) => node['@id'] === `${SITE}${path}#webpage`);
      expect(page).toMatchObject({
        isPartOf: { '@id': `${SITE}/#website` },
        about: { '@id': `${SITE}/#app` },
        inLanguage: 'es',
      });
      expect(graph.find((node) => node['@type'] === 'BreadcrumbList')).toBeDefined();
      const app = graph.find((node) => node['@type'] === 'WebApplication');
      expect(app).not.toHaveProperty('license');
      expect(app).not.toHaveProperty('aggregateRating');
      expect(app).not.toHaveProperty('numberOfPlayers');
      expect(graph.filter((node) => node['@type'] === 'FAQPage')).toHaveLength(
        path === '/' ? 1 : 0,
      );
    }
    expect(jsonLdFor('/deck', 'es', '', [])[1]).toHaveProperty('@type', 'CollectionPage');
    expect(jsonLdFor('/creditos', 'es', '', [])[1]).toHaveProperty('@type', 'AboutPage');
  });

  it('describes the 144 rendered cards with stable bilingual anchors', () => {
    const es = catalogJsonLd('es') as {
      '@id': string;
      numberOfItems: number;
      itemListElement: {
        position: number;
        item: { '@id': string; name: string; alternateName: string };
      }[];
    };
    const en = catalogJsonLd('en') as typeof es;
    expect(es['@id']).toBe(`${SITE}/deck#cards`);
    expect(es.numberOfItems).toBe(144);
    expect(es.itemListElement).toHaveLength(144);
    expect(new Set(es.itemListElement.map((entry) => entry.item['@id'])).size).toBe(144);
    es.itemListElement.forEach((entry, index) => {
      expect(entry.position).toBe(index + 1);
      expect(entry.item['@id']).toMatch(/^https:\/\/app\.loteria\.to\/deck#card-[a-z0-9-]+$/);
      expect(entry.item.name).toBe(en.itemListElement[index]?.item.alternateName);
      expect(entry.item.alternateName).toBe(en.itemListElement[index]?.item.name);
    });
  });
});

describe('head navigation', () => {
  it('replaces prerendered metadata without duplicates and removes false language alternates', () => {
    document.head.innerHTML =
      '<meta name="description" content="old"><meta name="description" content="duplicate"><link rel="alternate" hreflang="en" href="https://app.loteria.to/deck"><meta property="og:locale:alternate" content="en_US">';
    for (const path of PUBLIC_PATHS) {
      applyHead(path, 'es', 'Fallback', faq);
      applyHead(path, 'en', 'Fallback', faq);
      expect(document.title).toBe(routeSeo(path, 'en').title);
      expect(document.documentElement.lang).toBe('en');
      expect(content('description')).toBe(routeSeo(path, 'en').description);
      expect(document.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
      expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
      expect(document.head.querySelectorAll('link[hreflang]')).toHaveLength(0);
      expect(content('og:locale:alternate')).toBeNull();
      expect(content('og:image:type')).toBe('image/png');
      expect(content('og:image:width')).toBe('1200');
      expect(content('og:image:height')).toBe('630');
      expect(content('twitter:image')).toBe(routeSeo(path, 'en').image);
      expect(entities().filter((node) => node['@type'] === 'ItemList')).toHaveLength(
        path === '/deck' ? 1 : 0,
      );
    }
  });

  it.each([
    '/host',
    '/host/setup',
    '/ui',
    '/r',
    '/missing',
    '/constructor',
    '/toString',
    '/r/not-a-code',
  ])('removes public SEO data on %s', (path) => {
    applyHead('/deck', 'es', 'Cards', faq);
    applyHead(path, 'es', 'Private or missing', faq);
    expect(document.title).toBe(
      path.startsWith('/r/') ? '¡Te invitaron a la Lotería!' : 'Private or missing',
    );
    expect(content('robots')).toBe('noindex,nofollow');
    expect(content('keywords')).toBeNull();
    expect(content('og:url')).toBeNull();
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(entities()).toHaveLength(0);
    expect(jsonLdFor(path, 'es', 'Private or missing', faq)).toEqual([]);
  });

  it('allows a private invitation preview without a canonical or public schema', () => {
    applyHead('/r/abc23', 'en', 'Join', []);
    expect(document.title).toBe('You are invited to play lotería! · Room ABC23');
    expect(content('og:url')).toBe(`${SITE}/r/ABC23`);
    expect(content('og:image')).toBe(`${SITE}/og/invite.png?v=2`);
    expect(content('robots')).toBe('noindex,nofollow');
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
    expect(entities()).toHaveLength(0);
    applyHead('/', 'es', 'Home', faq);
    expect(document.title).toBe(HOME_TITLE.es);
    expect(content('og:url')).toBe(`${SITE}/`);
    expect(content('keywords')).not.toBeNull();
    expect(entities().length).toBeGreaterThan(0);
  });

  it('keeps JSON-LD safe to serialize into prerendered HTML', () => {
    applyHead('/', 'es', '', [{ q: '</script><script>alert(1)</script>', a: 'Text' }]);
    const scripts = [...document.head.querySelectorAll('script[data-seo-ld]')];
    expect(scripts.every((script) => !script.textContent?.includes('<'))).toBe(true);
    expect(entities().find((node) => node['@type'] === 'FAQPage')).toHaveProperty('mainEntity', [
      {
        '@type': 'Question',
        name: '</script><script>alert(1)</script>',
        acceptedAnswer: { '@type': 'Answer', text: 'Text' },
      },
    ]);
  });
});
