// Verify the final generated service-worker payload, including VitePWA's injected icons/manifest.
import { readFileSync, statSync } from 'node:fs';
import { assertPrecacheBudget } from './precache-budget.ts';

const sw = readFileSync(new URL('../dist/sw.js', import.meta.url), 'utf8');
const urls = [...new Set([...sw.matchAll(/\burl:(["'])([^"']+)\1/g)].map((match) => match[2]))];
if (!urls.length) throw new Error('Could not read generated service-worker precache manifest.');
const entries = urls.map((url) => ({
  url,
  size: statSync(new URL('../dist/' + url, import.meta.url)).size,
}));
assertPrecacheBudget(entries);
const included = new Set(urls.map((url) => url.replace(/^\//, '')));
const cards = JSON.parse(
  readFileSync(new URL('../src/content/cards.json', import.meta.url), 'utf8'),
);
for (const card of cards) {
  const art = `cards/${card.id}.webp`;
  if (!included.has(art)) throw new Error(`Catalog illustration missing from precache: ${art}`);
  for (const name of Object.values(card.names)) {
    if (name.audio && !included.has(name.audio.replace(/^\//, '')))
      throw new Error(`Referenced voice clip missing from precache: ${name.audio}`);
  }
}
console.log(
  `[precache] ${entries.length} files, ${entries.reduce((total, entry) => total + entry.size, 0)} bytes; complete catalog art and voices verified.`,
);
