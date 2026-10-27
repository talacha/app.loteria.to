import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '../i18n';

const sent: { t: string; [k: string]: unknown }[] = [];
vi.mock('@net', () => ({
  createTransport: () => ({
    join: async () => undefined,
    send: (m: { t: string }) => sent.push(m),
    onMessage: () => () => undefined,
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
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function started() {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  await flush();
}

describe('HostPage', () => {
  it('starts offline-tolerantly and sends round (with called) + first call', async () => {
    await started();
    expect(calls()).toHaveLength(1);
    const round = sent.find((m) => m.t === 'round');
    expect(round?.called).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Pausa' })).toBeTruthy();
  });

  it('auto-advances, pauses, resumes and advances with next', async () => {
    await started();
    await tick(10_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    await tick(60_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    await tick(10_000);
    expect(calls()).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente carta' }));
    expect(calls()).toHaveLength(4);
  });

  it('ignores keyboard shortcuts while a dialog is open', async () => {
    await started();
    fireEvent.keyDown(window, { key: 'l' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(window, { key: 'n' });
    expect(calls()).toHaveLength(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.keyDown(window, { key: 'n' });
    expect(calls()).toHaveLength(2);
  });
});
