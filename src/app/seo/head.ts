import {
  SITE,
  SITE_NAME,
  isPrivatePath,
  jsonLdFor,
  normalizePath,
  routeSeo,
  type FaqItem,
  type SeoLang,
} from './meta';
import { catalogJsonLd } from './catalog';

function upsert(selector: string, create: () => HTMLElement, set: (el: HTMLElement) => void) {
  const matches = document.head.querySelectorAll<HTMLElement>(selector);
  let el = matches[0];
  matches.forEach((node, index) => {
    if (index > 0) node.remove();
  });
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  set(el);
}

function meta(attr: 'name' | 'property', key: string, content: string | null) {
  const sel = `meta[${attr}="${key}"]`;
  if (content === null) {
    document.head.querySelectorAll(sel).forEach((node) => node.remove());
    return;
  }
  upsert(
    sel,
    () => {
      const m = document.createElement('meta');
      m.setAttribute(attr, key);
      return m;
    },
    (m) => m.setAttribute('content', content),
  );
}

function link(rel: string, href: string | null, hreflang?: string) {
  const sel = `link[rel="${rel}"]${hreflang ? `[hreflang="${hreflang}"]` : ''}`;
  if (href === null) {
    document.head.querySelectorAll(sel).forEach((n) => n.remove());
    return;
  }
  upsert(
    sel,
    () => {
      const l = document.createElement('link');
      l.rel = rel;
      if (hreflang) l.hreflang = hreflang;
      return l;
    },
    (l) => l.setAttribute('href', href),
  );
}

/** Applies route metadata and replaces prerendered data on navigation. */
export function applyHead(pathname: string, lang: SeoLang, title: string, faq: FaqItem[]): void {
  const p = normalizePath(pathname);
  const seo = routeSeo(p, lang);
  const pageTitle = seo.title ?? title;
  document.title = pageTitle;
  document.documentElement.lang = lang;
  const url = seo.canonical ? `${SITE}${seo.canonical === '/' ? '/' : seo.canonical}` : null;
  const priv = isPrivatePath(p) || seo.noindex;

  meta('name', 'description', seo.description);
  meta('name', 'keywords', seo.keywords ?? null);
  meta('name', 'robots', priv ? 'noindex,nofollow' : 'index,follow,max-image-preview:large');
  link('canonical', url);
  // UI language preferences do not create separately addressable translations.
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());

  meta('property', 'og:type', 'website');
  meta('property', 'og:site_name', SITE_NAME);
  meta('property', 'og:locale', lang === 'en' ? 'en_US' : 'es_MX');
  meta('property', 'og:locale:alternate', null);
  meta('property', 'og:url', url ?? (seo.sharePath ? `${SITE}${seo.sharePath}` : null));
  meta('property', 'og:title', pageTitle);
  meta('property', 'og:description', seo.description);
  meta('property', 'og:image', seo.image);
  meta('property', 'og:image:type', 'image/png');
  meta('property', 'og:image:width', '1200');
  meta('property', 'og:image:height', '630');
  meta('property', 'og:image:alt', seo.imageAlt);
  meta('name', 'twitter:card', 'summary_large_image');
  meta('name', 'twitter:title', pageTitle);
  meta('name', 'twitter:description', seo.description);
  meta('name', 'twitter:image', seo.image);
  meta('name', 'twitter:image:alt', seo.imageAlt);

  document.head.querySelectorAll('script[data-seo-ld]').forEach((n) => n.remove());
  if (!priv) {
    const entities = jsonLdFor(p, lang, pageTitle, faq);
    if (p === '/deck') entities.push(catalogJsonLd(lang));
    for (const obj of entities) {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seoLd = '1';
      s.textContent = JSON.stringify(obj).replace(/</g, '\\u003c');
      document.head.appendChild(s);
    }
  }
}
