import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { cards, isAvoidedPair } from '@content';
import { choicesFor, tabla } from '@engine';
import '../i18n';
import type { SavedRound } from './roundMachine';

type Sent = { t: string; [k: string]: unknown };
const sent: Sent[] = [];
const handlers = new Set<(m: unknown) => void>();
const store: { round: SavedRound | null } = { round: null };

vi.mock('@net', () => ({
  createTransport: () => ({
    join: async () => undefined,
    send: (m: Sent) => sent.push(m),
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

const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const flush = () => act(async () => vi.advanceTimersByTimeAsync(0));
const tick = (ms: number) => act(async () => vi.advanceTimersByTimeAsync(ms));
const emit = (m: unknown) => act(async () => void handlers.forEach((h) => h(m)));
const hello = (seat: string) => ({ t: 'hello', seat, name: seat, glyph: '🌽', labelLang: 'es' });
const calls = () => sent.filter((m) => m.t === 'call');
const lastCall = () => calls()[calls().length - 1] as Sent & { i: number; cardId: string };
const seedOf = () => sent.find((m) => m.t === 'round')!.seed as string;
const indexOf = (seat: string) =>
  sent.filter((m) => m.t === 'assign' && m.seat === seat).map((m) => m.tablaIndex as number)[0]!;
const holds = (seat: string, cardId: string) =>
  tabla(seedOf(), indexOf(seat), deck).cards.includes(cardId);
const pick = (seat: string, cardId = lastCall().cardId) =>
  emit({ t: 'pick', seat, roundNo: 1, i: lastCall().i, cardId });
const results = (seat?: string) =>
  sent.filter((m) => m.t === 'pickResult' && (!seat || m.seat === seat));

async function started(seats: string[]) {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  for (const s of seats) await emit(hello(s));
  await tick(400);
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
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
  store.round = null;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('automatic caller', () => {
  it('advances every speedSec with no manual next, pauses and resumes', async () => {
    await started([]);
    expect(screen.queryByRole('button', { name: /siguiente/i })).toBeNull();
    expect(calls()).toHaveLength(1);
    await tick(10_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    await tick(60_000);
    expect(calls()).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Reanudar' }));
    await tick(10_000);
    expect(calls()).toHaveLength(3);
  });

  it('sends call{i, cardId, lang, at, choices} with deterministic choices', async () => {
    await started(['a']);
    await tick(10_000);
    const c = lastCall() as unknown as {
      i: number;
      cardId: string;
      choices: string[];
      lang: string;
      at: number;
    };
    expect(c.i).toBe(1);
    expect(typeof c.lang).toBe('string');
    expect(typeof c.at).toBe('number');
    expect(new Set(c.choices).size).toBe(3);
    expect(c.choices).toContain(c.cardId);
    const again = choicesFor(seedOf(), 1, c.i, c.cardId, deck, (a, b) =>
      isAvoidedPair(a, b, ['es']),
    );
    expect([...again].sort()).toEqual([...c.choices].sort());
    // A late hello gets the same call and the same choices, in the same order.
    sent.length = 0;
    await emit({ ...hello('late') });
    const replay = lastCall() as unknown as { choices: string[]; cardId: string };
    expect(replay.cardId).toBe(c.cardId);
    expect(replay.choices).toEqual(c.choices);
  });

  it('scores only the first correct pick; later ones cross out for 0', async () => {
    await started(['a', 'b']);
    let n = 0;
    while (!(holds('a', lastCall().cardId) && holds('b', lastCall().cardId)) && n++ < 53) {
      await tick(10_000);
    }
    expect(holds('a', lastCall().cardId) && holds('b', lastCall().cardId)).toBe(true);
    const other = tabla(seedOf(), indexOf('b'), deck).cards.find((c) => c !== lastCall().cardId)!;
    await pick('b', other); // wrong picture: correct=false, may retry
    expect(results('b').pop()).toMatchObject({ correct: false, first: false });
    await pick('a');
    await pick('b');
    expect(results('a').pop()).toMatchObject({ correct: true, first: true });
    expect(results('b').pop()).toMatchObject({ correct: true, first: false });
    await tick(600);
    const scores = sent.filter((m) => m.t === 'scores').pop()!;
    expect(scores.points).toEqual({ a: 2, b: 0 });
  });

  it('validates claims against the host crossed-out set; same-call ties go by points', async () => {
    await started(['a', 'b']);
    // Settings default pattern is a line. Everyone claims early with nothing crossed: invalid.
    await emit({ t: 'claim', seat: 'a', roundNo: 1, tablaIndex: indexOf('a'), marks: [] });
    expect(sent.filter((m) => m.t === 'claimResult').pop()).toMatchObject({
      seat: 'a',
      valid: false,
    });
    // Both seats cross every card they hold, a always first. After 54 calls every pattern is met.
    for (let k = 0; k < 54; k++) {
      const id = lastCall().cardId;
      if (holds('a', id)) await pick('a');
      if (holds('b', id)) await pick('b');
      if (k < 53) await tick(10_000);
    }
    const claim = (seat: string) =>
      emit({ t: 'claim', seat, roundNo: 1, tablaIndex: indexOf(seat), marks: [] });
    await claim('b');
    await claim('a');
    expect(sent.filter((m) => m.t === 'claimResult' && m.valid)).toHaveLength(2);
    expect(sent.some((m) => m.t === 'end')).toBe(false); // still inside the grace window
    await tick(2000);
    const end = sent.find((m) => m.t === 'end') as Sent & { winners: string[] };
    // a holds the first-pick points on every shared card, so a outscores b (or shares if equal).
    expect(end.winners).toContain('a');
  });

  it('end stops the caller', async () => {
    await started([]);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar ronda' }));
    await flush();
    expect(sent.some((m) => m.t === 'end')).toBe(true);
    const n = calls().length;
    await tick(60_000);
    expect(calls()).toHaveLength(n);
  });
});
