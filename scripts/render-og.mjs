// Renders design/og/og.html to public/og/{default,invite}.png at 1200×630.
// Usage: pnpm og:render
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = pathToFileURL(root + 'design/og/og.html').href;
mkdirSync(root + 'public/og', { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1,
});
for (const variant of ['default', 'invite']) {
  await page.goto(`${src}?variant=${variant}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${root}public/og/${variant}.png`, type: 'png' });
  console.log(`public/og/${variant}.png`);
}
await browser.close();
