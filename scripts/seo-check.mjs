// Asserts the prerendered build is crawlable. Usage: node scripts/seo-check.mjs (after prerender)
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { PUBLIC_PATHS, routeSeo } from '../src/app/seo/meta.ts';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const errors = [];
const fail = (m) => errors.push(m);
const read = (f) => (existsSync(join(dist, f)) ? readFileSync(join(dist, f), 'utf8') : null);

function tag(html, re) {
  return re.exec(html)?.[1] ?? '';
}
function textOf(html) {
  const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  return body
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PUBLIC = {
  '/': 'index.html',
  '/deck': 'deck/index.html',
  '/creditos': 'creditos/index.html',
  '/solo': 'solo/index.html',
  '/print': 'print/index.html',
};
const seenTitles = new Set();
const seenDescriptions = new Set();
const seenImages = new Set();
if (PUBLIC_PATHS.some((p) => !PUBLIC[p])) fail('SEO route registry and build check differ');
for (const [route, file] of Object.entries(PUBLIC)) {
  const html = read(file);
  if (!html) {
    fail(`${route}: ${file} missing`);
    continue;
  }
  const doc = new JSDOM(html).window.document;
  const expected = routeSeo(route, 'es');
  const meta = (key) => doc.querySelector(`meta[name="${key}"],meta[property="${key}"]`)?.content;
  for (const [key, value] of Object.entries({
    description: expected.description,
    keywords: expected.keywords,
    'og:title': expected.title,
    'og:description': expected.description,
    'og:image': expected.image,
    'og:image:alt': expected.imageAlt,
    'og:image:type': 'image/png',
    'og:image:width': '1200',
    'og:image:height': '630',
    'og:url': `https://app.loteria.to${route}`,
    'twitter:card': 'summary_large_image',
    'twitter:title': expected.title,
    'twitter:description': expected.description,
    'twitter:image': expected.image,
  })) {
    if (meta(key) !== value) fail(`${route}: incorrect ${key}`);
    if (doc.querySelectorAll(`meta[name="${key}"],meta[property="${key}"]`).length !== 1)
      fail(`${route}: duplicate or absent ${key}`);
  }
  for (const [set, value, label] of [
    [seenTitles, doc.title, 'title'],
    [seenDescriptions, meta('description'), 'description'],
    [seenImages, meta('og:image'), 'image'],
  ]) {
    if (set.has(value)) fail(`${route}: duplicate public ${label}`);
    set.add(value);
  }
  if (doc.querySelector('link[hreflang]'))
    fail(`${route}: language alternates require distinct translated URLs`);
  if (doc.querySelectorAll('h1').length !== 1) fail(`${route}: must have exactly one h1`);
  if (!doc.querySelector('link[rel="icon"][type="image/png"][sizes="48x48"]'))
    fail(`${route}: missing raster favicon`);
  const imagePath = new URL(expected.image).pathname.slice(1);
  if (!existsSync(join(dist, imagePath))) fail(`${route}: missing OG image`);
  else {
    const png = readFileSync(join(dist, imagePath));
    if (
      png.toString('ascii', 1, 4) !== 'PNG' ||
      png.readUInt32BE(16) !== 1200 ||
      png.readUInt32BE(20) !== 630
    )
      fail(`${route}: OG image must be a 1200x630 PNG`);
  }
  let entities = [];
  try {
    entities = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((el) =>
      JSON.parse(el.textContent),
    );
  } catch {
    fail(`${route}: invalid JSON-LD`);
  }
  for (const type of [
    'WebSite',
    'BreadcrumbList',
    'WebApplication',
    route === '/deck' ? 'CollectionPage' : route === '/creditos' ? 'AboutPage' : 'WebPage',
  ])
    if (!entities.some((e) => e['@type'] === type)) fail(`${route}: missing ${type} schema`);
  if (route === '/deck') {
    const list = entities.find((e) => e['@type'] === 'ItemList');
    if (list?.numberOfItems !== 144 || list?.itemListElement?.length !== 144)
      fail('/deck: incomplete structured catalog');
    for (const row of list?.itemListElement ?? []) {
      const id = new URL(row.item.url).hash.slice(1);
      const element = doc.getElementById(id);
      if (!element || !element.textContent.includes(row.item.name))
        fail(`/deck: schema card ${id} not visible`);
    }
  }
  const t = (k, re) => tag(html, re) || fail(`${route}: missing ${k}`);
  const title = t('title', /<title>([^<]+)<\/title>/);
  if (/^(.+) · \1$/.test(title)) fail(`${route}: duplicated title "${title}"`);
  t('description', /<meta name="description" content="([^"]+)"/);
  const canon = t('canonical', /<link rel="canonical" href="([^"]+)"/);
  if (canon && canon !== `https://app.loteria.to${route}`) fail(`${route}: canonical is ${canon}`);
  t('og:image', /<meta property="og:image" content="([^"]+)"/);
  t('og:title', /<meta property="og:title" content="([^"]+)"/);
  t('twitter:card', /<meta name="twitter:card" content="([^"]+)"/);
  if (!/<h1[\s>]/.test(html)) fail(`${route}: no <h1>`);
  if (/noindex/.test(tag(html, /<meta name="robots" content="([^"]+)"/)))
    fail(`${route}: noindex on a public route`);
  const n = textOf(html).length;
  if (n <= 300) fail(`${route}: only ${n} chars of text`);
  if (route === '/' && !/"@type":"FAQPage"/.test(html)) fail('/: FAQPage JSON-LD missing');
}

