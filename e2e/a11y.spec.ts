import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { RX, createRoom, fillJoinForm, newPage } from './helpers';

async function expectNoSeriousViolations(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`),
    `axe on ${label}`,
  ).toEqual([]);
}

test('axe: home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('main')).toBeVisible();
  await expectNoSeriousViolations(page, 'home');
});

test('axe: host lobby', async ({ context }) => {
  const host = await newPage(context);
  await createRoom(host);
  await expect(host.getByRole('img', { name: /escanea|scan/i })).toBeVisible();
  await expectNoSeriousViolations(host, 'host lobby');
});

test('axe: join form', async ({ context }) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  const p = await newPage(context);
  await p.goto(joinUrl);
  await expect(p.getByLabel(/tu nombre|your name/i)).toBeVisible();
  await expectNoSeriousViolations(p, 'join form');
});

test('axe: player lobby', async ({ context }) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  const p = await newPage(context);
  await p.goto(joinUrl);
  await fillJoinForm(p, 'Ana');
  await expect(p.getByText(RX.waiting)).toBeVisible();
  await expectNoSeriousViolations(p, 'player lobby');
});
