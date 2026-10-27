import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';
import { noHorizontalOverflow } from './helpers';

test('print page generates a PDF download', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/print?seed=ABCD2345');
  await page.locator('#print-count').fill('1');
  await page.locator('#print-lang').selectOption('nah');
  await noHorizontalOverflow(page, 'print');
  await page.getByRole('button', { name: /crear pdf|create pdf/i }).click();
  const link = page.getByRole('link', { name: /descargar pdf|download pdf/i });
  await expect(link).toBeVisible({ timeout: 60_000 });
  const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.length).toBeGreaterThan(0);
  expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  const doc = await PDFDocument.load(bytes);
  const illustrations = doc.context
    .enumerateIndirectObjects()
    .filter(
      ([, value]) =>
        value instanceof PDFRawStream &&
        value.dict.get(PDFName.of('Subtype'))?.toString() === '/Image' &&
        value.dict.get(PDFName.of('Filter'))?.toString() === '/DCTDecode',
    );
  // Each selected WebP was converted and embedded, rather than silently reverting to emoji.
  expect(illustrations).toHaveLength(16);
});
