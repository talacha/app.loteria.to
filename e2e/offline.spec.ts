import { expect, test } from '@playwright/test';
import { RX, createRoom, newPage, noHorizontalOverflow } from './helpers';

test('host keeps calling after going offline', async ({ context }) => {
  const host = await newPage(context);
  await createRoom(host);
  await host.getByRole('button', { name: RX.start }).click();
  const next = host.getByRole('button', { name: RX.next });
  await expect(next).toBeVisible();

  const current = () => host.locator('section[aria-labelledby="cur-h"] p').first().textContent();
  const counter = host.getByText(/\d+ de 54 cartas cantadas|\d+ of 54 cards called/i);
  await expect(counter).toBeVisible();

  await context.setOffline(true);
  const seen = new Set<string | null>([await current()]);
  const before = await counter.textContent();
  for (let i = 0; i < 3; i++) {
    const prev = await counter.textContent();
    await next.click();
    await expect(counter).not.toHaveText(prev ?? '');
    seen.add(await counter.textContent());
  }
  expect(await counter.textContent()).not.toBe(before);
  expect(seen.size).toBeGreaterThan(1);

  // No error toasts / alerts while offline.
  await expect(host.getByRole('alert')).toHaveCount(0);
  await noHorizontalOverflow(host, 'host game offline');
  await context.setOffline(false);
});
