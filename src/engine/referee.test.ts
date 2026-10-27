import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  createRoom,
  hostReduce,
  tabla,
  PATTERNS,
  type HostEvent,
  type HostOutput,
  type Msg,
  type RoomState,
  type RoundSettings,
} from './index';

const settings = (o: Partial<RoundSettings> = {}): RoundSettings => ({
  pattern: 'corners',
  callLang: 'es',
  speedSec: 10,
  mode: 'normal',
  ...o,
});
let rngState = 1;
const detRng = () => (rngState = (rngState * 16807) % 2147483647) / 2147483647;

const room = () => createRoom(detRng);
const hello = (seat: string): HostEvent => ({
  type: 'msg',
  now: 0,
  msg: { t: 'hello', seat, name: seat, glyph: 'x', labelLang: 'es' },
});
const claimEv = (seat: string, marks: string[], now: number): HostEvent => ({
  type: 'msg',
  now,
  msg: { t: 'claim', seat, tablaIndex: 0, marks },
});
function run(s: RoomState, ...evs: HostEvent[]): { state: RoomState; out: HostOutput[] } {
  const out: HostOutput[] = [];
  for (const e of evs) {
    const o = hostReduce(s, e);
    s = o.state;
    out.push(o);
  }
  return { state: s, out };
}
/** Put the given cards first in the call order so tests can control what has been called. */
function withOrder(s: RoomState, first: string[]): RoomState {
  const rest = s.round!.order.filter((c) => !first.includes(c));
  return { ...s, round: { ...s.round!, order: [...first, ...rest] } };
}
function cornersOf(s: RoomState, seat: string): string[] {
  const t = tabla(s.seed, s.seats[seat]!.tablaIndex);
  return PATTERNS.corners[0]!.map((c) => t.cards[c]!);
}
function started(seats = ['a', 'b']) {
  let { state } = run(room(), ...seats.map(hello));
  state = run(state, { type: 'startRound', settings: settings() }).state;
  const corners = cornersOf(state, seats[0]!);
  return { state: withOrder(state, corners), corners };
}
const nexts = (n: number): HostEvent[] =>
  Array.from({ length: n }, () => ({ type: 'next' as const, now: 1 }));

describe('round flow', () => {
  it('R-09.1 round message never carries deckSecret', () => {
    const s = room();
    const { out } = run(s, { type: 'startRound', settings: settings() });
    expect(JSON.stringify(out[0]!.send)).not.toContain(s.deckSecret);
    expect(out[0]!.send[0]).toMatchObject({
      t: 'round',
      roundNo: 1,
      pattern: 'corners',
      seed: s.seed,
    });
  });
  it('R-17.1 surprise easy: round message carries a resolved easy figure before any call', () => {
    const { out } = run(
      room(),
      { type: 'startRound', settings: settings({ pattern: { surprise: 'easy' } }) },
      ...nexts(1),
    );
    expect(out[0]!.send[0]).toMatchObject({ t: 'round' });
    expect(['line', 'square']).toContain((out[0]!.send[0] as Extract<Msg, { t: 'round' }>).pattern);
    expect(out[1]!.send[0]!.t).toBe('call');
  });
  it('R-17.2 surprise medium after corners is not corners', () => {
    for (let k = 0; k < 20; k++) {
      let s = createRoom(detRng);
      s = run(s, { type: 'startRound', settings: settings({ pattern: 'corners' }) }).state;
      s = run(s, {
        type: 'startRound',
        settings: settings({ pattern: { surprise: 'medium' } }),
      }).state;
      expect(s.round!.pattern).not.toBe('corners');
    }
  });
  it('R-10.1 54 calls are 54 distinct cards; the next "next" ends with no winners (R-44.1)', () => {
    const s0 = run(room(), { type: 'startRound', settings: settings() }).state;
    const { state, out } = run(s0, ...nexts(55));
    const calls = out.slice(0, 54).map((o) => (o.send[0] as Extract<Msg, { t: 'call' }>).cardId);
    expect(new Set(calls).size).toBe(54);
    expect(out[54]!.send).toEqual([{ t: 'end', winners: [] }]);
    expect(out[54]!.effects).toEqual([{ type: 'roundEnded', winners: [] }]);
    expect(state.round!.status).toBe('ended');
    expect(hostReduce(state, { type: 'next' }).send).toEqual([]);
  });
  it('R-11.1 Normal speed + es speaks with verse; fast or indigenous or escucha does not', () => {
    const go = (o: Partial<RoundSettings>) => {
      const s = run(room(), { type: 'startRound', settings: settings(o) }).state;
      return hostReduce(s, { type: 'next', now: 5 }).effects[0];
    };
    expect(go({})).toMatchObject({ type: 'speak', lang: 'es', withVerse: true });
    expect(go({ speedSec: 6 })).toMatchObject({ withVerse: false });
    expect(go({ callLang: 'nah' })).toMatchObject({ lang: 'nah', withVerse: false });
    expect(go({ mode: 'escucha' })).toMatchObject({ withVerse: false });
  });
  it('R-13.1 paused round calls nothing; resume continues', () => {
    let s = run(room(), { type: 'startRound', settings: settings() }, ...nexts(1)).state;
    s = hostReduce(s, { type: 'pause' }).state;
    expect(hostReduce(s, { type: 'next' }).send).toEqual([]);
    s = hostReduce(s, { type: 'resume' }).state;
    expect(hostReduce(s, { type: 'next' }).send).toHaveLength(1);
  });
  it('R-13.2 repeat speaks the current card, no state change', () => {
    const s = run(room(), { type: 'startRound', settings: settings() }, ...nexts(3)).state;
    const o = hostReduce(s, { type: 'repeat' });
    expect(o.state).toBe(s);
    expect(o.send).toEqual([]);
    expect(o.effects[0]).toMatchObject({ type: 'speak', cardId: s.round!.order[2] });
  });
  it('R-14.1 rotating: calls 0,1,2 are es,en,nah over LANGS (and call carries at=now)', () => {
    const { out } = run(
      room(),
      { type: 'startRound', settings: settings({ callLang: 'rotating' }) },
      { type: 'next', now: 77 },
      ...nexts(5),
    );
    const langs = out.slice(1).map((o) => (o.send[0] as Extract<Msg, { t: 'call' }>).lang);
    expect(langs).toEqual(['es', 'en', 'nah', 'yua', 'quz', 'es']);
    expect(out[1]!.send[0]).toMatchObject({ i: 0, at: 77 });
  });
  it('call order is a permutation of the 54 cards (property over secrets)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (k) => {
        rngState = k;
        const { out } = run(
          createRoom(detRng),
          { type: 'startRound', settings: settings() },
          ...nexts(54),
        );
        const ids = out.slice(1).map((o) => (o.send[0] as Extract<Msg, { t: 'call' }>).cardId);
        expect([...ids].sort()).toEqual([...new Set(ids)].sort());
        expect(ids).toHaveLength(54);
      }),
      { numRuns: 25 },
    );
  });
});

