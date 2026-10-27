import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import '../i18n';
import { LocalTransport, type Msg, type Transport } from '@net';
import LobbyWaiting from './LobbyWaiting';

const CODE = 'ABCDE';
const profile = { name: 'Ana', glyph: '🐆', spokenLang: 'es' as const };
const flush = async (ms = 30) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

let host: LocalTransport;
let hostKey: string;
let received: Msg[];
let player: LocalTransport | null;
let joins: number;
let leaves: number;

function factory(seat: string): Transport {
  const p = new LocalTransport({ seat });
  const join = p.join.bind(p);
  const leave = p.leave.bind(p);
  p.join = (...a: Parameters<Transport['join']>) => {
    joins += 1;
    return join(...a);
  };
  p.leave = () => {
    leaves += 1;
    return leave();
  };
  player = p;
  return p;
}

const roundMsg: Msg = {
  t: 'round',
  seed: 's1',
  roundNo: 1,
  speedSec: 8,
};

async function mount(strict = false, onLeave = () => {}) {
  const ui = (
    <LobbyWaiting
      code={CODE}
      profile={profile}
      hostKey={hostKey}
      hostKeyFromQr
      transportFactory={factory}
      onLeave={onLeave}
    />
  );
  render(strict ? <StrictMode>{ui}</StrictMode> : ui);
  await flush(80);
}

beforeEach(async () => {
  sessionStorage.clear();
  received = [];
  player = null;
  joins = 0;
  leaves = 0;
  host = new LocalTransport({ seat: 'host-seat' });
  await host.join(CODE, 'host');
  hostKey = await host.hostPublicKey!();
  host.onMessage((m) => received.push(m));
});
afterEach(async () => {
  cleanup();
  await host.leave();
  vi.useRealTimers();
});

describe('LobbyWaiting', () => {
  it('shows the code, waiting text and the roster from lobby messages', async () => {
    await mount();
    expect(screen.getByText(/Ya casi empezamos/)).toBeTruthy();
    expect(screen.getByRole('img', { name: /Código de sala A B C D E/ })).toBeTruthy();
    expect(screen.getByText(/Jugarás en/)).toBeTruthy();
    expect(screen.getByText(/Imprime una tabla/)).toBeTruthy();
    host.send({
      t: 'lobby',
      status: 'waiting',
      players: [
        { seat: player!.seat, name: 'Ana', glyph: '🐆' },
        { seat: 'x', name: 'Bo', glyph: '🌽' },
      ],
    });
    await flush();
    expect(screen.getByText(/^2 personas en la sala/)).toBeTruthy();
    expect(screen.getByText('Tú · Ana')).toBeTruthy();
  });

  it('sends one hello, and none in response to lobby or round', async () => {
    await mount();
    host.send({ t: 'lobby', status: 'waiting', players: [] });
    host.send(roundMsg);
    await flush();
    expect(received.filter((m) => m.t === 'hello')).toHaveLength(1);
  });

  it('switches to the game when the lobby starts, replaying the round', async () => {
    await mount();
    host.send({ t: 'lobby', status: 'started', players: [], roundNo: 1 });
    host.send(roundMsg);
    await flush();
    host.send({ t: 'assign', seat: player!.seat, tablaIndex: 4, roundNo: 1 });
    await flush();
    expect(screen.queryByText(/Ya casi empezamos/)).toBeNull();
    expect(screen.getByRole('list', { name: 'Tu tabla' })).toBeTruthy();
  });

  it('goes straight to the game when a round arrives without a lobby message', async () => {
    await mount();
    host.send(roundMsg);
    await flush();
    expect(screen.getByText(/Preparando tu tabla/)).toBeTruthy();
  });

  it('joins once under StrictMode', async () => {
    await mount(true);
    expect(joins).toBe(1);
  });

  it('leaves the transport and calls onLeave', async () => {
    const onLeave = vi.fn();
    await mount(false, onLeave);
    fireEvent.click(screen.getByRole('button', { name: /Salir de la sala/ }));
    expect(onLeave).toHaveBeenCalled();
    expect(leaves).toBeGreaterThanOrEqual(1);
  });

  it('leaves on unmount', async () => {
    await mount();
    cleanup();
    expect(leaves).toBeGreaterThanOrEqual(1);
  });

  it('re-sends hello (rate limited) when a lobby arrives without me', async () => {
    await mount();
    expect(received.filter((m) => m.t === 'hello')).toHaveLength(1);
    host.send({ t: 'lobby', status: 'waiting', players: [] });
    await flush();
    expect(received.filter((m) => m.t === 'hello')).toHaveLength(1);
    await flush(3100);
    host.send({ t: 'lobby', status: 'waiting', players: [] });
    await flush();
    expect(received.filter((m) => m.t === 'hello').length).toBeGreaterThanOrEqual(2);
  }, 10000);

  it('has a single #main and an accessible room code', async () => {
    await mount();
    expect(document.querySelectorAll('#main')).toHaveLength(1);
    expect(screen.getByRole('img', { name: /Código de sala A B C D E/ })).toBeTruthy();
  });

  it('shows no review tag, and "Jugarás en" uses the spoken language', async () => {
    await mount();
    expect(document.body.textContent).not.toMatch(/en revisión/i);
    expect(screen.getByText(/Jugarás en Español/)).toBeTruthy();
  });

  it('says the room is full when the host answers lobby full and I am not in players', async () => {
    await mount();
    host.send({ t: 'lobby', status: 'full', players: [{ seat: 'x', name: 'Bo', glyph: '🌽' }] });
    await flush();
    expect(screen.getByText('Esta sala está llena')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Crear una sala nueva' })).toBeTruthy();
  });

  it('"Crear una sala nueva" goes to the create-room handler', async () => {
    const onCreateRoom = vi.fn();
    render(
      <LobbyWaiting
        code={CODE}
        profile={profile}
        hostKey={hostKey}
        hostKeyFromQr
        transportFactory={factory}
        onLeave={() => {}}
        onCreateRoom={onCreateRoom}
      />,
    );
    await flush(80);
    host.send({ t: 'lobby', status: 'full', players: [] });
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Crear una sala nueva' }));
    expect(onCreateRoom).toHaveBeenCalled();
  });

  it('does not show "sala llena" when I am in the roster', async () => {
    await mount();
    host.send({
      t: 'lobby',
      status: 'full',
      players: [{ seat: player!.seat, name: 'Ana', glyph: '🐆' }],
    });
    await flush();
    expect(screen.queryByText('Esta sala está llena')).toBeNull();
  });
});
