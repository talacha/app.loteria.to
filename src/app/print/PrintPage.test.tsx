import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@print', () => ({
  generateBoardsPdfDetailed: (_o: unknown, h: { signal: AbortSignal }) =>
    new Promise((_res, rej) => h.signal.addEventListener('abort', () => rej(new Error('abort')))),
}));
import i18n from '../i18n';
import PrintPage from './PrintPage';

afterEach(cleanup);

describe('PrintPage', () => {
  it('uses the seed from the query string', async () => {
    await i18n.changeLanguage('es');
    render(
      <MemoryRouter initialEntries={['/print?seed=abcd2345']}>
        <PrintPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('ABCD2345')).toBeTruthy();
    expect(screen.getByText(/Anota este código para quien canta/)).toBeTruthy();
  });
  it('creates an 8-char seed when none is given and can renew it', async () => {
    render(
      <MemoryRouter initialEntries={['/print']}>
        <PrintPage />
      </MemoryRouter>,
    );
    const seed = () => document.querySelector('p[aria-live="polite"]')?.textContent ?? '';
    expect(seed()).toMatch(/^[0-9A-Z]{8}$/);
    const first = seed();
    fireEvent.click(screen.getByRole('button', { name: 'Crear otro código' }));
    expect(seed()).toMatch(/^[0-9A-Z]{8}$/);
    expect(seed()).not.toBe(first);
  });
  it('disables new seed while busy and can cancel', async () => {
    render(
      <MemoryRouter initialEntries={['/print?seed=abcd2345']}>
        <PrintPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Crear PDF' }));
    const cancel = await screen.findByRole('button', { name: 'Cancelar' });
    expect(
      (screen.getByRole('button', { name: 'Crear otro código' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('progressbar', { name: /PDF/ })).toBeTruthy();
    fireEvent.click(cancel);
    expect(screen.queryByRole('button', { name: 'Cancelar' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
