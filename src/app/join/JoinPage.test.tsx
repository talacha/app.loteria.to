import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import '../i18n';
import JoinPage from './JoinPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/r/:code" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('JoinPage', () => {
  it('requires a name', () => {
    renderAt('/r/ABCDE');
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/nombre/i);
  });
  it('rejects a malformed code', () => {
    renderAt('/r/xx');
    expect(screen.getByRole('alert')).toBeTruthy();
  });
  it('lets you retry with a typed code', () => {
    renderAt('/r/xx');
    expect(screen.getByLabelText(/Código de sala/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Probar con este código/ })).toBeTruthy();
  });
  it('accepts a lowercase code', () => {
    renderAt('/r/abcde');
    expect(screen.getByText('ABCDE')).toBeTruthy();
  });
  it('explains paper boards', () => {
    renderAt('/r/ABCDE');
    fireEvent.click(screen.getByRole('button', { name: /tabla de papel/i }));
    expect(screen.getByText(/6 letras/i)).toBeTruthy();
  });
  it('rejoins directly from a saved session', () => {
    sessionStorage.setItem(
      'loteria:session:ABCDE',
      JSON.stringify({
        profile: { name: 'Ana', glyph: '🐆', labelLang: 'es' },
        hostKeyFromQr: false,
      }),
    );
    renderAt('/r/ABCDE');
    expect(screen.getByText(/Ya casi empezamos/)).toBeTruthy();
    sessionStorage.clear();
  });
  it('has exactly one #main', () => {
    renderAt('/r/ABCDE');
    expect(document.querySelectorAll('#main')).toHaveLength(1);
  });
  it('goes to the language step after the name, with one card per callable language', () => {
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'false'); // preview build: all five languages
    renderAt('/r/ABCDE');
    fireEvent.change(screen.getByPlaceholderText(/Como te gustaría/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('heading', { name: '¿En qué idioma te cantamos?' })).toBeTruthy();
    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(5);
    expect(screen.getAllByText('palabra en revisión').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('radio', { name: /Español/ }));
    expect(screen.getByRole('button', { name: 'Jugar en Español' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Náhuatl/ }));
    expect(screen.getByRole('button', { name: 'Jugar en Náhuatl' })).toBeTruthy();
    expect(screen.getByLabelText(/Modo escucha/)).toBeTruthy();
  });
});
