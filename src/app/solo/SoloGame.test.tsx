import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../i18n';
import { cards } from '@content';
import SoloGame from './SoloGame';
import { createSolo, cpuSeat, HUMAN } from './soloEngine';

vi.mock('../audio', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  speakCall: vi.fn(async () => 'audio'),
  stopAudio: vi.fn(),
}));

afterEach(cleanup);

const pool = cards.map((c) => ({ id: c.id, category: c.category }));
const players = [
  { seat: HUMAN, name: 'Ana', avatar: 'jaguar' },
  { seat: cpuSeat(1), name: 'Compu 1', avatar: 'rana' },
];
const mount = (onLeave = vi.fn(), grid = 4) => {
  render(
    <SoloGame
      initial={createSolo({ seed: 's', cpus: 1, difficulty: 'normal', speedSec: 8, pool, grid })}
      lang="es"
      players={players}
      onFinish={() => undefined}
      onLeave={onLeave}
    />,
  );
  return onLeave;
};

describe('SoloGame', () => {
  it('shows the leaderboard with the human and the computer players', () => {
    mount();
    const table = screen.getByRole('table', { name: 'Tabla de puntos' });
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(2);
    expect(table.textContent).toContain('Tú');
    expect(table.textContent).toContain('Compu 1');
    expect(table.textContent).toContain('0/16');
  });

  it('has Salir (leave) but no way to end the round', () => {
    const onLeave = mount();
    expect(screen.queryByRole('button', { name: /Terminar/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Seguir jugando' }));
    expect(onLeave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Salir' }));
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it.each([5, 6, 7, 8])('renders grid %i and counts every square', (grid) => {
    mount(vi.fn(), grid);
    const board = screen.getByRole('list', { name: 'Tu tabla' });
    expect(board.children).toHaveLength(grid * grid);
    expect(board.getAttribute('data-grid')).toBe(String(grid));
    expect(screen.getByRole('table', { name: 'Tabla de puntos' }).textContent).toContain(
      `0/${grid * grid}`,
    );
  });
});
