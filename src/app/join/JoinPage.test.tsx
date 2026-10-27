import { afterEach, describe, it, expect } from 'vitest';
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

afterEach(cleanup);

describe('JoinPage', () => {
  it('requires a name', () => {
    renderAt('/r/ABCDE');
    fireEvent.click(screen.getByRole('button', { name: /entrar a la sala/i }));
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
    expect(screen.getByText(/Esperando a quien canta/)).toBeTruthy();
    sessionStorage.clear();
  });
  it('has exactly one #main', () => {
    renderAt('/r/ABCDE');
    expect(document.querySelectorAll('#main')).toHaveLength(1);
  });
});
