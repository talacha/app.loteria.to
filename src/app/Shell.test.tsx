import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from './i18n';
import Shell from './Shell';
import { titleKey } from './titleKey';

afterEach(cleanup);

describe('Shell', () => {
  it('maps routes to title keys', () => {
    expect(titleKey('/')).toBe('home.title');
    expect(titleKey('/r/ABCDE')).toBe('join.title');
    expect(titleKey('/creditos')).toBe('credits.title');
  });
  it('renders a skip link, sets the title and syncs <html lang>', async () => {
    await i18n.changeLanguage('es');
    render(
      <MemoryRouter initialEntries={['/deck']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/deck" element={<main id="main">x</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Saltar al contenido' }).getAttribute('href')).toBe(
      '#main',
    );
    expect(document.title).toBe('144 cartas de lotería · Lotería de los Pueblos');
    expect(document.documentElement.lang).toBe('es');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('144 lotería cards · Lotería de los Pueblos');
    await i18n.changeLanguage('es');
  });
});

describe('Shell gear', () => {
  it('has the language gear (44 px token) that opens UI and spoken language settings', async () => {
    await i18n.changeLanguage('es');
    render(
      <MemoryRouter initialEntries={['/deck']}>
        <Routes>
          <Route element={<Shell />}>
            <Route path="/deck" element={<main id="main">x</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes de idioma' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('radiogroup', { name: /Idioma de la app/i })).toBeTruthy();
    expect(within(dialog).getAllByRole('radiogroup')).toHaveLength(2);
    fireEvent.click(within(dialog).getAllByRole('radio', { name: /English/ })[0]!);
    expect(i18n.language).toBe('en');
    expect(screen.getByRole('button', { name: 'Language settings' })).toBeTruthy();
    await i18n.changeLanguage('es');
  });
});
