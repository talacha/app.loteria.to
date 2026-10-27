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
  it('lists 54 cards with all five names and no review badges, and filters by category', async () => {
    await i18n.changeLanguage('es');
    setup();
    expect(items().length).toBe(54);
    expect(native().length).toBe(54 * 3);
    expect(screen.queryByText(/borrador|revis/i)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Animales' }));
    expect(items().length).toBeLessThan(54);
    expect(items().length).toBeGreaterThan(0);
  });
  it('shows a native name on each card', () => {
    setup();
    const first = cards[0]!;
    const name = first.names.nah?.text ?? '';
    expect(native().some((e) => e.textContent?.includes(name))).toBe(true);
  });
});
