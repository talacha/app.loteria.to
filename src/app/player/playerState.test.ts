import { describe, it, expect } from 'vitest';
import {
  playerReducer as r,
  initialPlayerState as init,
  canClaim,
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
};
const board = makeBoard('s', 5);
const [a, b, c] = board as [string, string, string];
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
    expect(s.marks).toEqual([a]);
  });
  it('records calls without duplicates and ignores calls before a round', () => {
    expect(r(init, { type: 'call', cardId: a, lang: 'es', i: 0 })).toBe(init);
    let s = started();
    s = r(s, { type: 'call', cardId: a, lang: 'es', i: 0 });
    s = r(s, { type: 'call', cardId: a, lang: 'es', i: 0 });
    expect(s.calledSoFar).toEqual([a]);
  });
  it('toggles marks only for cards on the board', () => {
    let s = started();
    s = r(s, { type: 'toggleMark', cardId: a });
    s = r(s, { type: 'toggleMark', cardId: 'zzz' });
    expect(s.marks).toEqual([a]);
    s = r(s, { type: 'toggleMark', cardId: a });
    expect(s.marks).toEqual([]);
  });
  it('auto-marks called cards on the board, including past ones', () => {
    let s = started();
    s = r(s, { type: 'call', cardId: b, lang: 'es', i: 0 });
    s = r(s, { type: 'setAutoMark', on: true });
    expect(s.marks).toEqual([b]);
    s = r(s, { type: 'call', cardId: 'x', lang: 'es', i: 1 });
    s = r(s, { type: 'call', cardId: c, lang: 'es', i: 2 });
    expect(s.marks).toEqual([b, c]);
  });
  it('rate-limits claims and tracks the pending reply', () => {
    let s = started();
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
    s = r(s, { type: 'call', cardId: a, lang: 'es', i: 0 });
    s = r(s, { type: 'toggleMark', cardId: a });
    const again = r(s, { type: 'round', round: { ...round, pattern: 'full' }, called: [b] });
    expect(again.marks).toEqual([a]);
    expect(again.calledSoFar).toEqual([b, a]);
    expect(again.round?.pattern).toBe('full');
    const next = r(s, { type: 'round', round: { ...round, roundNo: 2 } });
    expect(next.marks).toEqual([]);
    expect(next.board).toEqual([]);
    expect(next.calledSoFar).toEqual([]);
    expect(next.ended).toBeNull();
  });
  it('restores persisted marks that are on the board', () => {
    let s = r(init, { type: 'round', round, marks: [a, 'zz'] });
    s = r(s, { type: 'assign', tablaIndex: 5, roundNo: 1 });
    expect(s.marks).toEqual([a]);
  });
});
