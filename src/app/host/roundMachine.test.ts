import { describe, expect, it } from 'vitest';
import { cards } from '@content';
import {
  MAX_SHARED_CARDS,
  decodeTablaCode,
  deckOrder,
  pickTablaIndex,
  tabla,
  tablaCode,
} from '@engine';
import {
  calledCards,
  currentCard,
  initialRound,
  langForCall,
  randomSeed,
  roundReducer,
  toSaved,
  validatePaperCode,
  validateSeatClaim,
} from './roundMachine';
import type { RoundAction, RoundState } from './roundMachine';

const ids = cards.map((c) => c.id);
const deck = cards.map((c) => ({ id: c.id, category: c.category }));
const run = (s: RoundState, ...as: RoundAction[]) => as.reduce(roundReducer, s);
const fresh = () => initialRound('ABCDE', 'SEEDSEED', ['es', 'en']);
const started = () => run(fresh(), { type: 'start', ids, langs: ['es', 'en'] });

describe('roundMachine', () => {
  it('start calls the first card of deckOrder and no repeats follow', () => {
    let s = started();
    const order = deckOrder('SEEDSEED', 1, ids);
    expect(currentCard(s)).toBe(order[0]);
    for (let i = 1; i < 54; i++) s = run(s, { type: 'next' });
    expect(calledCards(s)).toEqual(order);
    expect(new Set(calledCards(s)).size).toBe(54);
    s = run(s, { type: 'next' });
    expect(s.phase).toBe('ended');
  });

  it('clamps speed and ignores start twice', () => {
    let s = run(fresh(), { type: 'configure', patch: { speedSec: 99 } });
    expect(s.settings.speedSec).toBe(20);
    s = run(s, { type: 'configure', patch: { speedSec: 1 } });
    expect(s.settings.speedSec).toBe(6);
    const a = run(s, { type: 'start', ids, langs: ['es'] });
    expect(run(a, { type: 'start', ids, langs: ['es'] })).toBe(a);
  });

  it('rotates languages through callable langs', () => {
    const s = run(started(), { type: 'configure', patch: { callLang: 'rotating' } });
    expect([0, 1, 2, 3].map((i) => langForCall(s, i))).toEqual(['es', 'en', 'es', 'en']);
    const fixed = run(s, { type: 'configure', patch: { callLang: 'en' } });
    expect(langForCall(fixed, 5)).toBe('en');
  });

  it('pauses and resumes', () => {
    const s = started();
    const p = run(s, { type: 'togglePause' });
    expect(p.phase).toBe('paused');
    expect(run(p, { type: 'togglePause' }).phase).toBe('running');
    expect(run(fresh(), { type: 'pause' }).phase).toBe('setup');
  });

  it('validates phone claims against the assigned index only', () => {
    let s = run(started(), { type: 'configure', patch: { pattern: 'full' } });
    s = run(s, { type: 'assign', seat: 'p1', index: 3 });
    const t0 = tabla('SEEDSEED', 3, deck);
    const claim = (o: object = {}) => ({
      seat: 'p1',
      roundNo: 1,
      tablaIndex: 3,
      marks: t0.cards,
      ...o,
    });
    expect(validateSeatClaim(s, deck, claim()).valid).toBe(false);
    for (let i = 1; i < 54; i++) s = run(s, { type: 'next' });
    expect(validateSeatClaim(s, deck, claim()).valid).toBe(true);
    expect(validateSeatClaim(s, deck, claim({ tablaIndex: 4 })).valid).toBe(false);
    expect(validateSeatClaim(s, deck, claim({ roundNo: 2 })).valid).toBe(false);
    expect(validateSeatClaim(s, deck, claim({ seat: 'nobody' })).valid).toBe(false);
    const bad = validateSeatClaim(s, deck, claim({ marks: t0.cards.slice(1) }));
    expect(bad.valid).toBe(false);
    expect(bad.missing).toEqual([t0.cards[0]]);
  });

  it('assigns 20 seats so no pair shares more than MAX_SHARED_CARDS cards', () => {
    const taken: number[] = [];
    for (let i = 0; i < 20; i++) taken.push(pickTablaIndex('SEEDSEED', taken, deck));
    expect(new Set(taken).size).toBe(20);
    const sets = taken.map((t) => new Set(tabla('SEEDSEED', t, deck).cards));
    for (let a = 0; a < 20; a++) {
      for (let b = a + 1; b < 20; b++) {
        const shared = [...sets[a]!].filter((c) => sets[b]!.has(c)).length;
        expect(shared).toBeLessThanOrEqual(MAX_SHARED_CARDS);
      }
    }
  });

  it('records winners once and pauses', () => {
    const s = run(started(), { type: 'win', seat: 'a' }, { type: 'win', seat: 'a' });
    expect(s.winners).toEqual(['a']);
    expect(s.phase).toBe('paused');
    // an already-recorded winner changes nothing (no re-pause)
    const r = run(s, { type: 'resume' });
    expect(run(r, { type: 'win', seat: 'a' })).toBe(r);
    expect(run(fresh(), { type: 'win', seat: 'a' }).winners).toEqual([]);
    expect(run(s, { type: 'resume' }).phase).toBe('running');
  });

  it('validates paper codes, including wrong seedRef', () => {
    let s = run(started(), { type: 'configure', patch: { pattern: 'full' } });
    const code = tablaCode('SEEDSEED', 7);
    const early = validatePaperCode(s, deck, code);
    expect(early.kind).toBe('almost');
    if (early.kind === 'almost') {
      expect(early.index).toBe(7);
      expect(early.missing.length).toBeGreaterThan(0);
    }
    expect(validatePaperCode(s, deck, 'zzzzzz').kind).toBe('invalid');
    // find a seed with a different ref
    let other = 'OTHER000';
    for (
      let n = 0;
      decodeTablaCode(tablaCode(other, 7)).seedRef === decodeTablaCode(code).seedRef;
      n++
    )
      other = `OTHER${n}`;
    expect(validatePaperCode(s, deck, tablaCode(other, 7)).kind).toBe('otherGame');
    for (let i = 1; i < 54; i++) s = run(s, { type: 'next' });
    expect(validatePaperCode(s, deck, code)).toEqual({ kind: 'valid', index: 7 });
  });

  it('newRound bumps roundNo and reshuffles', () => {
    const s = run(started(), { type: 'finish', winners: [] }, { type: 'newRound' });
    expect(s.roundNo).toBe(2);
    expect(s.phase).toBe('setup');
    const s2 = run(s, { type: 'start', ids, langs: ['es'] });
    expect(currentCard(s2)).toBe(deckOrder('SEEDSEED', 2, ids)[0]);
  });

  it('resume restores position paused with the same order', () => {
    let s = started();
    s = run(s, { type: 'next' }, { type: 'next' }, { type: 'win', seat: 'x' });
    const saved = toSaved(run(s, { type: 'resume' }));
    const r = run(fresh(), { type: 'restore', saved, ids });
    expect(r.phase).toBe('paused');
    expect(r.calledCount).toBe(3);
    expect(r.order).toEqual(s.order);
    expect(r.winners).toEqual(['x']);
    expect(r.code).toBe('ABCDE');
  });

  it('print seed helpers', () => {
    expect(randomSeed()).toMatch(/^[0-9A-HJKMNP-TV-Z]{8}$/);
    expect(run(fresh(), { type: 'setSeed', roomSeed: 'ZZZZZZZZ' }).roomSeed).toBe('ZZZZZZZZ');
  });
});
