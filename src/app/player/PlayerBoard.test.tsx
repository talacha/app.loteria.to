import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import { LocalTransport, type Msg } from '@net';
import PlayerBoard from './PlayerBoard';
import { makeBoard } from './playerState';
import { getCard } from '@content';

const profile = { name: 'Ana', glyph: '🐆', labelLang: 'es' as const };
const CODE = 'ABCDE';
const SEED = 'seed-1';
const flush = async (ms = 20) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

let host: LocalTransport;
let received: Msg[];
let player: LocalTransport;

function round(over: Partial<Extract<Msg, { t: 'round' }>> = {}): Msg {
  return {
    t: 'round',
    seed: SEED,
    roundNo: 1,
    mode: 'normal',
    pattern: 'line',
    callLang: 'es',
    speedSec: 8,
    called: [],
    ...over,
  };
}

async function mount() {
  player = new LocalTransport({ seat: 'p1' });
  await player.join(CODE, 'player');
  render(
    <PlayerBoard
      transport={player}
      room={{ code: CODE, seat: 'p1', hostVerified: false }}
      profile={profile}
    />,
  );
  await flush(30);
}

beforeEach(async () => {
  sessionStorage.clear();
  received = [];
  host = new LocalTransport({ seat: 'host-seat' });
  await host.join(CODE, 'host');
  host.onMessage((m) => received.push(m));
});
afterEach(async () => {
  cleanup();
  await player?.leave();
  await host.leave();
});

async function assign(tablaIndex = 7, roundNo = 1, seat?: string) {
  host.send({ t: 'assign', seat: seat ?? player!.seat, tablaIndex, roundNo });
  await flush();
}

describe('PlayerBoard', () => {
  it('shows a preparing state until its own assign arrives; ignores other seats', async () => {
    await mount();
    host.send(round());
    await flush();
    expect(screen.getByText(/Preparando tu tabla/)).toBeTruthy();
    await assign(3, 1, 'someone-else');
    expect(screen.getByText(/Preparando tu tabla/)).toBeTruthy();
    await assign(7, 1);
    expect(screen.queryByText(/Preparando tu tabla/)).toBeNull();
    expect(screen.getAllByRole('button', { pressed: false }).length).toBeGreaterThanOrEqual(16);
  });

  it('claims with its own seat, index and round, and disables during cooldown', async () => {
    await mount();
    host.send(round());
    await assign(7, 1);
    const btn = screen.getByRole('button', { name: '¡Lotería!' }) as HTMLButtonElement;
    fireEvent.click(btn);
    await flush();
    const claim = received.find((m) => m.t === 'claim');
    expect(claim).toMatchObject({ seat: player!.seat, tablaIndex: 7, roundNo: 1 });
    expect(btn.disabled).toBe(true);
  });

  it('builds history and auto-marks from round.called', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round({ called: [board[0]!, board[5]!] }));
    await assign(7, 1);
    fireEvent.click(screen.getByLabelText(/Marcar automáticamente/));
    expect(screen.getByText(/2 cartas cantadas/)).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
  });

  it('hides the called card name and emoji in Escucha mode', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round({ mode: 'escucha' }));
    await assign(7, 1);
    host.send({ t: 'call', i: 0, cardId: board[2]!, lang: 'es', at: 0 });
    await flush();
    const call = screen.getByTestId('call');
    expect(call.textContent).toContain('Escucha');
    expect(call.textContent).not.toContain(getCard(board[2]!)!.emoji ?? '@@');
    expect(call.textContent).not.toContain(getCard(board[2]!)!.names.es!.text);
  });

  it('ignores a claimResult from a stale round', async () => {
    await mount();
    host.send(round({ roundNo: 2 }));
    await assign(7, 2);
    host.send({ t: 'claimResult', seat: player!.seat, roundNo: 1, valid: false });
    await flush();
    expect(screen.queryByRole('dialog')).toBeNull();
    host.send({ t: 'claimResult', seat: player!.seat, roundNo: 2, valid: false });
    await flush();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
