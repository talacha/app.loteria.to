import { describe, it, expect } from 'vitest';
import {
  playerReducer as r,
  initialPlayerState as init,
  canClaim,
  completedSet,
  makeBoard,
  CLAIM_COOLDOWN_MS,
  type RoundInfo,
} from './playerState';

const round: RoundInfo = {
  roomSeed: 's',
  roundNo: 1,
  pattern: 'line',
  mode: 'normal',
  callLang: 'es',
  speedSec: 8,
};
const board = makeBoard('s', 5);
const [a, b, c] = board as [string, string, string];
const chs = (x: string): [string, string, string] => [x, 'd1', 'd2'];
const call = (cardId: string, i: number) =>
  ({ type: 'call', cardId, choices: chs(cardId), lang: 'es', i, now: 1000 }) as const;
const started = () =>
  r(r(init, { type: 'round', round }), { type: 'assign', tablaIndex: 5, roundNo: 1 });

describe('playerReducer', () => {
  it('has no board until the host assigns one, in either order', () => {
    const onlyRound = r(init, { type: 'round', round });
    expect(onlyRound.board).toEqual([]);
    expect(canClaim(onlyRound, 1e12)).toBe(false);
    expect(started().board).toEqual(board);
    const assignFirst = r(r(init, { type: 'assign', tablaIndex: 5, roundNo: 1 }), {
      type: 'round',
      round,
    });
    expect(assignFirst.board).toEqual(board);
  });
  it('ignores an assign for another round', () => {
    const s = r(r(init, { type: 'round', round }), { type: 'assign', tablaIndex: 5, roundNo: 9 });
    expect(s.board).toEqual([]);
  });
  it('seeds history from round.called and auto-marks it', () => {
    let s = r(init, { type: 'setAutoMark', on: true });
    s = r(s, { type: 'round', round, called: [a, 'zz'] });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1 });
    expect(s.calledSoFar).toEqual([a, 'zz']);
    expect(s.crossed).toEqual([a]);
  });
  it('records calls without duplicates and ignores calls before a round', () => {
    expect(r(init, call(a, 0))).toBe(init);
    let s = started();
    s = r(s, call(a, 0));
    s = r(s, call(a, 0));
    expect(s.calledSoFar).toEqual([a]);
  });
  it('crosses a card only on a correct pickResult for a card on the board', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'pick', cardId: a });
    expect(s.pickPending).toBe(true);
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, first: true });
    expect(s.crossed).toEqual([a]);
    expect(s.feedback).toEqual({ kind: 'ok', first: true });
    expect(s.pickPending).toBe(false);
  });
  it('a wrong pick gives casi, is not repeated, and can be retried with another', () => {
    let s = r(started(), call(a, 0));
    s = r(s, { type: 'pick', cardId: 'd1' });
    expect(s.feedback).toEqual({ kind: 'casi' });
    expect(s.wrong).toEqual(['d1']);
    expect(r(s, { type: 'pick', cardId: 'd1' })).toBe(s);
    s = r(s, { type: 'pick', cardId: a });
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, first: false });
    expect(s.crossed).toEqual([a]);
    expect(s.feedback).toEqual({ kind: 'ok', first: false });
  });
  it('ignores picks when the called card is not on my tabla', () => {
    const off = 'not-on-board';
    let s = r(started(), call(off, 0));
    expect(r(s, { type: 'pick', cardId: off })).toBe(s);
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, first: true });
    expect(s.crossed).toEqual([]);
  });
  it('ignores picks after the window expired and pickResult of another round', () => {
    let s = r(started(), call(a, 0));
    const stale = r(s, { type: 'pickResult', roundNo: 9, i: 0, correct: true, first: true });
    expect(stale).toBe(s);
    s = r(s, { type: 'expire', i: 0 });
    expect(r(s, { type: 'pick', cardId: a })).toBe(s);
  });
  it('a late pickResult crosses the card of its own call index', () => {
    let s = r(started(), call(a, 0));
    s = r(s, call(b, 1));
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, first: false });
    expect(s.crossed).toEqual([a]);
    expect(s.feedback).toBeNull();
  });
  it('stores scores for the current round only', () => {
    let s = started();
    s = r(s, { type: 'scores', roundNo: 1, points: { me: 2 } });
    expect(s.points).toEqual({ me: 2 });
    expect(r(s, { type: 'scores', roundNo: 7, points: { me: 9 } })).toBe(s);
  });
  it('auto-marks called cards on the board, including past ones', () => {
    let s = started();
    s = r(s, call(b, 0));
    s = r(s, { type: 'setAutoMark', on: true });
    expect(s.crossed).toEqual([]); // the open call is not crossed yet
    s = r(s, call('x', 1));
    expect(s.crossed).toEqual([b]);
    s = r(s, call(c, 2));
    s = r(s, call('y', 3));
    expect(s.crossed).toEqual([b, c]);
  });
  it('rate-limits claims and tracks the pending reply', () => {
    // Cross a full row so the pattern is complete.
    let s = r(init, { type: 'round', round, crossed: board.slice(0, 4) });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1 });
    expect(completedSet(s)).toEqual([0, 1, 2, 3]);
    expect(canClaim(r(started(), { type: 'claim', now: 1 }), 1e12)).toBe(false);
    s = r(s, { type: 'claim', now: 1000 });
    expect(s.claimUntil).toBe(1000 + CLAIM_COOLDOWN_MS);
    expect(s.claimPending).toBe(true);
    expect(r(s, { type: 'claim', now: 2000 })).toBe(s);
    expect(canClaim(s, 1000 + CLAIM_COOLDOWN_MS)).toBe(true);
    s = r(s, { type: 'claimTimeout' });
    expect(s.claimPending).toBe(false);
    expect(s.claimNoReply).toBe(true);
  });
  it('ignores stale-round claimResult and end', () => {
    const s = started();
    expect(r(s, { type: 'claimResult', roundNo: 0, valid: true })).toBe(s);
    expect(r(s, { type: 'end', roundNo: 0, winners: ['x'], seat: 'me' })).toBe(s);
  });
  it('stores claim results and dismisses them', () => {
    let s = r(started(), { type: 'claimResult', roundNo: 1, valid: false, missing: [a] });
    expect(s.claimResult).toEqual({ valid: false, missing: [a] });
    s = r(s, { type: 'dismissResult' });
    expect(s.claimResult).toBeNull();
  });
  it('ends the round, flags whether I won, and can be dismissed', () => {
    let s = r(started(), { type: 'end', roundNo: 1, winners: ['me'], seat: 'me' });
    expect(s.ended?.wonByMe).toBe(true);
    expect(canClaim(s, 1e12)).toBe(false);
    s = r(s, { type: 'dismissEnded' });
    expect(s.ended?.dismissed).toBe(true);
  });
  it('same round re-broadcast keeps state; a new round resets it', () => {
    let s = started();
    s = r(s, call(a, 0));
    s = r(s, { type: 'pickResult', roundNo: 1, i: 0, correct: true, first: true });
    const again = r(s, { type: 'round', round: { ...round, pattern: 'full' }, called: [b] });
    expect(again.crossed).toEqual([a]);
    expect(again.calledSoFar).toEqual([b, a]);
    expect(again.round?.pattern).toBe('full');
    const next = r(s, { type: 'round', round: { ...round, roundNo: 2 } });
    expect(next.crossed).toEqual([]);
    expect(next.board).toEqual([]);
    expect(next.calledSoFar).toEqual([]);
    expect(next.ended).toBeNull();
  });
  it('restores persisted marks that are on the board', () => {
    let s = r(init, { type: 'round', round, crossed: [a, 'zz'] });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1 });
    expect(s.crossed).toEqual([a]);
  });
});
