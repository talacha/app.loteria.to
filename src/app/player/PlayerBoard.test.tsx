import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import { LocalTransport, type Msg } from '@net';
import PlayerBoard from './PlayerBoard';
import { makeBoard } from './playerState';
import { cards, getCard } from '@content';

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

async function mount(p: typeof profile & { listenOnly?: boolean } = profile) {
  player = new LocalTransport({ seat: 'p1' });
  await player.join(CODE, 'player');
  render(
    <PlayerBoard
      transport={player}
      room={{ code: CODE, seat: 'p1', hostVerified: false }}
      profile={p}
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
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(16);
  });

  it('only enables the claim when my crossed set completes the pattern, then claims', async () => {
    const board = makeBoard(SEED, 7);
    sessionStorage.setItem(`loteria:marks:${CODE}:${SEED}:1`, JSON.stringify(board.slice(0, 3)));
    await mount();
    host.send(round());
    await assign(7, 1);
    expect(screen.queryByRole('button', { name: '¡Lotería!' })).toBeNull();
    cleanup();
    await player.leave();
    sessionStorage.setItem(`loteria:marks:${CODE}:${SEED}:1`, JSON.stringify(board.slice(0, 4)));
    await mount();
    host.send(round());
    await assign(7, 1);
    const ok = screen.getByRole('button', { name: '¡Lotería!' }) as HTMLButtonElement;
    expect(ok.disabled).toBe(false);
    fireEvent.click(ok);
    await flush();
    const claim = received.find((m) => m.t === 'claim');
    expect(claim).toMatchObject({ seat: player!.seat, tablaIndex: 7, roundNo: 1 });
    expect((claim as Extract<Msg, { t: 'claim' }>).marks).toEqual(board.slice(0, 4));
    expect(ok.disabled).toBe(true);
  });

  it('crosses out only after a correct pickResult, and sends picks', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round());
    await assign(7, 1);
    const target = board[2]!;
    const others = board.filter((x) => x !== target).slice(0, 2) as [string, string];
    host.send({
      t: 'call',
      i: 0,
      cardId: target,
      choices: [others[0], target, others[1]],
      lang: 'es',
      at: 0,
    });
    await flush();
    const name = (id: string) => getCard(id)!.names.es!.text;
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name(others[0])) }));
    await flush();
    expect(received.find((m) => m.t === 'pick')).toMatchObject({ i: 0, cardId: others[0] });
    expect(screen.queryByText(/¡Casi!/)).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: new RegExp(name(target)) }));
    await flush();
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: player!.seat,
      correct: true,
      first: true,
    });
    await flush();
    expect(JSON.parse(sessionStorage.getItem(`loteria:marks:${CODE}:${SEED}:1`)!)).toEqual([
      target,
    ]);
  });

  it('hides the called card name and emoji in Escucha mode', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round({ mode: 'escucha' }));
    await assign(7, 1);
    host.send({
      t: 'call',
      i: 0,
      cardId: board[2]!,
      choices: [board[2]!, board[3]!, board[4]!],
      lang: 'es',
      at: 0,
    });
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

  it('shows the dashed off-board panel and no choices when the card is not on my tabla', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round());
    await assign(7, 1);
    const off = cards.find((c) => !board.includes(c.id))!.id;
    const others = board.slice(0, 2) as [string, string];
    host.send({
      t: 'call',
      i: 3,
      cardId: off,
      choices: [off, others[0], others[1]],
      lang: 'es',
      at: 0,
    });
    await flush();
    expect(screen.getByText('No está en tu tabla')).toBeTruthy();
    expect(screen.queryByText('¿Cuál es?')).toBeNull();
    expect(screen.getByText(/Carta 4 de 54/)).toBeTruthy();
  });

  it('wrong then right: casi, then Eso with the first badge, and the card is crossed', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round());
    await assign(7, 1);
    const target = board[1]!;
    const [d1, d2] = board.filter((x) => x !== target).slice(0, 2) as [string, string];
    host.send({ t: 'call', i: 0, cardId: target, choices: [d1, target, d2], lang: 'es', at: 0 });
    await flush();
    const nm = (id: string) => getCard(id)!.names.es!.text;
    fireEvent.click(screen.getByRole('button', { name: nm(d1) }));
    await flush();
    expect(screen.getByText('¡Casi!')).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: new RegExp(`${nm(d1)} · `) }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: nm(target) }));
    await flush();
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: player!.seat,
      correct: true,
      first: true,
    });
    host.send({ t: 'scores', roundNo: 1, points: { [player!.seat]: 2 } });
    await flush();
    expect(screen.getByText('¡Eso! +2 · ¡Fuiste primero!')).toBeTruthy();
    expect(screen.getByText('2 puntos · desempate')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: new RegExp(`${nm(target)} · Correcta`) }),
    ).toBeTruthy();
    expect(screen.getAllByText('Marcada')).toHaveLength(1);
  });

  it('plain Eso without the badge when not first', async () => {
    await mount();
    const board = makeBoard(SEED, 7);
    host.send(round());
    await assign(7, 1);
    const target = board[1]!;
    const [d1, d2] = board.filter((x) => x !== target).slice(0, 2) as [string, string];
    host.send({ t: 'call', i: 0, cardId: target, choices: [d1, target, d2], lang: 'es', at: 0 });
    await flush();
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: player!.seat,
      correct: true,
      first: false,
    });
    await flush();
    expect(screen.getByText('¡Eso!')).toBeTruthy();
    expect(screen.queryByText(/Fuiste primero/)).toBeNull();
  });

  it('shows the win screen with the line words when the round ends and I won', async () => {
    const board = makeBoard(SEED, 7);
    sessionStorage.setItem(`loteria:marks:${CODE}:${SEED}:1`, JSON.stringify(board.slice(0, 4)));
    await mount();
    host.send(round());
    await assign(7, 1);
    host.send({ t: 'end', roundNo: 1, winners: [player!.seat] });
    await flush();
    expect(screen.getByRole('heading', { name: '¡Lotería!' })).toBeTruthy();
    expect(screen.getByText(/Completaste la línea/)).toBeTruthy();
    expect(screen.getByText('Palabras de tu línea')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Otra ronda' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Otra ronda' }));
    await flush();
    expect(screen.queryByRole('heading', { name: '¡Lotería!' })).toBeNull();
  });

  it('shows a tie text when several seats win', async () => {
    await mount();
    host.send(round());
    await assign(7, 1);
    host.send({ t: 'end', roundNo: 1, winners: [player!.seat, 'other'] });
    await flush();
    expect(screen.getByText(/Empate: .* completaron la figura/)).toBeTruthy();
  });

  it('plays in Escucha when chosen at join, and the speaker replays the call', async () => {
    await mount({ ...profile, listenOnly: true });
    const board = makeBoard(SEED, 7);
    host.send(round());
    await assign(7, 1);
    host.send({
      t: 'call',
      i: 0,
      cardId: board[2]!,
      choices: [board[2]!, board[3]!, board[4]!],
      lang: 'es',
      at: 0,
    });
    await flush();
    const call = screen.getByTestId('call');
    expect(call.textContent).toContain('Escucha');
    expect(call.textContent).not.toContain(getCard(board[2]!)!.names.es!.text);
    expect(screen.getByRole('button', { name: 'Repetir la carta' })).toBeTruthy();
  });
});
