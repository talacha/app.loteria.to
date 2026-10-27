import { fireEvent, cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cards } from '@content';
import i18n from '../i18n';
import DeckPage from './DeckPage';

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const drafts = cards.flatMap((c) =>
  (['nah', 'yua', 'quz'] as const).flatMap((l) => {
    const n = c.names[l];
    return n && n.status === 'draft' ? [{ id: c.id, lang: l, text: n.text }] : [];
  }),
);

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
  it('has real draft names in the content', () => {
    expect(drafts.length).toBeGreaterThan(0);
  });
  it('lists 54 cards, filters by category, hides draft names by default', async () => {
    await i18n.changeLanguage('es');
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'true');
    setup();
    expect(items().length).toBe(54);
    expect(screen.queryByText('borrador sin revisar')).toBeNull();
    expect(native().length).toBe(0);
    fireEvent.click(screen.getByRole('button', { name: 'Animales' }));
    expect(items().length).toBeLessThan(54);
    expect(items().length).toBeGreaterThan(0);
  });
  it('shows draft names with a badge when unreviewed names are not hidden', async () => {
    await i18n.changeLanguage('es');
    vi.stubEnv('VITE_HIDE_UNREVIEWED', 'false');
    setup();
    const first = drafts[0] as (typeof drafts)[number];
    expect(native().length).toBe(drafts.length);
    expect(native().some((e) => e.textContent?.includes(first.text))).toBe(true);
    expect(screen.getAllByText('borrador sin revisar').length).toBe(drafts.length);
  });
});
