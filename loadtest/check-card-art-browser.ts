/** Verify every delivered card on Home/Deck; optional LOADTEST_CARDS_BASE_URL targets a release. */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { assertCatalogArt, type IndexedArtwork } from '../scripts/card-art-check';
import { sleep } from './common.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(readFileSync(root + 'src/content/cards.json', 'utf8')) as {
  id: string;
}[];
const index = JSON.parse(
  readFileSync(root + 'src/content/card-art.json', 'utf8'),
) as IndexedArtwork[];
assertCatalogArt(index, catalog);
const hashes = Object.fromEntries(index.map((entry) => [entry.id, entry.sha256]));
const base = process.env.LOADTEST_CARDS_BASE_URL ?? 'http://localhost:4200';
const output = process.env.LOADTEST_CARDS_OUTPUT_DIR ?? root + 'loadtest/reports/card-art-release';
mkdirSync(output, { recursive: true });
const server = process.env.LOADTEST_CARDS_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [root + 'node_modules/vite/bin/vite.js', 'preview', '--port', '4200', '--strictPort'],
      { cwd: root, stdio: 'ignore' },
    );
const results: unknown[] = [];
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  if (server) {
    let ready = false;
    for (let i = 0; i < 50; i++) {
      await sleep(200);
      if (server.exitCode !== null) throw new Error('Card preview failed to start on port 4200.');
      try {
        ready = (await fetch(base)).ok;
      } catch {
        /* starting */
      }
      if (ready) break;
    }
    if (!ready) throw new Error('Card preview did not start');
  }
  browser = await chromium.launch();
  for (const width of [390, 768, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
      locale: 'es-MX',
      colorScheme: 'light',
    });
    const page = await context.newPage();
    for (const route of ['/', '/deck']) {
      await page.goto(new URL(route, base).href);
      await page.waitForSelector('[data-art]');
      // Exercise actual lazy loading by visiting the whole page before decoding all pictures.
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight) {
          scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        await Promise.all(
          [...document.querySelectorAll<HTMLImageElement>('main img')].map((image) =>
            image.decode(),
          ),
        );
        scrollTo(0, 0);
      });
      const result = await page.evaluate(
        async ({ hashes, expected, deck }) => {
          const faces = [...document.querySelectorAll<HTMLElement>('main [data-art]')];
          const problems: string[] = [];
          const seen = new Set<string>();
          for (const face of faces) {
            const image = face.querySelector('img');
            if (!image || face.dataset.art !== 'true') {
              problems.push('Fallback instead of generated illustration');
              continue;
            }
            const id = /\/cards\/([^/]+)\.webp$/.exec(new URL(image.currentSrc).pathname)?.[1];
            if (!id || !hashes[id]) {
              problems.push('Unexpected picture source: ' + image.currentSrc);
              continue;
            }
            seen.add(id);
            if (!image.complete || image.naturalWidth !== 600 || image.naturalHeight !== 900)
              problems.push(id + ': incomplete or wrong resolution');
            const picture = image.getBoundingClientRect();
            const bounds = face.getBoundingClientRect();
            const parent = face.parentElement!;
            const surface = parent.getBoundingClientRect();
            const border = getComputedStyle(parent);
            const innerWidth =
              surface.width -
              parseFloat(border.borderLeftWidth) -
              parseFloat(border.borderRightWidth);
            const innerHeight =
              surface.height -
              parseFloat(border.borderTopWidth) -
              parseFloat(border.borderBottomWidth);
            if (
              getComputedStyle(image).objectFit !== 'cover' ||
              Math.abs(picture.width - bounds.width) > 1 ||
              Math.abs(picture.height - bounds.height) > 1 ||
              Math.abs(bounds.width - innerWidth) > 1 ||
              Math.abs(bounds.height - innerHeight) > 1
            )
              problems.push(id + ': picture does not cover its surface');
            if (deck) {
              const response = await fetch(image.currentSrc);
              if (!response.ok) {
                problems.push(id + ': HTTP ' + response.status);
                continue;
              }
              const digest = await crypto.subtle.digest('SHA-256', await response.arrayBuffer());
              const actual = [...new Uint8Array(digest)]
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');
              if (actual !== hashes[id])
                problems.push(id + ': deployed bytes differ from current index');
            }
          }
          if (deck && (faces.length !== expected || seen.size !== expected))
            problems.push(
              `Expected ${expected} catalog illustrations; got ${faces.length} faces/${seen.size} IDs`,
            );
          if (document.documentElement.scrollWidth > innerWidth)
            problems.push('Horizontal overflow');
          return { faces: faces.length, uniqueIllustrations: seen.size, problems };
        },
        { hashes, expected: catalog.length, deck: route === '/deck' },
      );
      if (result.problems.length) throw new Error(JSON.stringify({ width, route, ...result }));
      results.push({ width, route, ...result });
      await page.screenshot({ path: `${output}/${route === '/' ? 'home' : 'deck'}-${width}.png` });
    }
    await context.close();
  }
  const report = { pass: true, catalogCards: catalog.length, results };
  writeFileSync(output + '/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser?.close();
  server?.kill();
}
