// Renders all social preview variants from design/og/og.html at 1200 × 630.
// Usage: pnpm og:render
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = pathToFileURL(root + 'design/og/og.html').href;
mkdirSync(root + 'public/og', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  for (const variant of ['default', 'deck', 'solo', 'print', 'credits', 'invite']) {
    await page.goto(`${src}?variant=${variant}`);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.decode()));
    });
    const overflow = await page.evaluate(() => {
      const copy = document.querySelector('.copy').getBoundingClientRect();
      const footer = document.querySelector('.footer').getBoundingClientRect();
      return copy.bottom > footer.top - 12;
    });
    if (overflow) throw new Error(`OG copy overlaps footer: ${variant}`);
    await page.screenshot({ path: `${root}public/og/${variant}.png`, type: 'png' });
    console.log(`public/og/${variant}.png`);
  }
} finally {
  await browser.close();
}
