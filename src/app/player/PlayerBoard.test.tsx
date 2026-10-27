import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '../i18n';
import i18n from '../i18n';
import { LocalTransport, type Msg } from '@net';
import { cards, getCard } from '@content';
import PlayerBoard, { type PlayerProfile } from './PlayerBoard';
import { makeBoard } from './playerState';
import { wordOf } from './words';
import { LanguageSettings } from '../ui';

const speak = vi.hoisted(() => vi.fn(async () => 'audio'));
vi.mock('../audio', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  speakCall: speak,
}));

const profile: PlayerProfile = { name: 'Ana', glyph: '🐆', spokenLang: 'nah' };
const CODE = 'ABCDE';
const SEED = 'seed-1';
const flush = async (ms = 20) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

let host: LocalTransport;
let received: Msg[];
let player: LocalTransport;

const round = (over: Partial<Extract<Msg, { t: 'round' }>> = {}): Msg => ({
  t: 'round',
  seed: SEED,
  roundNo: 1,
  speedSec: 8,
  ...over,
});

async function mount(p: PlayerProfile = profile) {
  player = new LocalTransport({ seat: 'p1' });
  await player.join(CODE, 'player');
  render(
    <PlayerBoard
      transport={player}
      room={{ code: CODE, seat: 'p1', hostVerified: false }}
      profile={p}
    />,
  );
  await flush(30);
}

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  speak.mockClear();
  received = [];
  host = new LocalTransport({ seat: 'host-seat' });
  await host.join(CODE, 'host');
  host.onMessage((m) => received.push(m));
});
afterEach(async () => {
  cleanup();
  await player?.leave();
  await host.leave();
  await act(async () => {
    await i18n.changeLanguage('es');
  });
});

const board = makeBoard(SEED, 7);
const target = board[2]!;
const offBoard = (n: number) => {
  const all = ['sol', 'luna', 'agua', 'maiz', 'gallo', 'venado', 'rana', 'arbol', 'nube'];
  return all.filter((id) => !board.includes(id) && getCard(id)).slice(0, n);
};

async function start() {
  host.send(round());
  host.send({ t: 'assign', seat: player.seat, tablaIndex: 7, roundNo: 1 });
  await flush();
}
async function callTarget(i = 0, id = target) {
  const others = board.filter((x) => x !== id).slice(0, 2) as [string, string];
  host.send({ t: 'call', i, cardId: id, choices: [others[0], id, others[1]], at: 0 });
  await flush();
  return others;
}
const tabla = () => screen.getByRole('list', { name: 'Tu tabla' });

