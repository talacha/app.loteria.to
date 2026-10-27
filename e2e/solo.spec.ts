import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

test('solo stays stable on cold load and when starting', async ({ page }, info) => {
  await page.addInitScript(() => {
    const state = { max: 0, value: 0, start: 0, last: 0 };
    Object.assign(window, { __layoutShift: state });
    new PerformanceObserver((list) => {
      for (const raw of list.getEntries()) {
        const entry = raw as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (entry.hadRecentInput) continue;
        if (entry.startTime - state.last > 1000 || entry.startTime - state.start > 5000) {
          state.value = 0;
          state.start = entry.startTime;
        }
        state.value += entry.value;
        state.last = entry.startTime;
        state.max = Math.max(state.max, state.value);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto('/solo');
  const start = page.getByRole('button', { name: /^(empezar|start)$/i });
  await expect(start).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1200);
  const cls = () =>
    page.evaluate(
      () => (window as unknown as { __layoutShift: { max: number } }).__layoutShift.max,
    );
  expect(await cls(), 'cold-load CLS').toBeLessThan(0.1);
  await start.click();
  await expect(page.getByRole('list', { name: /tu tabla|your board/i })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(await cls(), 'CLS including game start').toBeLessThan(0.1);
  await noHorizontalOverflow(page, 'solo game');
  await page.screenshot({ path: info.outputPath('solo-game.png'), fullPage: true });
});
