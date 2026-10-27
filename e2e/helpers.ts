import { expect, type BrowserContext, type Page } from '@playwright/test';

/** Spanish is the default UI language; accept English too so tests survive a locale switch. */
export const RX = {
  hostCta: /crear sala|create room/i,
  start: /^(empezar|start)$/i,
  join: /entrar a la sala|join the room/i,
  leave: /salir de la sala|leave the room/i,
  waiting:
    /ya casi empezamos|almost ready|esperando a que (quien canta|el cantor) empiece|waiting for the cantor/i,
};

export async function noHorizontalOverflow(page: Page, label: string): Promise<void> {
  const m = await page.evaluate(() => ({
    sw: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    iw: window.innerWidth,
  }));
  expect(m.sw, `horizontal overflow on ${label}`).toBeLessThanOrEqual(m.iw);
}

/** Host opens a room; returns the join URL read from the page. */
export async function createRoom(page: Page): Promise<{ code: string; joinUrl: string }> {
  await page.goto('/');
  await page.locator('#home-name').fill('Organiza');
  await page.locator('a[href="/host"]').first().click();
  await page.locator('input[name="host-mode"]').first().check();
  await expect(page).toHaveURL(/\/host/);
  const urlEl = page.getByRole('img', { name: /\/r\/[A-Z0-9]{5}#k=/ });
  await expect(urlEl).toBeVisible();
  const joinUrl = ((await urlEl.getAttribute('aria-label')) ?? '').trim();
  const code = /\/r\/([A-Z0-9]{5})/.exec(joinUrl)?.[1] ?? '';
  expect(code).toHaveLength(5);
  return { code, joinUrl };
}

export async function fillJoinForm(page: Page, name: string): Promise<void> {
  await page.getByLabel(/tu nombre|your name/i).fill(name);
  await page.getByRole('button', { name: /continuar|continue/i }).click();
  await page.getByRole('button', { name: /jugar en|play in/i }).click();
}

export async function newPage(ctx: BrowserContext): Promise<Page> {
  const p = await ctx.newPage();
  await p.addInitScript(() => {
    try {
      localStorage.setItem('loteria.lang', 'es');
    } catch {
      /* ignore */
    }
  });
  return p;
}