describe('players', () => {
  it('R-26.1 late joiner gets the called list; R-27 re-hello keeps the same tabla', () => {
    let s = run(room(), { type: 'startRound', settings: settings() }, ...nexts(12)).state;
    const o = hostReduce(s, hello('late'));
    s = o.state;
    const w = o.send[0] as Extract<Msg, { t: 'welcome' }>;
    expect(w.called).toEqual(s.round!.order.slice(0, 12));
    expect(w.round).toMatchObject({ roundNo: 1, pattern: 'corners' });
    const again = hostReduce(s, hello('late')).send[0] as Extract<Msg, { t: 'welcome' }>;
    expect(again.tablaIndex).toBe(w.tablaIndex);
    expect(hostReduce(s, hello('late')).state.takenIndices).toHaveLength(1);
  });
  it('R-06 hello assigns distinct indices >= 10000', () => {
    const { state } = run(room(), ...['a', 'b', 'c', 'd'].map(hello));
    const idx = Object.values(state.seats).map((x) => x.tablaIndex);
    expect(new Set(idx).size).toBe(4);
    expect(Math.min(...idx)).toBeGreaterThanOrEqual(10000);
  });
});

describe('claims', () => {
  it('R-18/R-22 valid claim: claimResult valid, effect cells, status claimPause, winner added', () => {
    const { state, corners } = started();
    const o = hostReduce(state, claimEv('a', corners, 1000));
    expect(hostReduce(withCalled(state, 4), claimEv('a', corners, 1000)).send[0]).toEqual({
      t: 'claimResult',
      seat: 'a',
      valid: true,
    });
    expect(o.send[0]).toMatchObject({ valid: false }); // nothing called yet
    const ready = withCalled(state, 4);
    const v = hostReduce(ready, claimEv('a', corners, 1000));
    expect(v.effects[0]).toEqual({ type: 'claim', seat: 'a', valid: true, cells: [0, 3, 12, 15] });
    expect(v.state.round!.status).toBe('claimPause');
    expect(v.state.round!.winners).toEqual(['a']);
  });
  it('R-18.3 invalid claim lists the missing card and is not a winner', () => {
    const { state, corners } = started();
    const ready = withCalled(state, 4);
    const v = hostReduce(ready, claimEv('a', corners.slice(0, 3), 1000));
    expect(v.send[0]).toEqual({ t: 'claimResult', seat: 'a', valid: false, missing: [corners[3]] });
    expect(v.state.round!.winners).toEqual([]);
    expect(v.state.round!.status).toBe('running');
  });
  it('R-19.1 a pattern completed at call 4 is valid at call 25', () => {
    const { state, corners } = started();
    const v = hostReduce(withCalled(state, 25), claimEv('a', corners, 1000));
    expect(v.send[0]).toMatchObject({ valid: true });
  });
  it('R-20.1 a second claim after 2 s is ignored; at 3.1 s it is checked', () => {
    const { state, corners } = started();
    const ready = withCalled(state, 4);
    const s = hostReduce(ready, claimEv('a', corners.slice(0, 3), 1000)).state;
    const early = hostReduce(s, claimEv('a', corners, 3000));
    expect(early.send).toEqual([]);
    expect(early.state).toBe(s);
    const late = hostReduce(s, claimEv('a', corners, 4100));
    expect(late.send[0]).toMatchObject({ valid: true });
  });
  it('R-21.1 two valid claims 300 ms apart both win', () => {
    const { state } = started(['a', 'b']);
    const both = new Set([...cornersOf(state, 'a'), ...cornersOf(state, 'b')]);
    const ready = withCalled(withOrder(state, [...both]), both.size);
    let s = hostReduce(ready, claimEv('a', cornersOf(ready, 'a'), 5000)).state;
    expect(s.round!.status).toBe('claimPause');
    s = hostReduce(s, claimEv('b', cornersOf(ready, 'b'), 5300)).state;
    expect(s.round!.winners).toEqual(['a', 'b']);
    const end = hostReduce(s, { type: 'end' });
    expect(end.send).toEqual([{ t: 'end', winners: ['a', 'b'] }]);
    expect(end.effects).toEqual([{ type: 'roundEnded', winners: ['a', 'b'] }]);
  });
  it("claim is judged on the seat's assigned tabla, not the claimed index", () => {
    const { state, corners } = started(['a', 'b']);
    const ready = withCalled(state, 4);
    const forged: HostEvent = {
      type: 'msg',
      now: 1000,
      msg: { t: 'claim', seat: 'b', tablaIndex: ready.seats.a!.tablaIndex, marks: corners },
    };
    const v = hostReduce(ready, forged);
    expect(v.send[0]).toMatchObject({ seat: 'b', valid: false });
  });
  it('claims from unknown seats or outside a round are ignored', () => {
    const s = room();
    expect(hostReduce(s, claimEv('ghost', [], 0)).send).toEqual([]);
    const { state } = started();
    expect(hostReduce(state, claimEv('ghost', [], 0)).send).toEqual([]);
  });
  it('seat resume from claimPause continues calling; no send contains deckSecret (property)', () => {
    const evArb = fc.oneof(
      fc.constant<HostEvent>({ type: 'next', now: 1 }),
      fc.constant<HostEvent>({ type: 'repeat' }),
      fc.constant<HostEvent>({ type: 'pause' }),
      fc.constant<HostEvent>({ type: 'resume' }),
      fc.constant<HostEvent>({ type: 'end' }),
      fc.constant<HostEvent>({
        type: 'startRound',
        settings: settings({ pattern: { surprise: 'any' } }),
      }),
      fc.constantFrom('a', 'b', 'c').map((x) => hello(x)),
      fc
        .tuple(
          fc.constantFrom('a', 'b', 'c'),
          fc.nat(10000),
          fc.array(fc.constantFrom(...cardIdsSample), { maxLength: 20 }),
        )
        .map(([x, now, m]) => claimEv(x, m, now)),
    );
    fc.assert(
      fc.property(
        fc.array(evArb, { maxLength: 80 }),
        fc.integer({ min: 1, max: 2 ** 30 }),
        (evs, k) => {
          rngState = k;
          let s = createRoom(detRng);
          for (const e of evs) {
            const o = hostReduce(s, e);
            expect(JSON.stringify(o.send)).not.toContain(s.deckSecret);
            expect(JSON.stringify(o.effects)).not.toContain(s.deckSecret);
            s = o.state;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
  it('a full simulated round with 3 seats and random claims never throws', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2 ** 30 }), (k) => {
        rngState = k;
        let s = createRoom(detRng);
        for (const x of ['a', 'b', 'c']) s = hostReduce(s, hello(x)).state;
        s = hostReduce(s, { type: 'startRound', settings: settings({ pattern: 'line' }) }).state;
        for (let n = 0; n < 60; n++) {
          s = hostReduce(s, { type: 'next', now: n * 10000 }).state;
          for (const x of ['a', 'b', 'c']) {
            const called = s.round!.order.slice(0, s.round!.called);
            s = hostReduce(s, claimEv(x, called, n * 10000 + 5)).state;
          }
          if (s.round!.status === 'claimPause') s = hostReduce(s, { type: 'resume' }).state;
        }
        expect(s.round!.status).toBe('ended');
      }),
      { numRuns: 20 },
    );
  });
});

function withCalled(s: RoomState, n: number): RoomState {
  return { ...s, round: { ...s.round!, called: n } };
}
const cardIdsSample = ['tochtli', 'cangrejo', 'x', 'y'];
