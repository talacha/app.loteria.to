import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import i18n from './i18n';
import Shell, { titleKey } from './Shell';

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
    expect(document.title).toBe('Las 54 cartas · Lotería de los Pueblos');
    expect(document.documentElement.lang).toBe('es');
    await i18n.changeLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    await i18n.changeLanguage('es');
  });
});
