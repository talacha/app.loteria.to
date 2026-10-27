import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { cards, isAvoidedPair } from '@content';
import { MAX_SHARED_CARDS, MAX_TABLA_INDEX, choicesFor, deckOrder, tabla } from '@engine';
import '../i18n';

vi.mock('@print/options', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  newSeed: () => 'TESTSEED',
}));
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
const pick = (seat: string, cardId = lastCall().cardId) =>
  emit({ t: 'pick', seat, roundNo: 1, i: lastCall().i, cardId });
const ids = cards.map((c) => c.id);
/** Number of calls (1-based) after which every card of this tabla has been called. */
const completesAt = (index: number) => {
  const order = deckOrder('TESTSEED', 1, ids);
  const mine = new Set(tabla('TESTSEED', index, deck).cards);
  let last = 0;
  order.forEach((c, k) => mine.has(c) && (last = k + 1));
  return last;
};
const sharedCards = (a: number, b: number) => {
  const s = new Set(tabla('TESTSEED', a, deck).cards);
  return tabla('TESTSEED', b, deck).cards.filter((c) => s.has(c)).length;
};
/** Two tabla indices that complete on the same call, below 54 so the game ends early. */
function tiedIndices(): [number, number] {
  const seen = new Map<number, number>();
  for (let i = 0; i <= MAX_TABLA_INDEX; i++) {
    const at = completesAt(i);
    const other = seen.get(at);
    if (other !== undefined && at < 54 && sharedCards(other, i) <= MAX_SHARED_CARDS)
      return [other, i];
    if (!seen.has(at)) seen.set(at, i);
  }
  throw new Error('no tie found');
}
/** Make the host hand out these tabla indices, in order. */
function assignIndices(list: number[]) {
  const q = [...list];
  const real = globalThis.crypto.getRandomValues.bind(globalThis.crypto);
  vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(((a: Uint32Array) => {
    if (a instanceof Uint32Array && a.length === 1 && q.length) {
      a[0] = Math.ceil(((q.shift()! + 0.5) / (MAX_TABLA_INDEX + 1)) * 2 ** 32);
      return a;
    }
    return real(a as Uint32Array<ArrayBuffer>);
  }) as typeof crypto.getRandomValues);
}
const results = (seat?: string) =>
  sent.filter((m) => m.t === 'pickResult' && (!seat || m.seat === seat));

async function started(seats: string[], play = false) {
  render(
    <MemoryRouter>
      <HostPage />
    </MemoryRouter>,
  );
  await flush();
  await flush();
  if (play) fireEvent.click(screen.getByRole('radio', { name: /Jugar también/ }));
  for (const s of seats) await emit(hello(s));
  await tick(400);
  fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
  await flush();
}

