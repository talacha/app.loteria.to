// Asserts the prerendered build is crawlable. Usage: node scripts/seo-check.mjs (after prerender)
import { existsSync, readFileSync } from 'node:fs';
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
for (const [route, file] of Object.entries(PUBLIC)) {
  const html = read(file);
  if (!html) {
    fail(`${route}: ${file} missing`);
    continue;
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
for (const f of ['llms.txt', 'llms-full.txt']) if (!read(f)) fail(`${f} missing`);

if (errors.length) {
  console.error('seo:check failed:\n - ' + errors.join('\n - '));
  process.exit(1);
}
console.log('seo:check ok');
