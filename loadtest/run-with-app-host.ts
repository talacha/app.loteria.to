/**
 * Drives the REAL app host in Playwright against a built app (vite preview).
 * Prereq: `pnpm build` done (this script starts `vite preview` on LOADTEST_PORT, default 4174).
 * Selectors follow e2e/helpers.ts; adjust RX if the host UI copy changes.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium, type Browser, type Page } from '@playwright/test';
import { sleep } from './common.ts';

const port = Number(process.env.LOADTEST_PORT ?? 4174);
const base = process.env.LOADTEST_BASE_URL ?? `http://localhost:${port}`;
const RX = {
  start: /^(empezar|start)$/i,
  winner: /¡?lotería!?|ganó|wins|winner/i,
};

export async function launchAppHost(): Promise<{
  code: string;
  hostKey: string;
  startRound(): Promise<void>;
  waitEnd(): Promise<void>;
  close(): Promise<void>;
}> {
  let server: ChildProcess | null = null;
  if (!process.env.LOADTEST_BASE_URL) {
    server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', String(port), '--strictPort'], {
      stdio: 'ignore',
    });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {
        /* not up yet */
      }
      await sleep(200);
    }
  }
  const browser: Browser = await chromium.launch();
  const page: Page = await (await browser.newContext({ locale: 'es-MX' })).newPage();
  await page.goto(base + '/');
  await page.locator('a[href="/host"]').first().click();
  const el = page.getByText(/\/r\/[A-Z0-9]{5}#k=/);
  await el.waitFor({ timeout: 15000 });
  const joinUrl = ((await el.textContent()) ?? '').trim();
  const code = /\/r\/([A-Z0-9]{5})/.exec(joinUrl)?.[1] ?? '';
  const hostKey = decodeURIComponent(/#k=([^&\s]+)/.exec(joinUrl)?.[1] ?? '');
  if (!code || !hostKey) throw new Error('could not read join URL from host page');
  return {
    code,
    hostKey,
    async startRound() {
      await page.getByRole('button', { name: RX.start }).click();
    },
    async waitEnd() {
      await page
        .getByText(RX.winner)
        .first()
        .waitFor({ timeout: 10 * 60_000 });
    },
    async close() {
      await browser.close();
      server?.kill();
    },
  };
}
