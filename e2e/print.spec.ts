import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

test('print page generates a PDF download', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/print');
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
});
