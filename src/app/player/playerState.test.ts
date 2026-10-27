import { describe, it, expect } from 'vitest';
import {
  playerReducer as r,
  initialPlayerState as init,
  fullCard,
  makeBoard,
  type RoundInfo,
} from './playerState';

const round: RoundInfo = { roomSeed: 's', roundNo: 1, speedSec: 8 };
const board = makeBoard('s', 5);
const [a, b, c] = board as [string, string, string];
const off = board.length ? 'not-on-board' : '';
const chs = (x: string): [string, string, string] => [x, 'd1', 'd2'];
const call = (cardId: string, i: number) =>
  ({ type: 'call', cardId, choices: chs(cardId), i, now: 1000 }) as const;
const started = () =>
  r(r(init, { type: 'round', round }), { type: 'assign', tablaIndex: 5, roundNo: 1 });

describe('playerReducer', () => {
  it('builds a random 4x4 board once round and assign agree, in either order', () => {
    expect(board).toHaveLength(16);
    expect(new Set(board).size).toBe(16);
    expect(r(init, { type: 'round', round }).board).toEqual([]);
    expect(started().board).toEqual(board);
    const assignFirst = r(r(init, { type: 'assign', tablaIndex: 5, roundNo: 1 }), {
      type: 'round',
      round,
    });
    expect(assignFirst.board).toEqual(board);
  });
  it('ignores an assign for another round', () => {
    const s = r(init, { type: 'round', round });
    expect(r(s, { type: 'assign', tablaIndex: 5, roundNo: 2 }).board).toEqual([]);
  });
  it('restores closed cards for a late joiner in either round/assign order', () => {
    const assign = { type: 'assign', tablaIndex: 5, roundNo: 1, closed: [a, off] } as const;
    for (const s of [
      r(r(init, { type: 'round', round }), { ...assign, closed: [...assign.closed] }),
      r(r(init, { ...assign, closed: [...assign.closed] }), { type: 'round', round }),
    ]) {
      expect(s.board).toEqual(board);
      expect(s.crossed).toEqual([a]);
      expect(s.revealed).toEqual([a, off]);
      expect(s.myPoints).toBe(0);
      expect(r(s, call(b, 2)).crossed).toEqual([a]);
    }
  });

  it('restores a reloaded phone without crossing the open call or losing newer history', () => {
    let s = r(init, { type: 'round', round });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1, closed: [a, off] });
    s = r(s, { type: 'scores', roundNo: 1, points: { me: 7 } });
    s = r(s, call(b, 2));
    expect(s.crossed).toEqual([a]);
    expect(s.currentClosed).toBe(false);
    expect(s.points.me).toBe(7);
    s = r(s, { type: 'callClosed', roundNo: 1, i: 2 });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1, closed: [a] });
    expect(new Set(s.crossed)).toEqual(new Set([a, b]));
    expect(r(s, call(b, 2))).toBe(s);
  });

  it('applies a newer snapshot to an existing assignment and closes its current call', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1, closed: [a] });
    expect(s.crossed).toEqual([a]);
    expect(s.currentClosed).toBe(true);
  });

  it('crosses closed calls received before the board was assigned', () => {
    let s = r(r(init, { type: 'round', round }), call(a, 0));
    s = r(s, { type: 'callClosed', roundNo: 1, i: 0 });
    expect(r(s, { type: 'assign', tablaIndex: 5, roundNo: 1 }).crossed).toEqual([a]);
  });

  it('a new round resets crosses, reveals and points', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'callClosed', roundNo: 1, i: 0 });
    s = r(s, { type: 'round', round: { ...round, roundNo: 2 } });
    expect(s.crossed).toEqual([]);
    expect(s.revealed).toEqual([]);
    expect(s.board).toEqual([]);
  });

  it('keeps words hidden while a call is open and reveals them on callClosed', () => {
    let s = r(started(), call(a, 0));
    expect(s.revealed).toEqual([]);
    expect(s.crossed).toEqual([]);
    s = r(s, { type: 'callClosed', roundNo: 1, i: 0 });
    expect(s.revealed).toEqual([a]);
    expect(s.currentClosed).toBe(true);
  });
  it('crosses a called card on my tabla at callClosed, whatever I picked', () => {
    const wrong = r(r(started(), call(a, 0)), { type: 'pick', cardId: 'd1' });
    expect(wrong.crossed).toEqual([]);
    expect(r(wrong, { type: 'callClosed', roundNo: 1, i: 0 }).crossed).toEqual([a]);
    const never = r(started(), call(b, 0));
    expect(r(never, { type: 'callClosed', roundNo: 1, i: 0 }).crossed).toEqual([b]);
  });
  it('reveals but does not cross a card that is not on my tabla', () => {
    const s = r(r(started(), call(off, 0)), { type: 'callClosed', roundNo: 1, i: 0 });
    expect(s.crossed).toEqual([]);
    expect(s.revealed).toEqual([off]);
  });
  it('a new call closes the previous one even if callClosed was lost', () => {
    const s = r(r(started(), call(a, 0)), call(b, 1));
    expect(s.crossed).toEqual([a]);
    expect(s.current?.cardId).toBe(b);
    expect(s.currentClosed).toBe(false);
  });
  it('ignores callClosed for another round or an unknown call', () => {
    const s = r(started(), call(a, 0));
    expect(r(s, { type: 'callClosed', roundNo: 9, i: 0 })).toBe(s);
    expect(r(s, { type: 'callClosed', roundNo: 1, i: 5 })).toBe(s);
  });

  it('a wrong pick dims that choice and allows exactly one more try', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'pick', cardId: 'd1' });
    expect(s.wrong).toEqual(['d1']);
    expect(s.feedback).toEqual({ kind: 'casi' });
    expect(r(s, { type: 'pick', cardId: 'd1' })).toBe(s);
    s = r(s, { type: 'pick', cardId: 'd2' });
    expect(s.wrong).toEqual(['d1', 'd2']);
    expect(r(s, { type: 'pick', cardId: a })).toBe(s); // 3rd pick is refused
  });
  it('a right pick waits for the host, then scores 2 (first) or 1', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'pick', cardId: a });
    expect(s.pickPending).toBe(true);
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, points: 2, first: true });
    expect(s.feedback).toEqual({ kind: 'ok', points: 2, first: true });
    expect(s.myPoints).toBe(2);
    expect(s.solved).toBe(true);
    let t = r(started(), call(b, 1));
    t = r(t, { type: 'pickResult', roundNo: 1, i: 1, correct: true, points: 1, first: false });
    expect(t.feedback).toEqual({ kind: 'ok', points: 1, first: false });
    expect(t.myPoints).toBe(1);
  });
  it('ignores a pickResult for an old call index or another round', () => {
    const s = r(started(), call(a, 3));
    expect(
      r(s, { type: 'pickResult', roundNo: 1, i: 2, correct: true, points: 2, first: true }),
    ).toBe(s);
    expect(
      r(s, { type: 'pickResult', roundNo: 7, i: 3, correct: true, points: 2, first: true }),
    ).toBe(s);
  });
  it('stores scores for the current round only', () => {
    const s = started();
    expect(r(s, { type: 'scores', roundNo: 1, points: { p1: 4 } }).points).toEqual({ p1: 4 });
    expect(r(s, { type: 'scores', roundNo: 2, points: { p1: 4 } }).points).toEqual({});
  });

  it('detects a full card', () => {
    const s = started();
    expect(fullCard(s)).toBe(false);
    expect(fullCard({ board, crossed: board })).toBe(true);
    expect(fullCard({ board, crossed: board.slice(1) })).toBe(false);
  });
  it('end records the winners and whether I won; dismiss hides it', () => {
    let s = r(started(), { type: 'end', roundNo: 1, winners: ['me', 'you'], seat: 'me' });
    expect(s.ended).toEqual({ winners: ['me', 'you'], wonByMe: true, dismissed: false });
    s = r(s, { type: 'dismissEnded' });
    expect(s.ended?.dismissed).toBe(true);
    expect(c).toBeTruthy();
  });
});
