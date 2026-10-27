/** Built-PWA regression: pnpm build && pnpm tsx loadtest/check-pwa-offline.ts */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { sleep } from './common.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const sw = readFileSync(root + 'dist/sw.js', 'utf8');
const urls = [...new Set([...sw.matchAll(/url:"([^"]+)"/g)].map((match) => match[1]!))];
const media = urls.filter((url) => /^(?:cards\/.*\.webp|audio\/.*\.m4a)$/.test(url));
const expectedArt = JSON.parse(readFileSync(root + 'src/content/cards.json', 'utf8')).length;
if (media.filter((url) => url.startsWith('cards/')).length !== expectedArt)
  throw new Error(
    'Build must precache an illustration for every catalog card before offline verification.',
  );
const printWorker = [...sw.matchAll(/assets\/[a-zA-Z_-]+-[a-zA-Z0-9_-]+\.js/g)]
  .map((match) => match[0])
  .find((url) => url.startsWith('assets/worker-'));
// Runtime-only files do not appear in the precache manifest. Read the worker from built assets.
const { readdirSync } = await import('node:fs');
const worker =
  printWorker ??
  'assets/' + readdirSync(root + 'dist/assets').find((name) => /^worker-.*\.js$/.test(name));
const print = ['fonts/NotoSans-Regular.ttf', worker];
const port = Number(process.env.LOADTEST_PWA_PORT ?? 4199);
const base = `http://localhost:${port}`;
const server = spawn(
  process.execPath,
  [root + 'node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'],
  { cwd: root, stdio: 'ignore' },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    if (server.exitCode !== null)
      throw new Error('PWA preview failed; choose another LOADTEST_PWA_PORT.');
    try {
      ready = (await fetch(base)).ok;
    } catch {
      /* starting */
    }
    if (ready) break;
  }
  if (!ready) throw new Error('PWA preview did not start');
  browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, undefined, {
    timeout: 60_000,
  });
  // Printing is available offline after its first connected fetch.
  await page.evaluate(async (files) => {
    for (const file of files) {
      const response = await fetch('/' + file);
      if (!response.ok) throw new Error('Print asset failed online: ' + file);
      await response.arrayBuffer();
    }
  }, print);
  await page.waitForFunction(async (files) => {
    const cache = await caches.open('loteria-print-assets-v1');
    return (await Promise.all(files.map((file) => cache.match('/' + file)))).every(Boolean);
  }, print);
  await context.setOffline(true);
  const count = await page.evaluate(
    async (files) => {
      for (let i = 0; i < files.length; i += 16) {
        await Promise.all(
          files.slice(i, i + 16).map(async (file) => {
            const response = await fetch('/' + file);
            if (!response.ok || (await response.arrayBuffer()).byteLength < 100)
              throw new Error('Offline asset failed: ' + file);
          }),
        );
      }
      return files.length;
    },
    [...media, ...print],
  );
  console.log(
    JSON.stringify(
      {
        pass: true,
        offlineMediaAndPrintAssets: count,
        illustrations: expectedArt,
        audioClips: media.filter((url) => url.startsWith('audio/')).length,
        print: 'cached after first online use',
      },
      null,
      2,
    ),
  );
} finally {
  await browser?.close();
  server.kill();
}
