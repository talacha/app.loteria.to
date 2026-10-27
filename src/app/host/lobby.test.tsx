import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
    expect(screen.queryAllByText('Ana').length).toBeGreaterThan(0);

    await act(async () => void presence.forEach((p) => p([])));
    await tick(2000);
    expect(screen.queryAllByText('Ana').length).toBeGreaterThan(0); // grace period
    await tick(3000);
    expect(screen.queryAllByText('Ana')).toHaveLength(0);
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
    await emit(hello('s2', 'Bea'));
    await tick(400);
    sent.length = 0;
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    const order = sent.map((m) => m.t);
    expect(order.slice(0, 5)).toEqual(['lobby', 'round', 'assign', 'assign', 'call']);
    expect(sent[0]).toMatchObject({ status: 'started', roundNo: 1, hostKey: 'KEY' });
  });

  it('a late hello after start gets round, lobby(started) and assign', async () => {
    await mount();
    await emit(hello('s1'));
    await emit(hello('s2', 'Bea'));
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    sent.length = 0;
    await emit(hello('late', 'Cris'));
    expect(sent.map((m) => m.t)).toEqual(['round', 'lobby', 'assign', 'call']);
    const lobby = sent[1]!;
    expect(lobby).toMatchObject({ status: 'started' });
    expect((lobby.players as { seat: string }[]).map((p) => p.seat)).toEqual(['s1', 's2', 'late']);
  });

  it('after start, the 21st hello gets lobby(full) and is not added', async () => {
    await mount();
    for (let i = 0; i < 20; i++) await emit(hello(`p${i}`, `N${i}`));
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    sent.length = 0;
    await emit(hello('extra', 'Extra'));
    expect(sent.some((m) => m.t === 'lobby' && m.status === 'full')).toBe(true);
    expect(sent.some((m) => m.t === 'assign' && m.seat === 'extra')).toBe(false);
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

  it('disables Empezar until 2 players have joined and says how many are missing', async () => {
    await mount();
    const start = screen.getByRole('button', { name: 'Empezar' });
    expect(start).toHaveProperty('disabled', true);
    expect(screen.getByText('Faltan 2 personas')).toBeTruthy();
    fireEvent.click(start);
    await flush();
    expect(sent.some((m) => m.t === 'call')).toBe(false);
    await emit(hello('s1'));
    expect(screen.getByText('Falta 1 persona')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', true);
    await emit(hello('s2', 'Bea'));
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', false);
    expect(screen.queryByText(/Falta/)).toBeNull();
  });
});

describe('host screen mode', () => {
  it('defaults to display only, and "Jugar también" is saved and restored on Reanudar', async () => {
    await mount();
    expect(screen.getByRole('radio', { name: /Solo pantalla/ })).toHaveProperty('checked', true);
    fireEvent.click(screen.getByRole('radio', { name: /Jugar también/ }));
    await tick(400);
    expect(store.round?.settings.hostPlays).toBe(true);
    cleanup();
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar partida' }));
    await flush();
    await flush();
    expect(screen.getByRole('radio', { name: /Jugar también/ })).toHaveProperty('checked', true);
    // The organiser's seat is back in the roster after resume and counts toward the gate.
    await emit(hello('s1'));
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', false);
  });
});

describe('roster control', () => {
  it('limits hellos per seat, removes and ignores banned seats, caps at 20', async () => {
    await mount();
    await emit(hello('s1', 'Ana'));
    await emit(hello('s1', 'Otra')); // within 2 s: ignored
    expect(screen.queryAllByText('Ana').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Otra')).toHaveLength(0);
    document.querySelectorAll('details').forEach((d) => (d.open = true));
    fireEvent.click(screen.getByRole('button', { name: 'Quitar a Ana' }));
    expect(screen.queryAllByText('Ana')).toHaveLength(0);
    await tick(3000);
    await emit(hello('s1', 'Ana'));
    expect(screen.queryAllByText('Ana')).toHaveLength(0); // banned for the session

    for (let i = 0; i < 20; i++) await emit(hello(`p${i}`, `N${i}`));
    expect(screen.getAllByText(/20\/20/).length).toBeGreaterThan(0);
    sent.length = 0;
    await emit(hello('extra', 'Extra')); // the 21st
    expect(screen.queryAllByText('Extra')).toHaveLength(0);
    const l = lobbies();
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ status: 'full' });
    expect((l[0]!.players as unknown[]).length).toBe(20);
  });

  it('persists the roster and restores it on resume', async () => {
    await mount();
    await emit(hello('s1', 'Ana'));
    await tick(400);
    expect(store.round?.roster?.map((p) => p.name)).toEqual(['Ana']);
    cleanup();
    sent.length = 0;
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar partida' }));
    await flush();
    await flush();
    expect(screen.queryAllByText('Ana').length).toBeGreaterThan(0);
    await tick(400);
    expect(lobbies().some((m) => (m.players as unknown[]).length === 1)).toBe(true);
    await tick(5000); // never came back
    expect(screen.queryAllByText('Ana')).toHaveLength(0);
  });

  it('has exactly one main landmark with id=main', async () => {
    await mount();
    expect(document.querySelectorAll('main#main')).toHaveLength(1);
    await emit(hello('s1'));
    await emit(hello('s2', 'Bea'));
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    expect(document.querySelectorAll('main#main')).toHaveLength(1);
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
    expect(screen.getAllByRole('img', { name: /A B C D E/ }).length).toBeGreaterThan(0);
  });

  it('returns to the game when a round was in progress', async () => {
    store.round = savedBase('paused');
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar partida' }));
    await flush();
    await flush();
    expect(screen.queryByRole('button', { name: 'Empezar' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reanudar' })).toBeTruthy();
    expect(sent.some((m) => m.t === 'lobby' && m.status === 'started')).toBe(true);
  });
});

describe('host lobby: grid size and room defaults', () => {
  const openSettings = () => document.querySelectorAll('details').forEach((d) => (d.open = true));

  it('offers 3x3..8x8, disabling sizes the 54-card deck cannot deal', async () => {
    await mount();
    await emit(hello('s1'));
    await emit(hello('s2', 'Beto'));
    await tick(400);
    openSettings();
    const group = screen.getByRole('radiogroup', { name: 'Tamaño de la tabla' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '3×3',
      '4×4',
      '5×5',
      '6×6 Requiere 59 cartas',
      '7×7 Requiere 83 cartas',
      '8×8 Requiere 108 cartas',
    ]);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(radios[3]!.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(radios[3]!); // disabled: ignored
    expect(store.round?.settings.gridSize ?? 4).toBe(4);
    fireEvent.click(radios[2]!);
    await tick(10);
    expect(radios[2]!.getAttribute('aria-checked')).toBe('true');
    expect(store.round?.settings.gridSize).toBe(5);
  });

  it('steps the size down when more people join than the deck supports', async () => {
    await mount();
    await emit(hello('s1'));
    await emit(hello('s2', 'Beto'));
    await tick(400);
    openSettings();
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Tamaño de la tabla' })).getAllByRole(
        'radio',
      )[2]!,
    );
    for (let i = 3; i <= 12; i++) await emit(hello(`s${i}`, `P${i}`));
    await tick(2000);
    expect(store.round?.settings.gridSize).toBe(4);
  });

  it('sends the room defaults in every lobby message, and lets the organiser change them', async () => {
    await mount();
    await emit(hello('s1'));
    await tick(400);
    expect(lobbies().pop()).toMatchObject({ defaults: { spokenLang: 'es', uiLang: 'es' } });
    openSettings();
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Idioma hablado al empezar' })).getByRole(
        'radio',
        {
          name: 'Náhuatl',
        },
      ),
    );
    fireEvent.click(
      within(screen.getByRole('radiogroup', { name: 'Idioma de la app al empezar' })).getByRole(
        'radio',
        {
          name: 'English',
        },
      ),
    );
    await emit(hello('s2', 'Beto'));
    await tick(400);
    expect(lobbies().pop()).toMatchObject({ defaults: { spokenLang: 'nah', uiLang: 'en' } });
    expect(store.round?.settings).toMatchObject({ defaultSpokenLang: 'nah', defaultUiLang: 'en' });
  });
});
