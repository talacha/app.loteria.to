import { readFileSync } from 'node:fs';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import i18n from '../i18n';
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
  it('has no paper-board link (players print their own cartón)', () => {
    renderAt('/r/ABCDE');
    expect(screen.queryByRole('button', { name: /tabla de papel/i })).toBeNull();
  });
  it('styles text for the night background (contrast guard)', () => {
    const css = readFileSync('src/app/join/JoinPage.module.css', 'utf8');
    expect(css).toMatch(/\.page \{[^}]*color: var\(--color-paper\)/);
    expect(css).toMatch(/\.field select \{[^}]*color: var\(--color-paper\)/);
    expect(css).toMatch(/::placeholder \{[^}]*--color-muted-on-night/);
    expect(css).toMatch(/\.glyph \{[^}]*--color-night-dash/);
  });
  it('rejoins directly from a saved session', () => {
    sessionStorage.setItem(
      'loteria:session:ABCDE',
      JSON.stringify({
        profile: { name: 'Ana', glyph: '🐆', spokenLang: 'es' },
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
  it('goes to the SPOKEN-language step after the name: five languages, no review tags', () => {
    renderAt('/r/ABCDE');
    fireEvent.change(screen.getByPlaceholderText(/Como te gustaría/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    expect(screen.getByRole('heading', { name: '¿En qué idioma quieres jugar?' })).toBeTruthy();
    expect(screen.getByText('Paso 2 de 2')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    expect(document.body.textContent).not.toMatch(/en revisión/i);
    fireEvent.click(screen.getByRole('radio', { name: /Español/ }));
    expect(screen.getByRole('button', { name: 'Jugar en Español' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Náhuatl/ }));
    expect(screen.getByRole('button', { name: 'Jugar en Náhuatl' })).toBeTruthy();
    expect(screen.queryByLabelText(/Modo escucha/)).toBeNull();
  });

  it('keeps the UI language separate from the spoken language', async () => {
    localStorage.clear();
    renderAt('/r/ABCDE');
    fireEvent.change(screen.getByPlaceholderText(/Como te gustaría/), {
      target: { value: 'Ana' },
    });
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }));
    fireEvent.click(screen.getByRole('radio', { name: /Náhuatl/ }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'English' }));
    });
    // Menus are English now; the chosen spoken language is still Náhuatl.
    fireEvent.click(screen.getByRole('button', { name: 'Play in Nahuatl' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    const saved = JSON.parse(localStorage.getItem('loteria:profile') ?? '{}') as Record<
      string,
      string
    >;
    expect(saved).toMatchObject({ name: 'Ana', spokenLang: 'nah', uiLang: 'en' });
    await act(async () => {
      await i18n.changeLanguage('es');
    });
    localStorage.clear();
    sessionStorage.clear();
  });
});
