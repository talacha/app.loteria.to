import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { cardsAvailableIn, getCard } from '@content';
import i18n from '../i18n';
import SoloPage from './SoloPage';

const speak = vi.hoisted(() =>
  vi.fn<(...args: unknown[]) => Promise<string>>().mockResolvedValue('audio'),
);
vi.mock('../audio', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  speakCall: speak,
  stopAudio: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  speak.mockClear();
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(async () => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.restoreAllMocks();
  await i18n.changeLanguage('es');
});

const mount = () =>
  render(
    <MemoryRouter>
      <SoloPage />
    </MemoryRouter>,
  );
const stored = () =>
  JSON.parse(localStorage.getItem('loteria:profile') ?? '{}') as { spokenLang?: string };
const boardState = () =>
  [
    ...screen.getByRole('list', { name: i18n.t('solo.board') }).querySelectorAll('[data-marked]'),
  ].map((cell) => ({
    image: cell.querySelector('img')?.getAttribute('src'),
    marked: cell.getAttribute('data-marked'),
  }));
const choose = (group: string, language: string) =>
  fireEvent.click(
    within(screen.getByRole('radiogroup', { name: group })).getByRole('radio', {
      name: (name) => name.startsWith(language),
    }),
  );

describe('SoloPage language preferences', () => {
  it('uses the shared preference over an older solo choice and keeps setup changes in sync', () => {
    localStorage.setItem('loteria:profile', JSON.stringify({ spokenLang: 'en' }));
    localStorage.setItem('loteria:solo:lang', 'nah');
    mount();
    expect(
      within(screen.getByRole('radiogroup', { name: i18n.t('solo.spoken') }))
        .getByRole('radio', { name: 'English' })
        .getAttribute('aria-checked'),
    ).toBe('true');
    choose(i18n.t('solo.spoken'), 'Náhuatl');
    expect(stored().spokenLang).toBe('nah');
    expect(localStorage.getItem('loteria:solo:lang')).toBe('nah');
  });

  it.each(['solo', 'labelLang'])(
    'migrates the legacy %s choice into the shared spoken preference',
    (legacy) => {
      if (legacy === 'solo') localStorage.setItem('loteria:solo:lang', 'nah');
      else localStorage.setItem('loteria:profile', JSON.stringify({ labelLang: 'nah' }));
      mount();
      expect(stored().spokenLang).toBe('nah');
    },
  );

  it('changes both languages mid-game without changing the board, score, call or pause state', async () => {
    localStorage.setItem('loteria:profile', JSON.stringify({ spokenLang: 'nah' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    const first = speak.mock.calls[0]![0] as { id: string };
    fireEvent.click(screen.getByRole('button', { name: getCard(first.id)!.names.nah!.text! }));
    await act(async () => vi.advanceTimersByTimeAsync(8000));
    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    const before = boardState();
    expect(before.filter((cell) => cell.marked === 'true')).toHaveLength(1);
    expect(screen.getByText(/· 2 pts$/)).toBeTruthy();
    const current = speak.mock.calls.at(-1)![0];
    const spokenCalls = speak.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: i18n.t('theme.kit.gear.label') }));
    await act(async () => choose(i18n.t('theme.settings.uiTitle'), 'English'));
    expect(stored().spokenLang).toBe('nah');
    choose(i18n.t('theme.settings.spokenTitle'), 'English');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.close') }));
    expect(boardState()).toEqual(before);
    expect(screen.getByText(/· 2 pts$/)).toBeTruthy();
    expect(screen.getByText('Card 2 of 54')).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('solo.resume') })).toBeTruthy();
    expect(speak).toHaveBeenCalledTimes(spokenCalls);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('solo.replay') }));
    expect(speak).toHaveBeenLastCalledWith(current, 'en');
    fireEvent.click(screen.getByRole('button', { name: i18n.t('solo.resume') }));
    await act(async () => vi.advanceTimersByTimeAsync(8000));
    expect(speak).toHaveBeenLastCalledWith(expect.anything(), 'en');
    expect(boardState().map((cell) => cell.image)).toEqual(before.map((cell) => cell.image));
  });

  it('keeps uncovered voices disabled for an expanded active round', () => {
    localStorage.setItem('loteria:profile', JSON.stringify({ spokenLang: 'es' }));
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    const before = boardState();
    fireEvent.click(screen.getByRole('button', { name: i18n.t('theme.kit.gear.label') }));
    const languages = within(
      screen.getByRole('radiogroup', { name: i18n.t('theme.settings.spokenTitle') }),
    );
    const nahuatl = languages.getByRole('radio', { name: /^Náhuatl/ });
    expect((nahuatl as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(nahuatl);
    expect(stored().spokenLang).toBe('es');
    expect((languages.getByRole('radio', { name: /^English/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(boardState()).toEqual(before);
  });
});

describe('SoloPage large boards', () => {
  it.each(['es', 'en'] as const)('starts a 64-square board with three CPUs in %s', (lang) => {
    localStorage.setItem('loteria:profile', JSON.stringify({ spokenLang: lang }));
    mount();
    choose(i18n.t('solo.opponents'), '3');
    const size = within(screen.getByRole('radiogroup', { name: i18n.t('solo.grid') })).getByRole(
      'radio',
      { name: '8×8' },
    );
    expect(size.getAttribute('aria-disabled')).toBe('false');
    fireEvent.click(size);
    expect(size.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
    const board = screen.getByRole('list', { name: i18n.t('solo.board') });
    expect(board.children).toHaveLength(64);
    expect(board.getAttribute('data-grid')).toBe('8');
    expect(screen.getByText('Carta 1 de 144')).toBeTruthy();
    const standings = screen.getByRole('table', { name: 'Tabla de puntos' });
    expect(within(standings).getAllByRole('row')).toHaveLength(5);
    expect(standings.textContent).toContain('0/64');
    expect(speak).toHaveBeenLastCalledWith(expect.anything(), lang);
  });

  it.each(['nah', 'yua', 'quz'] as const)(
    'constrains a requested 8×8 to the %s covered pool',
    (lang) => {
      localStorage.setItem('loteria:profile', JSON.stringify({ spokenLang: 'es' }));
      mount();
      choose(i18n.t('solo.grid'), '8×8');
      choose(i18n.t('solo.spoken'), i18n.t(`lang.${lang}`));
      const sizes = within(screen.getByRole('radiogroup', { name: i18n.t('solo.grid') }));
      const eight = sizes.getByRole('radio', { name: /^8×8/ });
      expect(eight.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(eight);
      expect(eight.getAttribute('aria-checked')).toBe('false');
      expect(sizes.getByRole('radio', { name: '5×5' }).getAttribute('aria-checked')).toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Empezar' }));
      const board = screen.getByRole('list', { name: i18n.t('solo.board') });
      expect(board.children).toHaveLength(25);
      expect(board.getAttribute('data-grid')).toBe('5');
      expect(screen.getByText('Carta 1 de 54')).toBeTruthy();
      const covered = new Set(cardsAvailableIn([lang]).map((card) => `/cards/${card.id}.webp`));
      for (const image of board.querySelectorAll('img'))
        expect(covered.has(image.getAttribute('src')!)).toBe(true);
      expect(speak).toHaveBeenLastCalledWith(expect.anything(), lang);
    },
  );
});
