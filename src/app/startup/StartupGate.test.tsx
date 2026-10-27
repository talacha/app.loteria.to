import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartupGate, type AppLoader } from './StartupGate';

describe('StartupGate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows a bilingual recovery screen and retries after a content import failure', async () => {
    const load = vi
      .fn<AppLoader>()
      .mockRejectedValueOnce({
        issues: [{ path: ['names', 'nah', 'source'], message: 'Required' }],
      })
      .mockResolvedValueOnce({
        default: () => <div>Game ready</div>,
      });
    const onRetry = vi.fn();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<StartupGate load={load} onRetry={onRetry} />);

    expect(await screen.findByRole('heading', { name: /la app no pudo iniciar/i })).toBeTruthy();
    expect(screen.getByRole('heading').querySelector('[lang="en"]')?.textContent).toBe(
      'The app could not start',
    );
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(error).toHaveBeenCalledWith(
      'Application startup failed. Invalid content paths:',
      ['names.nah.source'],
      expect.objectContaining({ issues: expect.any(Array) }),
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(await screen.findByText('Game ready')).toBeTruthy();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});