beforeEach(() => {
  localStorage.setItem(
    'loteria:profile',
    JSON.stringify({ name: 'Org', glyph: '🌽', spokenLang: 'es' }),
  );
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
});
afterEach(() => {
  cleanup();
  sent.length = 0;
  handlers.clear();
  store.round = null;
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('automatic caller', () => {
  it('advances every speedSec with no manual next, pauses and resumes', async () => {
    await started(['a', 'b']);
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

  it('sends call{roundNo-less i, cardId, choices, at} with deterministic choices and no lang', async () => {
    await started(['a', 'b']);
    await tick(10_000);
    const c = lastCall() as unknown as {
      i: number;
      cardId: string;
      choices: string[];
      at: number;
    };
    expect(c.i).toBe(1);
    expect(c).not.toHaveProperty('lang');
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

  it('scores 2 for the first correct pick, 1 for later ones, 0 for wrong (arrival order)', async () => {
    await started(['a', 'b', 'c']);
    const call = lastCall() as unknown as { choices: string[]; cardId: string };
    const wrong = call.choices.find((x) => x !== call.cardId)!;
    await pick('b', wrong); // wrong: 0 points, one more try allowed
    expect(results('b').pop()).toMatchObject({ correct: false, points: 0, first: false });
    await pick('a'); // arrives first
    await pick('b'); // second try, correct, not first
    await pick('c');
    expect(results('a').pop()).toMatchObject({ correct: true, points: 2, first: true });
    expect(results('b').pop()).toMatchObject({ correct: true, points: 1, first: false });
    expect(results('c').pop()).toMatchObject({ correct: true, points: 1, first: false });
    await tick(600);
    const scores = sent.filter((m) => m.t === 'scores').pop()!;
    expect(scores.points).toEqual({ a: 2, b: 1, c: 1 });
    // Picks do not depend on having the card on the tabla, and are counted for "x de y".
    expect(screen.getByText('3 de 3 ya eligieron')).toBeTruthy();
  });

  it('allows at most 2 picks per call per seat', async () => {
    await started(['a', 'b']);
    const call = lastCall() as unknown as { choices: string[]; cardId: string };
    const [w1, w2] = call.choices.filter((x) => x !== call.cardId);
    await pick('a', w1);
    await pick('a', w2);
    await pick('a'); // third pick: scores nothing
    expect(results('a').pop()).toMatchObject({ correct: false, points: 0 });
    await tick(600);
    expect(sent.filter((m) => m.t === 'scores').pop()?.points ?? {}).not.toHaveProperty('a');
  });

  it('sends callClosed at the end of each window, before the next call', async () => {
    await started(['a', 'b']);
    sent.length = 0;
    await tick(10_000);
    const kinds = sent.filter((m) => m.t === 'callClosed' || m.t === 'call');
    expect(kinds.map((m) => m.t)).toEqual(['callClosed', 'call']);
    expect(kinds[0]).toMatchObject({ roundNo: 1, i: 0 });
    // A pick for the closed call is ignored and gets no reply.
    await emit({ t: 'pick', seat: 'a', roundNo: 1, i: 0, cardId: 'x' });
    expect(results('a')).toHaveLength(0);
  });

  it('the first full tabla after callClosed wins with end{reason: full-card}', async () => {
    const [x, y] = tiedIndices();
    // A different pair: y (later) vs a strictly earlier tabla.
    const early = Array.from({ length: MAX_TABLA_INDEX + 1 }, (_, i) => i).find(
      (i) => completesAt(i) < completesAt(x),
    )!;
    assignIndices([early, y]);
    await started(['a', 'b']);
    expect(indexOf('a')).toBe(early);
    for (let k = 0; k < completesAt(early) - 1; k++) await tick(10_000);
    expect(sent.some((m) => m.t === 'end')).toBe(false);
    await tick(10_000); // window of the completing call closes
    const end = sent.find((m) => m.t === 'end') as Sent;
    expect(end).toMatchObject({ roundNo: 1, winners: ['a'], reason: 'full-card' });
    expect(
      sent.findIndex((m) => m.t === 'callClosed' && m.i === completesAt(early) - 1),
    ).toBeLessThan(sent.indexOf(end));
    const n = calls().length;
    await tick(60_000);
    expect(calls()).toHaveLength(n);
  });

  it('same-call completions: more points win', async () => {
    const [x, y] = tiedIndices();
    assignIndices([x, y]);
    await started(['a', 'b']);
    const at = completesAt(x);
    for (let k = 0; k < at; k++) {
      await pick('b'); // b is first every call...
      await pick('a'); // ...a second
      if (k < at - 1) await tick(10_000);
    }
    await pick('a'); // no-op (already scored)
    await tick(10_000);
    const end = sent.find((m) => m.t === 'end') as Sent;
    expect(end.winners).toEqual(['b']);
    expect(end.reason).toBe('full-card');
  });

  it('same-call completions with equal points share the win', async () => {
    const [x, y] = tiedIndices();
    assignIndices([x, y]);
    await started(['a', 'b']);
    const at = completesAt(x);
    for (let k = 0; k < at; k++) await tick(10_000);
    const end = sent.find((m) => m.t === 'end') as Sent & { winners: string[] };
    expect([...end.winners].sort()).toEqual(['a', 'b']);
  });

  it('end stops the caller', async () => {
    await started(['a', 'b']);
    fireEvent.click(screen.getByRole('button', { name: 'Terminar ronda' }));
    await flush();
    expect(sent.some((m) => m.t === 'end')).toBe(true);
    const n = calls().length;
    await tick(60_000);
    expect(calls()).toHaveLength(n);
  });
});

describe('Jugar también (the host screen plays)', () => {
  const LOCAL = 'host-local';
  const choicesGroup = () => screen.getByRole('group', { name: 'Elige cómo se escribe' });
  const word = (id: string) => cards.find((c) => c.id === id)!.names.es!.text;
  const localChoose = async (cardId: string) => {
    fireEvent.click(within(choicesGroup()).getByRole('button', { name: word(cardId) }));
    await flush();
  };
  const call = () => lastCall() as unknown as { cardId: string; choices: string[] };

  it('counts toward the 2-player gate and is broadcast in the lobby with its own tabla', async () => {
    render(
      <MemoryRouter>
        <HostPage />
      </MemoryRouter>,
    );
    await flush();
    await flush();
    fireEvent.click(screen.getByRole('radio', { name: /Jugar también/ }));
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', true);
    await emit(hello('a'));
    expect(screen.getByRole('button', { name: 'Empezar' })).toHaveProperty('disabled', false);
    await tick(400);
    const lobby = sent.filter((m) => m.t === 'lobby').pop()!;
    expect((lobby.players as { seat: string; name: string }[]).map((p) => p.seat)).toContain(LOCAL);
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    await flush();
    expect(sent.some((m) => m.t === 'assign' && m.seat === LOCAL)).toBe(true);
    expect(screen.getByRole('list', { name: 'Tu tabla' })).toBeTruthy();
    expect(within(choicesGroup()).getAllByRole('button')).toHaveLength(3);
  });

  it('a remote pick that arrived first gets the 2 points; the local pick gets 1', async () => {
    await started(['a'], true);
    await pick('a');
    await localChoose(call().cardId);
    expect(results('a').pop()).toMatchObject({ points: 2, first: true });
    expect(results(LOCAL).pop()).toMatchObject({ correct: true, points: 1, first: false });
    await tick(600);
    expect(sent.filter((m) => m.t === 'scores').pop()!.points).toEqual({ a: 2, [LOCAL]: 1 });
  });

  it('a local pick that comes first gets the 2 points', async () => {
    await started(['a'], true);
    await localChoose(call().cardId);
    await pick('a');
    expect(results(LOCAL).pop()).toMatchObject({ points: 2, first: true });
    expect(results('a').pop()).toMatchObject({ points: 1, first: false });
  });

  it('allows at most 2 local picks per call', async () => {
    await started(['a'], true);
    const [w1, w2] = call().choices.filter((x) => x !== call().cardId);
    await localChoose(w1!);
    await localChoose(w2!);
    for (const b of within(choicesGroup()).getAllByRole('button')) {
      expect(b).toHaveProperty('disabled', true);
    }
    expect(results(LOCAL)).toHaveLength(2);
  });

  it('crosses the local tabla at callClosed and reveals the word', async () => {
    await started(['a'], true);
    const mine = new Set(tabla(seedOf(), indexOf(LOCAL), deck).cards);
    const k = deckOrder(seedOf(), 1, ids).findIndex((c) => mine.has(c));
    const id = deckOrder(seedOf(), 1, ids)[k]!;
    const board = screen.getByRole('list', { name: 'Tu tabla' });
    for (let n = 0; n < k; n++) await tick(10_000);
    expect(within(board).queryByText(word(id))).toBeNull(); // still open or not on the board
    await tick(10_000); // callClosed for call k
    expect(within(board).getByText(word(id))).toBeTruthy();
  });

  it('local full-card win: more points beat a same-call tie; equal points share', async () => {
    const [x, y] = tiedIndices();
    assignIndices([x, y]); // the local seat is assigned first, then 'a'
    await started(['a'], true);
    expect(indexOf(LOCAL)).toBe(x);
    const at = completesAt(x);
    for (let k = 0; k < at; k++) {
      await localChoose(call().cardId);
      await pick('a');
      if (k < at - 1) await tick(10_000);
    }
    await tick(10_000);
    const end = sent.find((m) => m.t === 'end') as Sent;
    expect(end).toMatchObject({ winners: [LOCAL], reason: 'full-card' });
  });

  it('local full-card with equal points shares the win', async () => {
    const [x, y] = tiedIndices();
    assignIndices([x, y]);
    await started(['a'], true);
    for (let k = 0; k < completesAt(x); k++) await tick(10_000);
    const end = sent.find((m) => m.t === 'end') as Sent & { winners: string[] };
    expect([...end.winners].sort()).toEqual(['a', LOCAL]);
  });

  it('display-only mode is unchanged: no local seat, no choices, silent host', async () => {
    await started(['a', 'b']);
    expect(sent.some((m) => m.t === 'assign' && m.seat === LOCAL)).toBe(false);
    expect(screen.queryByRole('group', { name: 'Elige cómo se escribe' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Activar voz' })).toBeTruthy();
  });
});
