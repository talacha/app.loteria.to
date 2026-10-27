import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { Msg, Transport } from '@net';
import type * as Content from '@content';
import type { Lang } from '@engine';
import { cards } from '@content';
import { useGame } from './useGame';
import { DEFAULT_SETTINGS } from './roundMachine';
import { makeBoard } from '../player/playerState';

// Expansion clips are produced separately. Exercise full coverage without fabricating metadata.
vi.mock('@content', async (original) => {
  const content = await original<typeof Content>();
  return {
    ...content,
    cardsAvailableIn: (langs: readonly Lang[]) =>
      langs.every((lang) => lang === 'es' || lang === 'en')
        ? content.cards
        : content.cards.filter((card) => card.n <= 54),
    langsForDeck: (ids: readonly string[]) =>
      ids.every((id) => content.cards.some((card) => card.n <= 54 && card.id === id))
        ? ['es', 'en', 'nah', 'yua', 'quz']
        : ['es', 'en'],
  };
});
vi.mock('../audio', () => ({
  setMediaSession: vi.fn(),
  speakCall: vi.fn(async () => 'audio'),
  stopAudio: vi.fn(),
}));
vi.mock('./persist', () => ({
  saveRound: vi.fn(async () => {}),
  clearRound: vi.fn(async () => {}),
}));

const roster = Array.from({ length: 20 }, (_, i) => ({
  seat: `p${i}`,
  name: `P${i}`,
  glyph: '🌽',
}));
afterEach(cleanup);

function mount(langs: Lang[], gridSize: number) {
  const sent: Msg[] = [];
  const messages = new Set<(message: Msg) => void>();
  const transport: Transport = {
    seat: 'host',
    join: vi.fn(async () => {}),
    send: (message) => sent.push(message),
    leave: vi.fn(async () => {}),
    onMessage: (callback) => {
      messages.add(callback);
      return () => messages.delete(callback);
    },
    onPresence: () => () => {},
    isHostVerified: () => true,
  };
  const game = renderHook(() =>
    useGame({
      transport,
      roster,
      room: {
        code: 'ABCDE',
        seed: 'expanded-room',
        hostKey: null,
        langs,
        settings: { ...DEFAULT_SETTINGS, gridSize },
        getRoster: () => roster,
      },
    }),
  );
  return { game, sent, messages };
}

describe('frozen room decks', () => {
  it('deals twenty matching 8x8 boards from the 144-card es/en intersection', () => {
    const { game, sent } = mount(['es', 'en'], 8);
    const round = sent.find((message) => message.t === 'round');
    expect(round).toMatchObject({ gridSize: 8, deck: cards.map((card) => card.id) });
    const assigns = sent.filter((message) => message.t === 'assign');
    expect(assigns).toHaveLength(20);
    for (const assign of assigns) {
      if (assign.t !== 'assign') continue;
      const board = makeBoard(
        'expanded-room',
        assign.tablaIndex,
        8,
        game.result.current.state.deck,
      );
      expect(board).toHaveLength(64);
      expect(board.every((id) => game.result.current.state.deck.includes(id))).toBe(true);
    }
    const call = sent.find((message) => message.t === 'call');
    expect(
      call?.t === 'call' && call.choices.every((id) => game.result.current.state.deck.includes(id)),
    ).toBe(true);
  });

  it('keeps the 54-card shared Indigenous pool and caps the chosen grid to fit', () => {
    const { game, sent } = mount(['es', 'nah'], 8);
    expect(game.result.current.state.deck).toEqual(
      cards.filter((card) => card.n <= 54).map((card) => card.id),
    );
    expect(game.result.current.state.settings.gridSize).toBe(4);
    expect(sent.find((message) => message.t === 'round')).toMatchObject({ gridSize: 4 });
  });

  it('preserves a smaller selected grid and cannot alter the pool for a late incompatible hello', () => {
    const { game, messages } = mount(['es'], 3);
    const deck = [...game.result.current.state.deck];
    act(() => {
      for (const callback of messages)
        callback({ t: 'hello', seat: 'p0', name: 'P0', glyph: '🌽', labelLang: 'nah' });
    });
    expect(game.result.current.state.deck).toEqual(deck);
    expect(game.result.current.state.settings.gridSize).toBe(3);
  });
});
