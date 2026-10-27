import { expect, test, type Page } from '@playwright/test';
import { RX, createRoom, fillJoinForm, newPage, noHorizontalOverflow } from './helpers';

const roster = (p: Page) =>
  p.getByRole('list', { name: /personas en la sala|people in the room/i });
const inGame = (p: Page) => p.getByRole('list', { name: /tu tabla|your board/i });

test('host + 2 players lobby, leave, start, late joiner', async ({ context }, info) => {
  test.setTimeout(60_000);
  const host = await newPage(context);
  const { code, joinUrl } = await createRoom(host);
  await noHorizontalOverflow(host, `host lobby (${info.project.name})`);

  // Player A joins through the link.
  const a = await newPage(context);
  await a.goto(joinUrl);
  await noHorizontalOverflow(a, 'join form');
  await fillJoinForm(a, 'Ana');
  await expect(a.getByText(RX.waiting)).toBeVisible();
  await noHorizontalOverflow(a, 'player lobby');

  // Player B joins by typing the code on Home.
  const b = await newPage(context);
  await b.goto('/');
  await noHorizontalOverflow(b, 'home');
  await b.locator('#join-code').fill(code);
  await b.getByRole('button', { name: /^(entrar|go)$/i }).click();
  await expect(b).toHaveURL(new RegExp(`/r/${code}`));
  await fillJoinForm(b, 'Beto');
  await expect(b.getByText(RX.waiting)).toBeVisible();

  // Roster shows both everywhere.
  for (const p of [host, a, b]) {
    await expect(roster(p).getByRole('listitem')).toHaveCount(2);
    await expect(roster(p)).toContainText('Ana');
    await expect(roster(p)).toContainText('Beto');
  }
  await noHorizontalOverflow(host, 'host lobby with roster');

  // Beto leaves -> removed everywhere (host grace is 4 s).
  await b.getByRole('button', { name: RX.leave }).click();
  for (const p of [host, a]) {
    await expect(roster(p).getByRole('listitem')).toHaveCount(1, { timeout: 6_000 });
    await expect(roster(p)).not.toContainText('Beto');
  }

  // Beto rejoins, then host starts.
  await b.goto(joinUrl);
  await fillJoinForm(b, 'Beto');
  await expect(roster(host).getByRole('listitem')).toHaveCount(2);

  await host.getByRole('button', { name: RX.start }).click();
  await expect(host.locator('#cur-h')).toContainText(/1/);
  await noHorizontalOverflow(host, 'host game');
  for (const p of [a, b]) {
    await expect(inGame(p)).toBeVisible();
    await expect(p.getByText(RX.waiting)).toHaveCount(0);
  }
  await noHorizontalOverflow(a, 'player game');

  // Late joiner lands directly in the game.
  const c = await newPage(context);
  await c.goto(joinUrl);
  await fillJoinForm(c, 'Carla');
  await expect(inGame(c)).toBeVisible();
  await noHorizontalOverflow(c, 'late joiner game');
});

test('idle message volume stays low with 2 players', async ({ context }) => {
  test.setTimeout(60_000);
  const host = await newPage(context);
  const { joinUrl, code } = await createRoom(host);
  const spy = await newPage(context);
  await spy.goto('/');
  // Listen on every plausible channel name that embeds the room code.
  await spy.evaluate((c) => {
    const w = window as unknown as { __frames: number; __chans: BroadcastChannel[] };
    w.__frames = 0;
    w.__chans = [
      `loteria:${c}`,
      `loteria-${c}`,
      `loteria/${c}`,
      `room:${c}`,
      c,
      `loteria:room:${c}`,
    ].map((n) => {
      const ch = new BroadcastChannel(n);
      ch.onmessage = () => void w.__frames++;
      return ch;
    });
  }, code);
  for (const name of ['Ana', 'Beto']) {
    const p = await newPage(context);
    await p.goto(joinUrl);
    await fillJoinForm(p, name);
    await expect(p.getByText(RX.waiting)).toBeVisible();
  }
  await expect(roster(host).getByRole('listitem')).toHaveCount(2);
  const before = await spy.evaluate(() => (window as unknown as { __frames: number }).__frames);
  expect(before, 'spy must have seen the join traffic (channel name sanity)').toBeGreaterThan(0);
  await spy.waitForTimeout(20_000);
  const after = await spy.evaluate(() => (window as unknown as { __frames: number }).__frames);
  expect(after - before, 'BroadcastChannel frames over 20 s idle').toBeLessThan(60);
});

test('player refresh mid-lobby rejoins without the form', async ({ context }) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  const a = await newPage(context);
  await a.goto(joinUrl);
  await fillJoinForm(a, 'Ana');
  await expect(a.getByText(RX.waiting)).toBeVisible();
  await a.reload();
  await expect(a.getByText(RX.waiting)).toBeVisible();
  await expect(a.getByLabel(/tu nombre|your name/i)).toHaveCount(0);
  await expect(roster(host).getByRole('listitem')).toHaveCount(1);
  await expect(roster(host)).toContainText('Ana');
});

test('host reload -> resume keeps players', async ({ context }) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  for (const n of ['Ana', 'Beto']) {
    const p = await newPage(context);
    await p.goto(joinUrl);
    await fillJoinForm(p, n);
    await expect(p.getByText(RX.waiting)).toBeVisible();
  }
  await expect(roster(host).getByRole('listitem')).toHaveCount(2);
  await host.reload();
  await host.getByRole('button', { name: /reanudar partida|resume/i }).click();
  await expect(roster(host).getByRole('listitem')).toHaveCount(2, { timeout: 5_000 });
  await expect(roster(host)).toContainText('Ana');
  await expect(roster(host)).toContainText('Beto');
});

test('host Quitar removes a player', async ({ context }) => {
  const host = await newPage(context);
  const { joinUrl } = await createRoom(host);
  const a = await newPage(context);
  await a.goto(joinUrl);
  await fillJoinForm(a, 'Ana');
  await expect(roster(host).getByRole('listitem')).toHaveCount(1);
  await host.getByText(/quitar a alguien|remove someone/i).click();
  await host.getByRole('button', { name: /quitar a ana|remove ana/i }).click();
  await expect(roster(host).getByRole('listitem')).toHaveCount(0);
  await expect(roster(a).getByRole('listitem')).toHaveCount(0, { timeout: 6_000 });
});
