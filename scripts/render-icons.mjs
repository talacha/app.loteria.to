// All app icons derive from the same vector mark in public/favicon.svg.
// Usage: node scripts/render-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const source = readFileSync(`${root}public/favicon.svg`, 'utf8');
const jobs = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'favicon-48.png', size: 48 },
  { file: 'apple-touch-icon.png', size: 180, square: true },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, square: true, maskable: true },
];
const browser = await chromium.launch();
try {
  for (const job of jobs) {
    let svg = source;
    if (job.square) svg = svg.replace('rx="13"', 'rx="0"');
    // The emblem fits in the central 80%-diameter maskable safe circle.
    if (job.maskable) {
      svg = svg.replace(
        '<g id="emblem"',
        '<g transform="translate(32 32) scale(.8) translate(-32 -32)" id="emblem"',
      );
    }
    const page = await browser.newPage({
      viewport: { width: job.size, height: job.size },
      deviceScaleFactor: 1,
    });
    await page.setContent(
      `<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>${svg}`,
    );
    await page.screenshot({ path: `${root}public/${job.file}`, omitBackground: true });
    await page.close();
    console.log(`public/${job.file}`);
  }
} finally {
  await browser.close();
}
