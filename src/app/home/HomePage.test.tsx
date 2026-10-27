import { fireEvent, cleanup, render, screen, within } from '@testing-library/react';
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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('¿Cómo te llamas?');
    expect(screen.getByText('Lotería de los Pueblos')).toBeTruthy();
    expect(screen.getByText('El Sol')).toBeTruthy();
    expect(screen.queryByText('pendiente de revisión')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Cómo es una ronda' })).toBeTruthy();
    expect(screen.getByText('Se completa un cartón')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Jugar solo/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Crear una sala/ })).toBeTruthy();
    expect(screen.getByText('Sin cuentas, sin dinero. Solo frijolitos.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Imprimir tablas' }).getAttribute('href')).toBe(
      '/print',
    );
  });
  it('requires a name to create a room, then saves the profile and goes to /host', () => {
    localStorage.clear();
    setup();
    fireEvent.click(screen.getByRole('link', { name: /Crear una sala/ }));
    expect(screen.getByRole('alert').textContent).toMatch(/nombre/);
    fireEvent.change(screen.getByLabelText('Tu nombre en la sala'), { target: { value: 'Itzel' } });
    fireEvent.click(screen.getByRole('radio', { name: /Rana/i }));
    fireEvent.click(screen.getByRole('link', { name: /Crear una sala/ }));
    expect(screen.getByTestId('loc').textContent).toBe('/host');
    expect(JSON.parse(localStorage.getItem('loteria:profile') ?? '{}')).toMatchObject({
      name: 'Itzel',
      glyph: '🐸',
    });
  });
  it('rejects bad codes and routes good ones uppercase', () => {
    setup();
    const input = screen.getByLabelText('Unirme a una sala') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'k7m0q' } });
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByRole('alert')).toBeTruthy();
    fireEvent.change(input, { target: { value: 'k7m2q' } });
    expect(input.value).toBe('K7M2Q');
    fireEvent.submit(input.closest('form') as HTMLFormElement);
    expect(screen.getByTestId('loc').textContent).toBe('/r/K7M2Q');
  });
  it('has separate app-language and spoken-language pickers that persist', async () => {
    localStorage.setItem('loteria:profile', JSON.stringify({ name: 'Itzel', glyph: '🐸' }));
    await i18n.changeLanguage('es');
    setup();
    const ui = screen.getByRole('radiogroup', { name: 'Idioma de la app' });
    const spoken = screen.getByRole('radiogroup', { name: 'Idioma que escuchas' });
    fireEvent.click(within(spoken).getByRole('radio', { name: /Maya yucateco/ }));
    expect(JSON.parse(localStorage.getItem('loteria:profile') ?? '{}')).toMatchObject({
      name: 'Itzel',
      spokenLang: 'yua',
    });
    expect(i18n.language).toBe('es');
    fireEvent.click(within(ui).getByRole('radio', { name: /English/ }));
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(JSON.parse(localStorage.getItem('loteria:profile') ?? '{}')).toMatchObject({
      name: 'Itzel',
      uiLang: 'en',
      spokenLang: 'yua',
    });
    await i18n.changeLanguage('es');
  });
});
