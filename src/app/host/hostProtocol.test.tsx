import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { cards } from '@content';
import { tabla } from '@engine';
import { LocalTransport } from '@net';
import type { Msg } from '@net';
import '../i18n';
import type { SavedRound } from './roundMachine';

// In-memory persistence shared across mounts (simulates IndexedDB across reloads).
const store: { round: SavedRound | null; keys: Map<string, CryptoKeyPair> } = {
  round: null,
  keys: new Map(),
};
vi.mock('./persist', () => ({
  saveRound: async (s: SavedRound) => {
    store.round = s;
  },
  loadRound: async () => store.round,
  clearRound: async () => {
    store.round = null;
  },
  loadKeyPair: async (c: string) => store.keys.get(c) ?? null,
  saveKeyPair: async (c: string, k: CryptoKeyPair) => {
    store.keys.set(c, k);
  },
}));

import HostPage from './HostPage';

const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const players: LocalTransport[] = [];
let n = 0;

async function player(code: string) {
  const t = new LocalTransport({ seat: `seat${n++}` });
  await t.join(code, 'player');
  const got: Msg[] = [];
  t.onMessage((m) => got.push(m));
  players.push(t);
  return { t, got, seat: t.seat };
}
const hello = (seat: string): Msg => ({
  t: 'hello',
  seat,
  name: 'Ana',
  glyph: '🌽',
  labelLang: 'es',
});
const wait = (f: () => void) => waitFor(f, { timeout: 4000 });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  cleanup();
  await Promise.all(players.map((p) => p.leave()));
  players.length = 0;
  store.round = null;
  store.keys.clear();
});

async function host() {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await screen.findByText('Sala sin verificar', undefined, { timeout: 4000 });
  fireEvent.click(await screen.findByRole('button', { name: 'Empezar' }));
  await wait(() => expect(store.round).toBeTruthy());
  await new Promise((r) => setTimeout(r, 300));
  return store.round!.code;
}

describe('host protocol v2 (LocalTransport)', () => {
  it('answers one hello with at most 3 frames and a valid assign', async () => {
    const code = await host();
    const p = await player(code);
    p.t.send(hello(p.seat));
    await wait(() => expect(p.got.some((m) => m.t === 'assign')).toBe(true));
    await new Promise((r) => setTimeout(r, 300));
    expect(p.got.map((m) => m.t)).toEqual(['round', 'lobby', 'assign', 'call']);
    expect(p.got.find((m) => m.t === 'round')).toBeTruthy();
    // second hello inside 2 s is ignored
    const before = p.got.length;
    p.t.send(hello(p.seat));
    await new Promise((r) => setTimeout(r, 300));
    expect(p.got.length).toBe(before);
  });

  it('assigns unique indices across 40 seats', async () => {
    const code = await host();
    const ps = [];
    for (let i = 0; i < 40; i++) ps.push(await player(code));
    const watcher = ps[0]!;
    for (const p of ps) p.t.send(hello(p.seat));
    await wait(() =>
      expect(new Set(watcher.got.filter((m) => m.t === 'assign').map((m) => m.seat)).size).toBe(40),
    );
    const idx = watcher.got.flatMap((m) => (m.t === 'assign' ? [m.tablaIndex] : []));
    expect(new Set(idx).size).toBe(40);
  }, 20000);

  it('rejects claims for another index or a stale round', async () => {
    vi.useFakeTimers({ toFake: ['Date'], now: Date.now() });
    const code = await host();
    const p = await player(code);
    p.t.send(hello(p.seat));
    await wait(() => expect(p.got.some((m) => m.t === 'assign')).toBe(true));
    const assign = p.got.find((m) => m.t === 'assign') as Extract<Msg, { t: 'assign' }>;
    const seed = (p.got.find((m) => m.t === 'round') as Extract<Msg, { t: 'round' }>).seed;
    const marks = tabla(seed, assign.tablaIndex, deck).cards;
    const results = () =>
      p.got.filter((m): m is Extract<Msg, { t: 'claimResult' }> => m.t === 'claimResult');
    p.t.send({
      t: 'claim',
      seat: p.seat,
      roundNo: 1,
      tablaIndex: (assign.tablaIndex + 1) % 4096,
      marks,
    });
    await wait(() => expect(results()).toHaveLength(1));
    expect(results()[0]!.valid).toBe(false);
    vi.setSystemTime(Date.now() + 3500);
    p.t.send({ t: 'claim', seat: p.seat, roundNo: 7, tablaIndex: assign.tablaIndex, marks });
    await wait(() => expect(results()).toHaveLength(2));
    expect(results()[1]!.valid).toBe(false);
    vi.setSystemTime(Date.now() + 3500);
    // Marks are never trusted: the host's crossed-out set is empty, so this is not a win either.
    p.t.send({ t: 'claim', seat: p.seat, roundNo: 1, tablaIndex: assign.tablaIndex, marks });
    await wait(() => expect(results()).toHaveLength(3));
    expect(results()[2]!.valid).toBe(false);
  }, 20000);

  it('resume reuses the same host key', async () => {
    const code = await host();
    const p = await player(code);
    p.t.send(hello(p.seat));
    const keyOf = () => p.got.flatMap((m) => (m.t === 'round' && m.hostKey ? [m.hostKey] : []))[0];
    await wait(() => expect(keyOf()).toBeTruthy());
    const first = keyOf();
    cleanup();
    await new Promise((r) => setTimeout(r, 100));
    p.got.length = 0;
    render(
      <MemoryRouter>
        <HostPage />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Reanudar partida' }));
    await wait(() => expect(keyOf()).toBeTruthy());
    expect(keyOf()).toBe(first);
  }, 20000);
});
