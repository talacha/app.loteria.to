import { expect, test } from '@playwright/test';
import { RX, createRoom, fillJoinForm, newPage, noHorizontalOverflow } from './helpers';

test('host keeps calling after going offline', async ({ context }) => {
  test.setTimeout(60_000);
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  for (const name of ['Ana', 'Beto']) {
    const player = await newPage(context);
    await player.goto(joinUrl);
    await fillJoinForm(player, name);
    await expect(player.getByText(RX.waiting)).toBeVisible();
  }
  await host.getByRole('button', { name: RX.start }).click();
  const counter = host.locator('#cur-h');
  await expect(counter).toContainText(/1/);
  await context.setOffline(true);
  const before = await counter.textContent();
  await expect(counter).not.toHaveText(before ?? '', { timeout: 25_000 });
  await expect(host.getByRole('alert')).toHaveCount(0);
  await noHorizontalOverflow(host, 'host game offline');
  await context.setOffline(false);
});
