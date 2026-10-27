// Renders PNG app icons from public/favicon.svg's design (red tile, cream "L").
// Usage: node scripts/render-icons.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const RED = '#b3261e';
const CREAM = '#fff8ec';

// scale 1 = same proportions as favicon.svg; maskable keeps the glyph inside the 80% safe zone.
function svg({ rounded, scale }) {
  const rx = rounded ? 12 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
<rect width="64" height="64" rx="${rx}" fill="${RED}"/>
<text x="32" y="${32 + 12 * scale}" font-size="${34 * scale}" text-anchor="middle" fill="${CREAM}" font-family="sans-serif" font-weight="700">L</text></svg>`;
}

const jobs = [
  { file: 'apple-touch-icon.png', size: 180, rounded: false, scale: 1 },
  { file: 'icon-192.png', size: 192, rounded: true, scale: 1 },
  { file: 'icon-512.png', size: 512, rounded: true, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, rounded: false, scale: 0.78 },
];

const browser = await chromium.launch();
for (const j of jobs) {
  const page = await browser.newPage({ viewport: { width: j.size, height: j.size } });
  await page.setContent(`<style>html,body{margin:0;background:transparent}</style>${svg(j)}`);
  await page.screenshot({ path: `${root}public/${j.file}`, omitBackground: true });
  await page.close();
  console.log(`public/${j.file}`);
}
await browser.close();
