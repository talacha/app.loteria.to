import { expect, test, type Locator } from '@playwright/test';
import { createRoom, fillJoinForm, newPage, noHorizontalOverflow, RX } from './helpers';

async function picturesFillTheirFaces(faces: Locator) {
  const sizes = await faces.evaluateAll((nodes) =>
    nodes.map((face) => {
      const image = face.querySelector('img');
      const outer = face.getBoundingClientRect();
      const picture = image?.getBoundingClientRect();
      const surface = face.parentElement!;
      const bounds = surface.getBoundingClientRect();
      const border = getComputedStyle(surface);
      const surfaceWidth =
        bounds.width - parseFloat(border.borderLeftWidth) - parseFloat(border.borderRightWidth);
      const surfaceHeight =
        bounds.height - parseFloat(border.borderTopWidth) - parseFloat(border.borderBottomWidth);
      return {
        surfaceWidth,
        surfaceHeight,
        width: outer.width,
        height: outer.height,
        imageWidth: picture?.width,
        imageHeight: picture?.height,
        fit: image ? getComputedStyle(image).objectFit : null,
      };
    }),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const size of sizes) {
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
    expect(Math.abs(size.width - size.surfaceWidth)).toBeLessThan(1);
    expect(Math.abs(size.height - size.surfaceHeight)).toBeLessThan(1);
    // Emoji-only fallbacks have no image box; all delivered image formats must cover.
    if (size.imageWidth === undefined) continue;
    expect(size.fit).toBe('cover');
    expect(Math.abs(size.width - (size.imageWidth ?? 0))).toBeLessThan(1);
    expect(Math.abs(size.height - (size.imageHeight ?? 0))).toBeLessThan(1);
  }
}

test('home samples and catalog pictures fill their portrait cards', async ({ page }) => {
  for (const route of ['/', '/deck']) {
    await page.goto(route);
    await expect(page.locator('[data-art="true"]').first()).toBeVisible();
    await picturesFillTheirFaces(page.locator('[data-art="true"]'));
    await noHorizontalOverflow(page, route);
  }
});

test('solo pictures cover the call and square board cells', async ({ page }) => {
  await page.goto('/solo');
  await page.getByRole('button', { name: RX.start }).click();
  await expect(page.locator('[data-grid]')).toBeVisible();
  await picturesFillTheirFaces(page.locator('[data-art="true"]'));
  const cells = await page.locator('[data-grid] [data-marked]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(cells).toHaveLength(16);
  for (const cell of cells) expect(Math.abs(cell.width - cell.height)).toBeLessThan(1);
  await noHorizontalOverflow(page, 'solo card backgrounds');
});

test('host and phone call pictures fill their surface without horizontal overflow', async ({
  context,
}) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  const players = [];
  for (const name of ['Ana', 'Beto']) {
    const player = await newPage(context);
    await player.goto(joinUrl);
    await fillJoinForm(player, name);
    await expect(player.getByText(RX.waiting)).toBeVisible();
    players.push(player);
  }
  await host.getByRole('button', { name: RX.start }).click();
  await expect(host.locator('figure [data-art]')).toBeVisible();
  await picturesFillTheirFaces(host.locator('figure [data-art]'));
  const player = players[0]!;
  await expect(player.locator('[data-testid="call"] [data-art]')).toBeVisible();
  await picturesFillTheirFaces(player.locator('[data-art="true"]'));
  await noHorizontalOverflow(host, 'host card background');
  await noHorizontalOverflow(player, 'phone card backgrounds');
});
