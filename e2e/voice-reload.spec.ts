import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { createRoom, newPage, RX } from './helpers';

const cards = JSON.parse(readFileSync('src/content/cards.json', 'utf8')) as {
  id: string;
  names: { en: { text: string } };
}[];

test('player reload keeps the changed voice, board, crosses and points', async ({ context }) => {
  test.setTimeout(90_000);
  await context.clock.install();
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
  // Pause both screens' clock only after the lobby has loaded normally.
  await context.clock.pauseAt(await host.evaluate(() => Date.now() + 1000));
  await host.getByRole('button', { name: RX.start }).click();
  const board = phone.getByRole('list', { name: 'Tu tabla' });
  await expect(board).toBeVisible();
  await phone.getByRole('button', { name: 'Ajustes', exact: true }).click();
  await phone.getByRole('radio', { name: /^English/ }).click();
  await phone.getByRole('button', { name: 'Cerrar ajustes' }).click();
  const cardId = (source: string | null) => /\/(?:cards|art)\/([^/.]+)\./.exec(source ?? '')?.[1];
  const currentCard = async () =>
    cardId(await phone.getByTestId('call').locator('img').getAttribute('src'));
  const mine = new Set(
    (
      await board
        .locator('img')
        .evaluateAll((images) => images.map((image) => image.getAttribute('src')))
    ).map(cardId),
  );
  expect(mine.size).toBe(16);
  let target: string | undefined;
  // Assignments vary: answer a card on this phone's actual board, not just the first call.
  // The shared clock advances one complete window, then waits for its signed call to arrive.
  for (let window = 0; window < 54; window++) {
    const id = await currentCard();
    expect(id).toBeTruthy();
    if (mine.has(id)) {
      target = id;
      break;
    }
    await context.clock.fastForward(6000);
    await expect.poll(currentCard).not.toBe(id);
  }
  expect(
    target,
    'a called card must belong to the phone board within the covered deck',
  ).toBeTruthy();
  const name = cards.find((card) => card.id === target)!.names.en.text;
  await phone.getByRole('button', { name, exact: true }).click();
  await expect(phone.getByTestId('points')).not.toHaveText('0 puntos');
  await context.clock.fastForward(6000);
  const targetCell = board.locator(
    `[data-marked]:has(img[src$="/${target}.webp"]), [data-marked]:has(img[src$="/${target}.svg"])`,
  );
  await expect(targetCell).toHaveAttribute('data-marked', 'true');
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
