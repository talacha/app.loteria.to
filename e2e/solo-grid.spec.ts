import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('loteria.lang', 'es');
    localStorage.setItem('loteria:profile', JSON.stringify({ uiLang: 'es', spokenLang: 'es' }));
  });
});

test('solo deals an 8×8 board with three computer players and keeps it when switching to English', async ({
  page,
}, info) => {
  await page.goto('/solo');
  await page
    .getByRole('radiogroup', { name: 'Contrincantes', exact: true })
    .getByRole('radio', { name: '3 computadoras', exact: true })
    .click();
  const sizes = page.getByRole('radiogroup', { name: 'Tamaño de la tabla', exact: true });
  await expect(sizes).toHaveAttribute('aria-describedby', 'solo-grid-help');
  await expect(page.locator('#solo-grid-help')).toContainText('español o inglés');
  const eight = sizes.getByRole('radio', { name: '8×8', exact: true });
  await expect(eight).toBeEnabled();
  await eight.click();
  await expect(eight).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();

  const main = page.locator('main');
  const board = page.getByRole('list', { name: /^(Tu tabla|Your board)$/ });
  await expect(board).toBeVisible();
  await main.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(board).toHaveAttribute('data-grid', '8');
  await expect(board.locator('[data-marked]')).toHaveCount(64);
  await expect(main.locator('tbody tr')).toHaveCount(4);
  await expect(main.locator('tr[data-self="true"] td').last()).toHaveText('0/64');
  expect(
    await board.evaluate(
      (element) => getComputedStyle(element).gridTemplateColumns.split(' ').length,
    ),
  ).toBe(8);
  const snapshot = () =>
    board.locator('[data-marked]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        image: node.querySelector('img')?.getAttribute('src'),
        marked: node.getAttribute('data-marked'),
      })),
    );
  const before = await snapshot();
  expect(new Set(before.map((cell) => cell.image)).size).toBe(64);

  await main.getByRole('button', { name: 'Ajustes de idioma', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Ajustes', exact: true })
    .getByRole('radiogroup', { name: 'Idioma de la app', exact: true })
    .getByRole('radio', { name: 'English', exact: true })
    .click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings
    .getByRole('radiogroup', { name: 'Language you hear', exact: true })
    .getByRole('radio', { name: /^English/ })
    .click();
  await settings.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(board).toHaveAttribute('aria-label', 'Your board');
  await expect(board).toHaveAttribute('data-grid', '8');
  await expect.poll(snapshot).toEqual(before);
  await noHorizontalOverflow(page, '8×8 solo board');
  await page.screenshot({ path: info.outputPath('solo-8x8-english.png'), fullPage: true });
});

test('solo explains the smaller Indigenous-language pool and prevents unsupported 8×8 boards', async ({
  page,
}) => {
  await page.goto('/solo');
  await page
    .getByRole('radiogroup', { name: 'Contrincantes', exact: true })
    .getByRole('radio', { name: '3 computadoras', exact: true })
    .click();
  const sizes = page.getByRole('radiogroup', { name: 'Tamaño de la tabla', exact: true });
  await sizes.getByRole('radio', { name: '8×8', exact: true }).click();
  await page
    .getByRole('radiogroup', { name: 'Idioma que te cantamos', exact: true })
    .getByRole('radio', { name: 'Náhuatl', exact: true })
    .click();
  await expect(sizes.getByRole('radio', { name: /^8×8/ })).toBeDisabled();
  await expect(sizes.getByRole('radio', { name: /^8×8/ })).toContainText('Requiere 122 cartas');
  await expect(sizes.getByRole('radio', { name: '5×5', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('#solo-grid-help')).toContainText('baraja más pequeña');
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();
  const main = page.locator('main');
  const board = page.getByRole('list', { name: 'Tu tabla', exact: true });
  await expect(board).toHaveAttribute('data-grid', '5');
  await expect(board.locator('[data-marked]')).toHaveCount(25);
  await expect(main.locator('header')).toContainText('de 54');
  await expect(main.locator('tr[data-self="true"] td').last()).toHaveText('0/25');
  await noHorizontalOverflow(page, 'solo board using the original 54-card pool');
});
