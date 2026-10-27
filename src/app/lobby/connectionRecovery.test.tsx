import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import type { Msg, Transport } from '@net';
import i18n from '../i18n';
import PlayerBoard from '../player/PlayerBoard';
import LobbyWaiting from './LobbyWaiting';

const profile = { name: 'Ana', glyph: '🌽', spokenLang: 'es' as const };
const cases = [
  ['ProtocolVersionError', 'es', /Recarga todas las pantallas, incluida la de quien organiza/],
  ['ProtocolVersionError', 'en', /Reload all screens, including the organiser’s/],
  ['SequenceStorageError', 'es', /Habilita el almacenamiento del navegador/],
  ['SequenceStorageError', 'en', /Enable browser storage/],
] as const;

function mockTransport() {
  const errors = new Set<(error: unknown) => void>();
  const messages = new Set<(message: Msg) => void>();
  const transport: Transport = {
    seat: 'player',
    join: vi.fn(async () => {}),
    send: vi.fn(),
    leave: vi.fn(async () => {}),
    onMessage: (callback) => {
      messages.add(callback);
      return () => messages.delete(callback);
    },
    onError: (callback) => {
      errors.add(callback);
      return () => errors.delete(callback);
    },
    onPresence: () => () => {},
    isHostVerified: () => true,
  };
  return { transport, errors, messages };
}

async function mount(view: 'waiting' | 'playing', transport: Transport) {
  if (view === 'waiting') {
    render(
      <LobbyWaiting
        code="ABCDE"
        profile={profile}
        transportFactory={() => transport}
        onLeave={() => {}}
      />,
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  } else {
    render(
      <PlayerBoard
        transport={transport}
        room={{ code: 'ABCDE', seat: transport.seat, hostVerified: true }}
        profile={profile}
      />,
    );
  }
}

afterEach(async () => {
  cleanup();
  localStorage.clear();
  await i18n.changeLanguage('es');
});

for (const view of ['waiting', 'playing'] as const) {
  describe(`${view} connection recovery`, () => {
    it.each(cases)('explains %s recovery in %s', async (name, lang, wording) => {
      await i18n.changeLanguage(lang);
      const { transport, errors } = mockTransport();
      await mount(view, transport);
      act(() => {
        for (const callback of errors)
          callback(Object.assign(new Error('Internal diagnostic'), { name }));
      });
      expect(screen.getByRole('alert').textContent).toMatch(wording);
      expect(
        screen.getByRole('button', { name: /Recargar esta pantalla|Reload this screen/ }),
      ).toBeTruthy();
      expect(document.body.textContent).not.toContain('Internal diagnostic');
      // A later generic failure cannot hide the action that is still needed.
      act(() => {
        for (const callback of errors) callback(new Error('Connection lost'));
      });
      expect(screen.getByRole('alert').textContent).toMatch(wording);
    });

    it('keeps the existing connection-lost treatment for ordinary errors', async () => {
      await i18n.changeLanguage('es');
      const { transport, errors } = mockTransport();
      await mount(view, transport);
      act(() => {
        for (const callback of errors) callback(new Error('offline'));
      });
      expect(screen.getByText(/Se perdió la conexión/)).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
}

it('keeps recovery visible when the lobby transitions to the player board', async () => {
  const { transport, errors, messages } = mockTransport();
  await mount('waiting', transport);
  act(() => {
    for (const callback of errors) callback({ name: 'ProtocolVersionError' });
    for (const callback of messages) callback({ t: 'round', seed: 's', roundNo: 1, speedSec: 8 });
  });
  expect(screen.queryByText('Ya casi empezamos…')).toBeNull();
  expect(screen.getByRole('alert').textContent).toMatch(/Recarga todas las pantallas/);
});

it('explains storage failure rejected during join', async () => {
  const { transport } = mockTransport();
  vi.mocked(transport.join).mockRejectedValueOnce({ name: 'SequenceStorageError' });
  await mount('waiting', transport);
  expect(screen.getByRole('alert').textContent).toMatch(/Habilita el almacenamiento del navegador/);
});
