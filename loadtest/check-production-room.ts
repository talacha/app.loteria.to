/** Explicit production smoke: creates one room and joins one phone over real Supabase. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium, expect, type Page } from '@playwright/test';
import { createRoom, fillJoinForm, noHorizontalOverflow, RX } from '../e2e/helpers';
import { PROTOCOL_VERSION } from '../src/net/session';

const base = process.env.LOADTEST_ROOM_BASE_URL;
if (!base) throw new Error('Set LOADTEST_ROOM_BASE_URL explicitly to authorize a room smoke.');
const output = process.env.LOADTEST_ROOM_OUTPUT_DIR ?? 'loadtest/reports/production-room';
mkdirSync(output, { recursive: true });
const cards = JSON.parse(readFileSync('src/content/cards.json', 'utf8')) as {
  id: string;
  names: { es: { text: string } };
}[];
interface Observation {
  direction: 'sent' | 'received';
  type: string;
  version?: number;
  deckCards?: number;
}
const frames: Observation[] = [];
let sockets = 0;
function observe(page: Page) {
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/realtime/')) return;
    sockets++;
    const listener =
      (direction: Observation['direction']) =>
      ({ payload }: { payload: string | Buffer }) => {
        try {
          const inspect = (value: unknown): void => {
            if (!value || typeof value !== 'object') return;
            const f = value as { role?: string; m?: { t?: string; deck?: unknown[] }; v?: number };
            if (f.role && f.m?.t) {
              frames.push({
                direction,
                type: f.m.t,
                version: f.v,
                ...(f.m.deck ? { deckCards: f.m.deck.length } : {}),
              });
              return;
            }
            for (const child of Object.values(value)) inspect(child);
          };
          inspect(JSON.parse(payload.toString()));
        } catch {
          /* Ignore websocket control frames; never record credentials or room keys. */
        }
      };
    socket.on('framesent', listener('sent'));
    socket.on('framereceived', listener('received'));
  });
}

const browser = await chromium.launch();
try {
  const hostContext = await browser.newContext({ baseURL: base, locale: 'es-MX' });
  const phoneContext = await browser.newContext({
    baseURL: base,
    locale: 'es-MX',
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const host = await hostContext.newPage();
  const phone = await phoneContext.newPage();
  observe(host);
  observe(phone);
  const { joinUrl } = await createRoom(host);
  await host.locator('input[name="host-mode"]').nth(1).check();
  await phone.goto(joinUrl);
  await fillJoinForm(phone, 'Prueba de conexión');
  await expect(phone.getByText(RX.waiting)).toBeVisible({ timeout: 30_000 });
  await expect(host.getByRole('button', { name: RX.start })).toBeEnabled({ timeout: 30_000 });
  await host.getByRole('button', { name: RX.start }).click();
  await expect(phone.getByRole('list', { name: 'Tu tabla' })).toBeVisible({ timeout: 30_000 });
  await expect(phone.getByTestId('call').locator('img')).toBeVisible({ timeout: 30_000 });
  const source = await phone.getByTestId('call').locator('img').getAttribute('src');
  const id = /\/cards\/([^/.]+)\./.exec(source ?? '')?.[1];
  const card = cards.find((c) => c.id === id);
  if (!card) throw new Error('Current live card is not in the local catalog');
  await phone.getByRole('button', { name: card.names.es.text, exact: true }).click();
  await expect(phone.getByTestId('points')).not.toHaveText('0 puntos', { timeout: 30_000 });
  await noHorizontalOverflow(host, 'production host');
  await noHorizontalOverflow(phone, 'production phone');
  expect(sockets, 'real Supabase websocket connections').toBeGreaterThanOrEqual(2);
  expect(frames).toContainEqual({
    direction: 'received',
    type: 'round',
    version: PROTOCOL_VERSION,
    deckCards: cards.length,
  });
  expect(frames.some((f) => f.direction === 'sent' && f.type === 'pick')).toBe(true);
  await host.screenshot({ path: output + '/host.png' });
  await phone.screenshot({ path: output + '/phone.png' });
  const report = {
    pass: true,
    protocol: PROTOCOL_VERSION,
    catalogCards: cards.length,
    sockets,
    points: await phone.getByTestId('points').innerText(),
    frames,
  };
  writeFileSync(output + '/report.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
