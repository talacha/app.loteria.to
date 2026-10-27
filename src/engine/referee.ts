import type { Effect, HostEvent, HostOutput, Lang, RoomState } from './types';
import type { Msg, RoundFields } from './msg';
import { LANGS } from '@content';
import { deckOrder } from './deck';
import { surpriseFigure } from './figures';
import { checkClaim } from './claim';
import { pickTablaIndex, tabla } from './tabla';

export const CLAIM_COOLDOWN_MS = 3000;
export const DECK_SIZE = 54;

const none = (state: RoomState): HostOutput => ({ state, send: [], effects: [] });

export function langForCall(callLang: Lang | 'rotating', i: number): Lang {
  return callLang === 'rotating' ? (LANGS[i % LANGS.length] as Lang) : callLang;
}

function roundFields(s: RoomState): RoundFields | null {
  if (!s.round) return null;
  return {
    seed: s.seed,
    roundNo: s.roundNo,
    pattern: s.round.pattern,
    mode: s.settings.mode,
    callLang: s.settings.callLang,
    speedSec: s.settings.speedSec,
  };
}

function speak(s: RoomState, i: number): Effect {
  const lang = langForCall(s.settings.callLang, i);
  return {
    type: 'speak',
    cardId: s.round!.order[i] as string,
    lang,
    withVerse:
      s.settings.mode === 'normal' && s.settings.speedSec >= 10 && (lang === 'es' || lang === 'en'),
  };
}

function endRound(s: RoomState): HostOutput {
  const round = s.round;
  if (!round || round.status === 'ended') return none(s);
  const next: RoomState = { ...s, round: { ...round, status: 'ended' } };
  return {
    state: next,
    send: [{ t: 'end', winners: [...round.winners] }],
    effects: [{ type: 'roundEnded', winners: [...round.winners] }],
  };
}

function hello(s: RoomState, m: Extract<Msg, { t: 'hello' }>): HostOutput {
  const known = s.seats[m.seat];
  const tablaIndex = known ? known.tablaIndex : pickTablaIndex(s.seed, s.takenIndices);
  const info = {
    seat: m.seat,
    name: m.name.slice(0, 24),
    glyph: m.glyph,
    labelLang: m.labelLang,
    tablaIndex,
    ...(m.pronouns !== undefined ? { pronouns: m.pronouns } : {}),
  };
  const next: RoomState = {
    ...s,
    seats: { ...s.seats, [m.seat]: info },
    takenIndices: known ? s.takenIndices : [...s.takenIndices, tablaIndex],
  };
  const live = next.round && next.round.status !== 'ended' ? next.round : null;
  const welcome: Msg = {
    t: 'welcome',
    seat: m.seat,
    tablaIndex,
    round: live ? roundFields(next) : null,
    called: live ? live.order.slice(0, live.called) : [],
  };
  return { state: next, send: [welcome], effects: [] };
}

function claim(s: RoomState, m: Extract<Msg, { t: 'claim' }>, now: number): HostOutput {
  const round = s.round;
  const seat = s.seats[m.seat];
  if (!round || round.status === 'ended' || !seat) return none(s);
  const last = s.lastClaimAt[m.seat];
  if (last !== undefined && now - last < CLAIM_COOLDOWN_MS) return none(s);
  // Always evaluate the seat's assigned tabla, never the index the client claims.
  const t = tabla(s.seed, seat.tablaIndex);
  const res = checkClaim(t, round.order.slice(0, round.called), round.pattern, m.marks);
  const lastClaimAt = { ...s.lastClaimAt, [m.seat]: now };
  if (res.valid) {
    const winners = round.winners.includes(m.seat) ? round.winners : [...round.winners, m.seat];
    return {
      state: { ...s, lastClaimAt, round: { ...round, status: 'claimPause', winners } },
      send: [{ t: 'claimResult', seat: m.seat, valid: true }],
      effects: [{ type: 'claim', seat: m.seat, valid: true, cells: res.cells as number[] }],
    };
  }
  const missing = res.missing ?? [];
  return {
    state: { ...s, lastClaimAt },
    send: [{ t: 'claimResult', seat: m.seat, valid: false, missing }],
    effects: [{ type: 'claim', seat: m.seat, valid: false, missing }],
  };
}

/** The referee. Pure: all time comes from events, all randomness from the state's secrets. */
export function hostReduce(state: RoomState, ev: HostEvent): HostOutput {
  switch (ev.type) {
    case 'startRound': {
      const roundNo = state.roundNo + 1;
      const pattern =
        typeof ev.settings.pattern === 'string'
          ? ev.settings.pattern
          : surpriseFigure(
              state.deckSecret,
              roundNo,
              ev.settings.pattern.surprise,
              state.round?.pattern,
            );
      const next: RoomState = {
        ...state,
        roundNo,
        settings: ev.settings,
        lastClaimAt: {},
        round: {
          pattern,
          order: deckOrder(state.deckSecret, roundNo),
          called: 0,
          status: 'running',
          winners: [],
        },
      };
      return {
        state: next,
        send: [{ t: 'round', ...(roundFields(next) as RoundFields) }],
        effects: [],
      };
    }
    case 'next': {
      const round = state.round;
      if (!round || round.status !== 'running') return none(state);
      if (round.called >= DECK_SIZE) return endRound(state);
      const i = round.called;
      const next: RoomState = { ...state, round: { ...round, called: i + 1 } };
      return {
        state: next,
        send: [
          {
            t: 'call',
            i,
            cardId: round.order[i] as string,
            lang: langForCall(state.settings.callLang, i),
            at: ev.now ?? 0,
          },
        ],
        effects: [speak(next, i)],
      };
    }
    case 'repeat': {
      const round = state.round;
      if (!round || round.status === 'ended' || round.called === 0) return none(state);
      return { state, send: [], effects: [speak(state, round.called - 1)] };
    }
    case 'pause':
      return state.round?.status === 'running'
        ? {
            state: { ...state, round: { ...state.round, status: 'paused' } },
            send: [],
            effects: [],
          }
        : none(state);
    case 'resume':
      return state.round && (state.round.status === 'paused' || state.round.status === 'claimPause')
        ? {
            state: { ...state, round: { ...state.round, status: 'running' } },
            send: [],
            effects: [],
          }
        : none(state);
    case 'end':
      return endRound(state);
    case 'msg':
      if (ev.msg.t === 'hello') return hello(state, ev.msg);
      if (ev.msg.t === 'claim') return claim(state, ev.msg, ev.now);
      return none(state);
  }
}
