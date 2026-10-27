import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { noHorizontalOverflow } from './helpers';

const cards = JSON.parse(readFileSync('src/content/cards.json', 'utf8')) as {
  id: string;
  names: { es: { text: string; audio: string }; en: { text: string; audio: string } };
}[];

test('solo changes app and spoken languages mid-round without replacing the game', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    localStorage.setItem('loteria.lang', 'es');
    localStorage.setItem(
      'loteria:profile',
      JSON.stringify({ name: 'Ana', glyph: '🐆', uiLang: 'es', spokenLang: 'es' }),
    );
    // Observe the actual clip selected by the app without relying on browser autoplay.
    const playedClips: string[] = [];
    Object.assign(window, { __playedClips: playedClips });
    HTMLMediaElement.prototype.play = function () {
      playedClips.push(this.src);
      return Promise.resolve();
    };
  });
  await page.clock.install();
  await page.goto('/solo');
  await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeVisible();
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await page.getByRole('button', { name: 'Empezar', exact: true }).click();

  const main = page.locator('main');
  const board = page.getByRole('list', { name: /^(Tu tabla|Your board)$/ });
  await expect(board).toBeVisible();
  const currentSource = () => main.locator('img').first().getAttribute('src');
  const currentCard = async () => {
    const id = /\/(?:cards|art)\/([^/.]+)\./.exec((await currentSource()) ?? '')?.[1];
    const card = cards.find((candidate) => candidate.id === id);
    expect(card, 'the current picture must identify a catalog card').toBeTruthy();
    return card!;
  };
  const lastClip = () =>
    page.evaluate(() => (window as unknown as { __playedClips: string[] }).__playedClips.at(-1));
  const first = await currentCard();
  await expect.poll(lastClip).toContain(first.names.es.audio);
  await main
    .getByRole('group', { name: 'Elige cómo se escribe', exact: true })
    .getByRole('button', { name: first.names.es.text, exact: true })
    .click();
  await expect(main.locator('tr[data-self="true"] td').nth(1)).toHaveText('2');

  // Close one call and partially advance the next, so a restart cannot look unchanged.
  await page.clock.runFor(9000);
  await main.getByRole('button', { name: 'Pausa', exact: true }).click();
  await expect(main.getByRole('button', { name: 'Seguir', exact: true })).toBeVisible();
  const snapshot = async () => ({
    cells: await board.locator('[data-marked]').evaluateAll((nodes) =>
      nodes.map((node) => ({
        image: node.querySelector('img')?.getAttribute('src'),
        marked: node.getAttribute('data-marked'),
      })),
    ),
    call: await currentSource(),
    callNumber: /(?:Carta|Card) (\d+) (?:de|of) (\d+)/
      .exec(await main.locator('header').innerText())
      ?.slice(1),
    progress: await main.getByRole('progressbar').getAttribute('aria-valuenow'),
    points: await main.locator('tr[data-self="true"] td').nth(1).innerText(),
  });
  const before = await snapshot();
  expect(before.cells).toHaveLength(16);
  expect(before.callNumber).toEqual(['2', '144']);
  expect(Number(before.progress)).toBeGreaterThan(0);
  expect(before.points).toBe('2');
  const current = await currentCard();

  await main.getByRole('button', { name: 'Ajustes de idioma', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Ajustes', exact: true });
  await expect(dialog).toBeVisible();
  const spoken = dialog.getByRole('radiogroup', { name: 'Idioma que escuchas', exact: true });
  await expect(spoken.getByRole('radio', { name: /^Náhuatl/ })).toBeDisabled();
  await dialog
    .getByRole('radiogroup', { name: 'Idioma de la app', exact: true })
    .getByRole('radio', { name: 'English', exact: true })
    .click();
  dialog = page.getByRole('dialog', { name: 'Settings', exact: true });
  await dialog
    .getByRole('radiogroup', { name: 'Language you hear', exact: true })
    .getByRole('radio', { name: /^English/ })
    .click();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(main.getByRole('button', { name: 'Resume', exact: true })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Leave', exact: true })).toBeVisible();
  const englishChoices = main.getByRole('group', { name: 'Pick the spelling', exact: true });
  await expect(
    englishChoices.getByRole('button', { name: current.names.en.text, exact: true }),
  ).toBeDisabled();
  await expect.poll(snapshot).toEqual(before);
  await main.getByRole('button', { name: 'Replay the card', exact: true }).click();
  await expect.poll(lastClip).toContain(current.names.en.audio);

  // The global gear must reflect the same preferences changed by the in-game sheet.
  await page.locator('header').first().getByRole('button', { name: 'Language settings' }).click();
  const shared = page.getByRole('dialog', { name: 'Settings', exact: true });
  await expect(
    shared
      .getByRole('radiogroup', { name: 'App language', exact: true })
      .getByRole('radio', { name: 'English', exact: true }),
  ).toHaveAttribute('aria-checked', 'true');
  await expect(
    shared
      .getByRole('radiogroup', { name: 'Language you hear', exact: true })
      .getByRole('radio', { name: /^English/ }),
  ).toHaveAttribute('aria-checked', 'true');
  await shared.getByRole('button', { name: 'Close', exact: true }).click();
  await expect.poll(snapshot).toEqual(before);

  await main.getByRole('button', { name: 'Resume', exact: true }).click();
  await page.clock.runFor(8000);
  await main.getByRole('button', { name: 'Pause', exact: true }).click();
  const after = await snapshot();
  expect(after.callNumber).toEqual(['3', '144']);
  expect(after.cells.map((cell) => cell.image)).toEqual(before.cells.map((cell) => cell.image));
  expect(after.points).toBe('2');
  const next = await currentCard();
  await expect.poll(lastClip).toContain(next.names.en.audio);
  await noHorizontalOverflow(page, 'solo after changing both languages');
  await page.screenshot({ path: info.outputPath('solo-language-switch.png'), fullPage: true });
});
