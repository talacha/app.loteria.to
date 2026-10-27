import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { cards } from '@content';
import i18n from '../i18n';
import DeckPage from './DeckPage';

afterEach(cleanup);

function setup() {
  return render(
    <MemoryRouter>
      <DeckPage />
    </MemoryRouter>,
  );
}
const native = () => [...document.querySelectorAll('[lang="nah"],[lang="yua"],[lang="quz"]')];
const items = () => document.querySelectorAll('ul > li > span[class*="num"]');

describe('DeckPage', () => {
  it('lists 144 cards, shows only sourced existing Indigenous names, and filters by category', async () => {
    await i18n.changeLanguage('es');
    setup();
    expect(items().length).toBe(144);
    expect(native().length).toBe(54 * 3);
    expect(screen.queryByText(/borrador|revis/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Animales' }));
    expect(items().length).toBe(24);
  });
  it('shows a native name on existing cards and never substitutes Spanish for absent names', () => {
    setup();
    const first = cards[0]!;
    const name = first.names.nah?.text ?? '';
    expect(native().some((e) => e.textContent?.includes(name))).toBe(true);

    const perro = screen.getByText('El Perro').closest('li');
    expect(perro).not.toBeNull();
    expect(perro?.querySelector('[lang="nah"], [lang="yua"], [lang="quz"]')).toBeNull();
  });
});
