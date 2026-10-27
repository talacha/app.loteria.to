import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '../i18n';

const sent: { t: string; [k: string]: unknown }[] = [];
const handlers = new Set<(m: unknown) => void>();
vi.mock('@net', () => ({
  createTransport: () => ({
    join: async () => undefined,
    send: (m: { t: string }) => sent.push(m),
    onMessage: (cb: (m: unknown) => void) => {
      handlers.add(cb);
      return () => handlers.delete(cb);
    },
    onPresence: () => () => undefined,
    leave: async () => undefined,
    hostPublicKey: async () => 'KEY',
    isHostVerified: () => true,
    seat: 'host',
  }),
  generateHostKeyPair: async () => ({}),
  getSeat: () => 'host',
}));
vi.mock('./persist', () => ({
  saveRound: async () => undefined,
  loadRound: async () => null,
  clearRound: async () => undefined,
  loadKeyPair: async () => null,
  saveKeyPair: async () => undefined,
}));

import HostPage from './HostPage';

const calls = () => sent.filter((m) => m.t === 'call');
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const tick = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => {
  cleanup();
  sent.length = 0;
  handlers.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const emit = (m: unknown) => act(async () => void handlers.forEach((h) => h(m)));
const hello = (seat: string) => ({ t: 'hello', seat, name: seat, glyph: '🌽', labelLang: 'es' });
const mountHost = async () => {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
};

async function started() {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  await emit(hello('a'));
  await emit(hello('b'));
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  await flush();
}

describe('HostPage', () => {
  it('starts offline-tolerantly and sends round + first call', async () => {
    await started();
    expect(calls()).toHaveLength(1);
    const round = sent.find((m) => m.t === 'round');
    expect(round).toMatchObject({ roundNo: 1, speedSec: 10 });
    const call = calls()[0]!;
    expect(call).not.toHaveProperty('lang');
    expect(call.choices).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeTruthy();
  });

  it('auto-advances, pauses and resumes; there is no manual next', async () => {
    await started();
    await tick(10_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    await tick(60_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await tick(10_000);
    expect(calls()).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Siguiente carta' })).toBeNull();
  });

  it('shows the picture, not the word, and a card counter', async () => {
    await started();
    expect(screen.getByText('Carta 1')).toBeTruthy();
    expect(screen.getByText('de 54')).toBeTruthy();
    expect(screen.getByText('0 de 2 ya eligieron')).toBeTruthy();
    expect(document.querySelector('figure img, figure span')).toBeTruthy();
  });
});

describe('room code', () => {
  const posts = () =>
    (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === 'POST')
      .map(([, init]) => JSON.parse((init as RequestInit).body as string).code as string);

  it('generates a code at once and retries a new one when it is taken (409)', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          return n++ < 2
            ? new Response('{}', { status: 409 })
            : new Response('{}', { status: 201 });
        }
        return new Response('{}', { status: 404 });
      }),
    );
    await mountHost();
    await tick(100);
    const codes = posts();
    expect(codes).toHaveLength(3);
    expect(new Set(codes).size).toBe(3);
    expect(screen.getByText('En línea')).toBeTruthy();
    // The code on screen is the last, reserved one.
    expect(
      screen.getAllByRole('img', { name: new RegExp(codes[2]!.split('').join(' ')) }).length,
    ).toBeGreaterThan(0);
  });

  it('falls back to a random code when offline', async () => {
    await mountHost();
    await tick(100);
    expect(screen.getByText('Sala sin verificar')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', true);
  });
});
