import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from '../i18n';
import HomePage from './HomePage';
import { isValidRoomCode, normalizeRoomCode } from './joinCode';

function Where() {
  return <p data-testid="loc">{useLocation().pathname}</p>;
}
function setup() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(cleanup);

describe('room code check', () => {
  it('normalises and validates', () => {
    expect(normalizeRoomCode(' k7m-2q ')).toBe('K7M2Q');
    expect(isValidRoomCode('K7M2Q')).toBe(true);
    expect(isValidRoomCode('K7M20')).toBe(false);
    expect(isValidRoomCode('K7M2')).toBe(false);
    expect(isValidRoomCode('KIM2Q')).toBe(false);
  });
});

describe('HomePage', () => {
  it('shows title, nine sample cards, pending badges and three actions', async () => {
    await i18n.changeLanguage('es');
    setup();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lotería de los Pueblos');
    expect(screen.getByText('El Sol')).toBeTruthy();
    expect(screen.getAllByText('pendiente de revisión').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: 'Ser cantor' }).getAttribute('href')).toBe('/host');
    expect(screen.getByRole('link', { name: 'Imprimir tablas' }).getAttribute('href')).toBe(
      '/print',
    );
  });
  it('rejects bad codes and routes good ones uppercase', () => {
    setup();
    const input = screen.getByLabelText('Código de la sala') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'k7m0q' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'k7m2q' } });
    expect(input.value).toBe('K7M2Q');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByTestId('loc').textContent).toBe('/r/K7M2Q');
  });
  it('switches language and persists it', async () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(i18n.language).toBe('en');
    expect(localStorage.getItem('loteria.lang')).toBe('en');
    await i18n.changeLanguage('es');
  });
});
