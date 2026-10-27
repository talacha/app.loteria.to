import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createRoom, newPage, RX } from './helpers';

const cards = JSON.parse(readFileSync('src/content/cards.json', 'utf8')) as {
  id: string;
  names: { en: { text: string } };
}[];

test('player reload keeps the changed voice, board, crosses and points', async ({ context }) => {
  test.setTimeout(90_000);
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  await host.locator('input[name="host-mode"]').nth(1).check();
  await host.getByText('Ajustes de la partida', { exact: true }).click();
  await host.getByRole('slider').fill('6');
  await host
    .getByRole('radiogroup', { name: 'Idioma hablado al empezar' })
    .getByRole('radio', { name: 'Náhuatl', exact: true })
    .click();
  await host.getByRole('textbox', { name: /Escribe las 8/ }).fill('ABCD2345');
  await host.getByRole('button', { name: 'Usar esta semilla', exact: true }).click();
  const phone = await newPage(context);
  await phone.goto(joinUrl);
  await phone.getByLabel(/tu nombre/i).fill('Ana');
  await phone.getByRole('button', { name: /continuar/i }).click();
  await phone.getByRole('radio', { name: /Náhuatl/ }).click();
  await phone.getByRole('button', { name: /jugar en/i }).click();
  await host.getByRole('button', { name: RX.start }).click();
  const board = phone.getByRole('list', { name: 'Tu tabla' });
  await expect(board).toBeVisible();
  await phone.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await phone.getByRole('radio', { name: /^English/ }).click();
  await phone.getByRole('button', { name: 'Cerrar ajustes' }).click();
  const source = await phone.getByTestId('call').locator('img').getAttribute('src');
  const id = /\/(?:cards|art)\/([^/.]+)\./.exec(source ?? '')?.[1];
  const name = cards.find((card) => card.id === id)!.names.en.text;
  await phone.getByRole('button', { name, exact: true }).click();
  await expect(phone.getByTestId('points')).not.toHaveText('0 puntos');
  await expect
    .poll(() => board.locator('[data-marked="true"]').count(), { timeout: 60_000 })
    .toBeGreaterThan(0);
  await host.getByRole('button', { name: /^pausa$/i }).click();
  const snapshot = async () => ({
    cells: await board.locator('[data-marked]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        image: node.querySelector('img')?.getAttribute('src'),
        marked: node.getAttribute('data-marked'),
      })),
    ),
    points: await phone.getByTestId('points').innerText(),
  });
  const before = await snapshot();
  await phone.reload();
  await expect(board).toBeVisible();
  await expect(phone.locator('main header')).toContainText('English');
  await expect.poll(snapshot).toEqual(before);
});
