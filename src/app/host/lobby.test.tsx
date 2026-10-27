import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import '../i18n';
import type { SavedRound } from './roundMachine';
import { DEFAULT_SETTINGS } from './roundMachine';

type Sent = { t: string; [k: string]: unknown };
const sent: Sent[] = [];
const handlers = new Set<(m: unknown) => void>();
const presence = new Set<(s: string[]) => void>();
const store: { round: SavedRound | null } = { round: null };

vi.mock('@net', () => ({
  createTransport: () => ({
    join: async () => undefined,
    send: (m: Sent) => sent.push(m),
    onMessage: (cb: (m: unknown) => void) => {
      handlers.add(cb);
      return () => handlers.delete(cb);
    },
    onPresence: (cb: (s: string[]) => void) => {
      presence.add(cb);
      return () => presence.delete(cb);
    },
    leave: async () => undefined,
    hostPublicKey: async () => 'KEY',
    isHostVerified: () => true,
    seat: 'host',
  }),
  generateHostKeyPair: async () => ({}),
  getSeat: () => 'host',
}));
vi.mock('./persist', () => ({
  saveRound: async (s: SavedRound) => {
    store.round = s;
  },
  loadRound: async () => store.round,
  clearRound: async () => {
    store.round = null;
  },
  loadKeyPair: async () => null,
  saveKeyPair: async () => undefined,
}));

import HostPage from './HostPage';

const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const tick = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const hello = (seat: string, name = 'Ana') => ({
  t: 'hello',
  seat,
  name,
  glyph: '🌽',
  labelLang: 'es',
});
const emit = (m: unknown) => act(async () => void handlers.forEach((h) => h(m)));
const lobbies = () => sent.filter((m) => m.t === 'lobby');

async function mount() {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => {
  cleanup();
  sent.length = 0;
  handlers.clear();
  presence.clear();
  store.round = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('host lobby', () => {
  it('broadcasts waiting lobby (debounced) on hello and on leave', async () => {
    await mount();
    await tick(400);
    sent.length = 0;
    await emit(hello('s1'));
    await act(async () => void presence.forEach((p) => p(['s1'])));
    await tick(100);
    expect(lobbies()).toHaveLength(0); // still debounced
    await tick(250);
    expect(lobbies()).toHaveLength(1);
    expect(lobbies()[0]).toMatchObject({ status: 'waiting', hostKey: 'KEY' });
    expect((lobbies()[0]!.players as unknown[]).length).toBe(1);
    expect(screen.getByText('Ana')).toBeTruthy();

    await act(async () => void presence.forEach((p) => p([])));
    await tick(5000);
    expect(screen.queryByText('Ana')).toBeTruthy(); // grace period
    await tick(7000);
    expect(screen.queryByText('Ana')).toBeNull();
    await tick(400);
    const last = lobbies()[lobbies().length - 1]!;
    expect((last.players as unknown[]).length).toBe(0);
  });

  it('resends the lobby every 10 s', async () => {
    await mount();
    await tick(400);
    sent.length = 0;
    await tick(10_000);
    expect(lobbies().length).toBeGreaterThanOrEqual(1);
  });

  it('Empezar sends lobby(started), round, assign, then the first call', async () => {
    await mount();
    await emit(hello('s1'));
    await tick(400);
    sent.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    const order = sent.map((m) => m.t);
    expect(order.slice(0, 4)).toEqual(['lobby', 'round', 'assign', 'call']);
    expect(sent[0]).toMatchObject({ status: 'started', roundNo: 1, hostKey: 'KEY' });
  });

  it('a late hello after start gets round, lobby(started) and assign', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    sent.length = 0;
    await emit(hello('late', 'Bea'));
    expect(sent.map((m) => m.t)).toEqual(['round', 'lobby', 'assign']);
    const lobby = sent[1]!;
    expect(lobby).toMatchObject({ status: 'started' });
    expect((lobby.players as { seat: string }[]).map((p) => p.seat)).toEqual(['late']);
  });

  it('hides Share without navigator.share and shows it with', async () => {
    await mount();
    expect(screen.queryByRole('button', { name: 'Compartir' })).toBeNull();
    cleanup();
    store.round = null;
    vi.stubGlobal('navigator', Object.assign(Object.create(navigator), { share: vi.fn() }));
    await mount();
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeTruthy();
  });

  it('shows a hint with zero players but still allows starting', async () => {
    await mount();
    expect(screen.getByText(/papel/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', false);
  });
});

const savedBase = (phase: SavedRound['phase']): SavedRound => ({
  code: 'ABCDE',
  roomSeed: 'SEEDSEED',
  roundNo: 1,
  calledCount: phase === 'setup' ? 0 : 3,
  settings: { ...DEFAULT_SETTINGS },
  winners: [],
  langs: ['es'],
  phase,
  assignments: {},
});

describe('resume', () => {
  it('returns to the lobby when the game had not started', async () => {
    store.round = savedBase('setup');
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar partida' }));
    await flush();
    await flush();
    expect(screen.getByRole('button', { name: 'Empezar' })).toBeTruthy();
    expect(screen.getAllByText(/ABC DE/).length).toBeGreaterThan(0);
  });

  it('returns to the game when a round was in progress', async () => {
    store.round = savedBase('paused');
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar partida' }));
    await flush();
    await flush();
    expect(screen.queryByRole('button', { name: 'Empezar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeTruthy();
    expect(sent.some((m) => m.t === 'lobby' && m.status === 'started')).toBe(true);
  });
});