const nf = read('404.html');
if (!nf) fail('404.html missing');
else if (!/noindex/.test(nf)) fail('404.html is indexable');

const shell = read('app.html');
if (!shell) fail('app.html (private-route shell) missing');
else if (!/<meta name="robots" content="noindex/.test(shell)) fail('app.html is not noindex');

const vercel = JSON.parse(
  readFileSync(fileURLToPath(new URL('../vercel.json', import.meta.url)), 'utf8'),
);
for (const src of ['/host', '/r/(.*)', '/ui']) {
  const h = vercel.headers?.find((x) => x.source === src);
  if (!h?.headers.some((x) => x.key === 'X-Robots-Tag' && /noindex/.test(x.value)))
    fail(`vercel.json: no X-Robots-Tag noindex for ${src}`);
}

const robots = read('robots.txt');
if (!robots) fail('robots.txt missing');
else {
  if (!/Sitemap: https:\/\/app\.loteria\.to\/sitemap\.xml/.test(robots))
    fail('robots.txt: no Sitemap line');
  for (const p of ['/host', '/r/', '/ui'])
    if (!robots.includes(`Disallow: ${p}`)) fail(`robots.txt: no Disallow ${p}`);
}
const sm = read('sitemap.xml');
if (!sm) fail('sitemap.xml missing');
else
  for (const r of Object.keys(PUBLIC))
    if (!sm.includes(`<loc>https://app.loteria.to${r}</loc>`)) fail(`sitemap.xml: ${r} missing`);
for (const f of ['llms.txt', 'llms-full.txt']) {
  const content = read(f);
  if (!content) fail(`${f} missing`);
  else
    for (const route of PUBLIC_PATHS)
      if (!content.includes(`https://app.loteria.to${route}`)) fail(`${f}: ${route} missing`);
}
for (const group of robots?.split(/(?=User-agent:)/).filter((g) => g.startsWith('User-agent:')) ??
  []) {
  for (const path of ['/host', '/r/', '/ui', '/api'])
    if (!group.includes(`Disallow: ${path}`)) fail(`robots.txt: crawler group missing ${path}`);
}
if ((sm?.match(/<image:loc>/g) ?? []).length !== 144)
  fail('sitemap: expected all144 catalog images');
for (const name of [
  'favicon.svg',
  'favicon-48.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
])
  if (!existsSync(join(dist, name))) fail(`Missing icon ${name}`);

if (errors.length) {
  console.error('seo:check failed:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('seo:check ok');