describe('PlayerBoard board', () => {
  it('keeps a late Indigenous-language joiner on a supported voice for an expanded round', async () => {
    await mount();
    host.send(round({ deck: cards.map((card) => card.id), gridSize: 8 }));
    host.send({ t: 'assign', seat: player.seat, tablaIndex: 7, roundNo: 1 });
    await flush();
    expect(within(tabla()).getAllByRole('listitem')).toHaveLength(64);
    expect(
      screen.getByText(/Náhuatl no está disponible en esta ronda. Escucharás Español/),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    expect((screen.getByRole('radio', { name: /Náhuatl/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('radio', { name: /Español/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(received.some((message) => message.t === 'hello' && message.labelLang === 'es')).toBe(
      true,
    );
  });

  it('shows a preparing state until its own assign arrives; ignores other seats', async () => {
    await mount();
    host.send(round());
    await flush();
    expect(screen.getByText(/Preparando tu tabla/)).toBeTruthy();
    host.send({ t: 'assign', seat: 'someone-else', tablaIndex: 3, roundNo: 1 });
    await flush();
    expect(screen.getByText(/Preparando tu tabla/)).toBeTruthy();
    host.send({ t: 'assign', seat: player.seat, tablaIndex: 7, roundNo: 1 });
    await flush();
    expect(screen.queryByText(/Preparando tu tabla/)).toBeNull();
    expect(within(tabla()).getAllByRole('listitem')).toHaveLength(16);
  });

  it('restores crossed squares and points from a rejoin snapshot without past call messages', async () => {
    await mount();
    host.send(round());
    host.send({ t: 'assign', seat: player.seat, tablaIndex: 7, roundNo: 1, closed: [target] });
    host.send({ t: 'scores', roundNo: 1, points: { [player.seat]: 7 } });
    await callTarget(3, board[3]!);
    expect(tabla().querySelectorAll('[data-marked="true"]')).toHaveLength(1);
    expect(within(tabla()).getByText(wordOf(target, 'nah'))).toBeTruthy();
    expect(within(tabla()).queryByText(wordOf(board[3]!, 'nah'))).toBeNull();
    expect(screen.getByTestId('points').textContent).toBe('7 puntos');
  });

  it('shows icons only (no words) until a card has been called and closed', async () => {
    await mount();
    await start();
    for (const id of board) expect(within(tabla()).queryByText(wordOf(id, 'nah'))).toBeNull();
    await callTarget();
    // Open call: still no word on the board for the called card.
    expect(within(tabla()).queryByText(wordOf(target, 'nah'))).toBeNull();
    host.send({ t: 'callClosed', roundNo: 1, i: 0 });
    await flush();
    expect(within(tabla()).getByText(wordOf(target, 'nah'))).toBeTruthy();
    const other = board.find((x) => x !== target)!;
    expect(within(tabla()).queryByText(wordOf(other, 'nah'))).toBeNull();
  });
});

describe('PlayerBoard call', () => {
  it('shows the card picture, plays audio in my spoken language, never shows the spelling', async () => {
    await mount();
    await start();
    await callTarget();
    const call = screen.getByTestId('call');
    expect(within(call).getByRole('img', { name: 'Carta que se está cantando' })).toBeTruthy();
    expect(call.querySelector('img')?.getAttribute('src')).toBe(`/cards/${target}.webp`);
    expect(call.textContent).not.toContain(wordOf(target, 'nah'));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0]).toEqual([getCard(target), 'nah']);
    fireEvent.click(screen.getByRole('button', { name: 'Repetir la carta' }));
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('announces "Nueva carta" to screen readers without the spelling', async () => {
    await mount();
    await start();
    await callTarget();
    const live = screen.getByTestId('announce');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.textContent).toBe('Nueva carta 1');
    expect(live.textContent).not.toContain(wordOf(target, 'nah'));
  });

  it('has a mute toggle and the AI-voice note, and no review tags', async () => {
    await mount();
    await start();
    await callTarget();
    expect(screen.getByText('voz generada por IA')).toBeTruthy();
    const mute = screen.getByRole('button', { name: 'Silenciar la voz' });
    fireEvent.click(mute);
    expect(
      screen.getByRole('button', { name: 'Activar la voz' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Activar la voz' }));
    expect(document.body.textContent).not.toMatch(/en revisión/i);
  });
});

describe('PlayerBoard picking', () => {
  it('renders three choices as words in my spoken language, labelled by the word', async () => {
    await mount();
    await start();
    const others = await callTarget();
    for (const id of [others[0], target, others[1]])
      expect(screen.getByRole('button', { name: wordOf(id, 'nah') })).toBeTruthy();
  });

  it('the first tap sends a pick; a wrong pick dims, says ¡Casi! and allows one retry', async () => {
    await mount();
    await start();
    const others = await callTarget();
    const wrong = screen.getByRole('button', {
      name: wordOf(others[0], 'nah'),
    }) as HTMLButtonElement;
    fireEvent.click(wrong);
    await flush();
    expect(received.filter((m) => m.t === 'pick')).toHaveLength(1);
    expect(received.find((m) => m.t === 'pick')).toMatchObject({
      seat: player.seat,
      roundNo: 1,
      i: 0,
      cardId: others[0],
    });
    expect(wrong.disabled).toBe(true);
    expect(wrong.getAttribute('data-state')).toBe('wrong');
    expect(screen.getByText('¡Casi!')).toBeTruthy();
    fireEvent.click(wrong); // dimmed: no resend
    await flush(450); // the host accepts one pick per 400 ms per seat
    fireEvent.click(screen.getByRole('button', { name: wordOf(target, 'nah') }));
    await flush();
    const picks = received.filter((m) => m.t === 'pick');
    expect(picks).toHaveLength(2);
    expect(picks[1]).toMatchObject({ cardId: target });
  });

  it('refuses a third pick in one call', async () => {
    await mount();
    await start();
    const others = await callTarget();
    fireEvent.click(screen.getByRole('button', { name: wordOf(others[0], 'nah') }));
    await flush(450);
    fireEvent.click(screen.getByRole('button', { name: wordOf(others[1], 'nah') }));
    await flush();
    expect(
      (screen.getByRole('button', { name: wordOf(target, 'nah') }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(received.filter((m) => m.t === 'pick')).toHaveLength(2);
  });

  it('shows "¡Eso! +2 · ¡Fuiste primero!" and updates the points chip', async () => {
    await mount();
    await start();
    await callTarget();
    fireEvent.click(screen.getByRole('button', { name: wordOf(target, 'nah') }));
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: player.seat,
      correct: true,
      points: 2,
      first: true,
    });
    await flush();
    expect(screen.getByText('¡Eso! +2 · ¡Fuiste primero!')).toBeTruthy();
    expect(screen.getByTestId('points').textContent).toBe('2 puntos');
    host.send({ t: 'scores', roundNo: 1, points: { [player.seat]: 5 } });
    await flush();
    expect(screen.getByTestId('points').textContent).toBe('5 puntos');
  });

  it('shows "¡Eso! +1" when not first, and ignores other players\' results', async () => {
    await mount();
    await start();
    await callTarget();
    fireEvent.click(screen.getByRole('button', { name: wordOf(target, 'nah') }));
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: 'other',
      correct: true,
      points: 2,
      first: true,
    });
    await flush();
    expect(screen.queryByText(/Fuiste primero/)).toBeNull();
    host.send({
      t: 'pickResult',
      roundNo: 1,
      i: 0,
      seat: player.seat,
      correct: true,
      points: 1,
      first: false,
    });
    await flush();
    expect(screen.getByText('¡Eso! +1')).toBeTruthy();
    expect(screen.getByTestId('points').textContent).toBe('1 punto');
  });

  it('works in English UI with a Náhuatl spoken language', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await mount();
    await start();
    await callTarget();
    expect(screen.getByText('Tap the word you heard')).toBeTruthy();
    expect(screen.getByRole('button', { name: wordOf(target, 'nah') })).toBeTruthy();
  });
});

describe('PlayerBoard crossing and settings', () => {
  it('crosses a called card on my tabla at callClosed even if I never picked', async () => {
    await mount();
    await start();
    await callTarget();
    expect(tabla().querySelectorAll('[data-marked="true"]')).toHaveLength(0);
    host.send({ t: 'callClosed', roundNo: 1, i: 0 });
    await flush();
    expect(tabla().querySelectorAll('[data-marked="true"]')).toHaveLength(1);
    expect(within(tabla()).getByText(wordOf(target, 'nah'))).toBeTruthy();
  });

  it('does not cross a card that is not on my tabla', async () => {
    await mount();
    await start();
    const [off] = offBoard(1);
    const others = board.slice(0, 2) as [string, string];
    host.send({ t: 'call', i: 0, cardId: off!, choices: [others[0], off!, others[1]], at: 0 });
    host.send({ t: 'callClosed', roundNo: 1, i: 0 });
    await flush();
    expect(tabla().querySelectorAll('[data-marked="true"]')).toHaveLength(0);
  });

  it('changes the spoken language mid-game from the settings sheet', async () => {
    await mount();
    await start();
    await callTarget();
    host.send({ t: 'callClosed', roundNo: 1, i: 0 });
    await flush();
    expect(within(tabla()).getByText(wordOf(target, 'nah'))).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const dialog = screen.getByRole('dialog', { name: 'Ajustes' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /Español/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cerrar ajustes' }));
    expect(within(tabla()).getByText(wordOf(target, 'es'))).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('loteria:profile')!)).toMatchObject({
      spokenLang: 'es',
    });
    // The menus stay in Spanish/English independently.
    expect(document.documentElement.lang).toBe('es');
  });

  it('keeps the in-game and global language controls synchronized without resetting play', async () => {
    await mount();
    await start();
    await callTarget();
    host.send({ t: 'scores', roundNo: 1, points: { [player.seat]: 7 } });
    await flush();
    const pictures = () =>
      [...tabla().querySelectorAll('img')].map((image) => image.getAttribute('src'));
    const before = pictures();
    render(<LanguageSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    const sheet = within(screen.getByRole('dialog', { name: 'Ajustes' }));
    fireEvent.click(sheet.getByRole('radio', { name: /^English/ }));
    fireEvent.click(sheet.getByRole('button', { name: 'Cerrar ajustes' }));
    const global = within(
      screen.getByRole('radiogroup', { name: i18n.t('theme.settings.spokenTitle') }),
    );
    expect(global.getByRole('radio', { name: /^English/ }).getAttribute('aria-checked')).toBe(
      'true',
    );
    fireEvent.click(global.getByRole('radio', { name: /^Español/ }));
    expect(screen.getByRole('button', { name: wordOf(target, 'es') })).toBeTruthy();
    expect(pictures()).toEqual(before);
    expect(screen.getByTestId('points').textContent).toBe('7 puntos');
    await callTarget(1, board[3]!);
    expect(speak).toHaveBeenLastCalledWith(expect.anything(), 'es');
  });

  it('switching the UI language leaves the spoken language alone', async () => {
    await mount();
    await start();
    await callTarget();
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: /English/ })[0]!);
    });
    expect(screen.getByText('Your board')).toBeTruthy();
    expect(screen.getByRole('button', { name: wordOf(target, 'nah') })).toBeTruthy();
  });
});

describe('PlayerBoard win', () => {
  it('shows the win screen on end{winners} with the sole winner', async () => {
    await mount();
    await start();
    host.send({ t: 'end', roundNo: 1, winners: [player.seat], reason: 'full-card' });
    host.send({ t: 'scores', roundNo: 1, points: { [player.seat]: 9 } });
    await flush();
    expect(screen.getByRole('heading', { name: '¡Lotería!' })).toBeTruthy();
    expect(screen.getByText(/Completaste tu tabla con 9 puntos/)).toBeTruthy();
  });

  it('words the tie by points', async () => {
    await mount();
    await start();
    host.send({ t: 'scores', roundNo: 1, points: { [player.seat]: 7, rival: 7 } });
    host.send({ t: 'end', roundNo: 1, winners: [player.seat, 'rival'], reason: 'full-card' });
    await flush();
    expect(screen.getByRole('status').textContent).toMatch(
      /Empate: .* completaron la tabla en la misma carta, con 7 puntos/,
    );
  });

  it('shows another winner by name', async () => {
    await mount();
    await start();
    host.send({ t: 'end', roundNo: 1, winners: ['rival'], reason: 'full-card' });
    await flush();
    expect(screen.getByText(/completó la tabla/)).toBeTruthy();
  });
});

describe('PlayerBoard leaderboard', () => {
  const roster = [
    { seat: 'p1', name: 'Ana', glyph: '🐆' },
    { seat: 'rival', name: 'Beto', glyph: '🐸' },
    { seat: 'third', name: 'Carla', glyph: '🦋' },
  ];
  async function mountRoster() {
    player = new LocalTransport({ seat: 'p1' });
    await player.join(CODE, 'player');
    render(
      <PlayerBoard
        transport={player}
        room={{ code: CODE, seat: 'p1', hostVerified: false }}
        profile={profile}
        roster={roster}
      />,
    );
    await flush(30);
  }
  const rows = () =>
    within(screen.getByTestId('leaderboard'))
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent);

  it('is a collapsible panel after the cartón, sorted by points from scores', async () => {
    await mountRoster();
    await start();
    const panel = screen.getByTestId('leaderboard') as HTMLDetailsElement;
    expect(panel.open).toBe(false);
    expect(screen.getByRole('list', { name: 'Tu tabla' }).compareDocumentPosition(panel)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    host.send({
      t: 'scores',
      roundNo: 1,
      points: { p1: 1, rival: 5, third: 3 },
      crossed: { p1: 2, rival: 4, third: 3 },
    });
    await flush();
    const r = rows();
    expect(r[0]).toMatch(/^1.*Beto.*5.*4\/16/);
    expect(r[1]).toMatch(/^2.*Carla.*3.*3\/16/);
    expect(r[2]).toMatch(/^3.*Ana.*Tú.*1/);
    expect(panel.querySelector('summary')!.textContent).toContain('Tu lugar: 3');
  });

  it('shows the final standings on the end screen for everyone', async () => {
    await mountRoster();
    await start();
    host.send({
      t: 'scores',
      roundNo: 1,
      points: { p1: 2, rival: 9, third: 9 },
      crossed: { p1: 1, rival: 16, third: 16 },
    });
    host.send({ t: 'end', roundNo: 1, winners: ['rival', 'third'], reason: 'full-card' });
    await flush();
    const table = screen.getByRole('table', { name: 'Tabla de puntos final' });
    const body = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent);
    expect(body[0]).toMatch(/^1.*Beto/);
    expect(body[1]).toMatch(/^1.*Carla/);
    expect(body[2]).toMatch(/^3.*Ana.*Tú/);
  });

  it('renders a g x g board from round.gridSize', async () => {
    await mountRoster();
    host.send(round({ gridSize: 5 }));
    host.send({ t: 'assign', seat: player.seat, tablaIndex: 7, roundNo: 1 });
    await flush();
    const list = screen.getByRole('list', { name: 'Tu tabla' });
    expect(list.getAttribute('data-grid')).toBe('5');
    expect(list.children).toHaveLength(25);
  });

  it('follows the spoken language changed from the header gear', async () => {
    await mountRoster();
    await start();
    host.send({
      t: 'call',
      i: 0,
      cardId: target,
      choices: [target, ...offBoard(2)] as [string, string, string],
      at: 1,
    });
    await flush();
    speak.mockClear();
    const { mergeProfile } = await import('../ui/profile');
    await act(async () => {
      mergeProfile({ spokenLang: 'en' });
    });
    expect(screen.getByRole('button', { name: wordOf(target, 'en') })).toBeTruthy();
    host.send({
      t: 'call',
      i: 1,
      cardId: board[3]!,
      choices: [board[3]!, ...offBoard(2)] as [string, string, string],
      at: 2,
    });
    await flush();
    expect(speak).toHaveBeenLastCalledWith(expect.anything(), 'en');
  });
});
