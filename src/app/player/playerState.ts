import { PATTERNS, tabla, type CardId, type Lang, type PatternId } from '@engine';
import { cards } from '@content';
import { CLAIM_INTERVAL_MS } from '@net';

/** Host rate limit plus a margin for network jitter. */
export const CLAIM_COOLDOWN_MS = CLAIM_INTERVAL_MS + 750;
/** After this long without a claimResult the "waiting" state is dropped. */
export const CLAIM_REPLY_TIMEOUT_MS = 5000;

export interface RoundInfo {
  roomSeed: string;
  roundNo: number;
  pattern: PatternId;
  mode: 'normal' | 'escucha';
  callLang: Lang | 'rotating';
  speedSec: number;
}

export interface CurrentCall {
  cardId: CardId;
  choices: [CardId, CardId, CardId];
  lang: Lang;
  i: number;
  /** Local receive time (device clocks are never compared). */
  receivedAt: number;
}

export interface PlayerState {
  round: RoundInfo | null;
  /** Assigned by the host; only used when its roundNo matches the round. */
  assign: { tablaIndex: number; roundNo: number } | null;
  /** 16 card ids, row-major; empty until round and assign are both known. */
  board: CardId[];
  calledSoFar: CardId[];
  /** Card drawn at each call index, for results that arrive late. */
  callsByIndex: Record<number, CardId>;
  current: CurrentCall | null;
  currentExpired: boolean;
  /** Wrong choices already tried for the current call. */
  wrong: CardId[];
  pickPending: boolean;
  /** Feedback for the current call. */
  feedback: null | { kind: 'ok'; first: boolean } | { kind: 'casi' };
  /** Cards crossed out (frijolito), earned by correct picks or auto-mark. */
  crossed: CardId[];
  /** Persisted crossed cards waiting for the board to exist. */
  pendingCrossed: CardId[];
  points: Record<string, number>;
  autoMark: boolean;
  listenOnly: boolean;
  /** Epoch ms until which the claim button stays disabled. */
  claimUntil: number;
  claimPending: boolean;
  claimNoReply: boolean;
  claimResult: { valid: boolean; missing: CardId[] } | null;
  ended: { winners: string[]; wonByMe: boolean; dismissed: boolean } | null;
}

export type PlayerAction =
  | { type: 'round'; round: RoundInfo; called?: CardId[]; crossed?: CardId[] }
  | { type: 'assign'; tablaIndex: number; roundNo: number }
  | {
      type: 'call';
      cardId: CardId;
      choices: [CardId, CardId, CardId];
      lang: Lang;
      i: number;
      now: number;
    }
  | { type: 'pick'; cardId: CardId }
  | { type: 'pickResult'; roundNo: number; i: number; correct: boolean; first: boolean }
  | { type: 'expire'; i: number }
  | { type: 'scores'; roundNo: number; points: Record<string, number> }
  | { type: 'setAutoMark'; on: boolean }
  | { type: 'setListenOnly'; on: boolean }
  | { type: 'claim'; now: number }
  | { type: 'claimTimeout' }
  | { type: 'claimResult'; roundNo: number; valid: boolean; missing?: CardId[] }
  | { type: 'dismissResult' }
  | { type: 'dismissEnded' }
  | { type: 'end'; roundNo: number; winners: string[]; seat: string };

export const initialPlayerState: PlayerState = {
  round: null,
  assign: null,
  board: [],
  calledSoFar: [],
  callsByIndex: {},
  current: null,
  currentExpired: false,
  wrong: [],
  pickPending: false,
  feedback: null,
  crossed: [],
  pendingCrossed: [],
  points: {},
  autoMark: false,
  listenOnly: false,
  claimUntil: 0,
  claimPending: false,
  claimNoReply: false,
  claimResult: null,
  ended: null,
};

export function makeBoard(seed: string, tablaIndex: number): CardId[] {
  return tabla(seed, tablaIndex, cards).cards;
}

/** The first set of the round's pattern that is fully crossed out, as board indices. */
export function completedSet(s: Pick<PlayerState, 'round' | 'board' | 'crossed'>): number[] | null {
  if (!s.round || s.board.length !== 16) return null;
  for (const set of PATTERNS[s.round.pattern]) {
    if (set.every((idx) => s.crossed.includes(s.board[idx] as CardId))) return set;
  }
  return null;
}

export function canClaim(s: PlayerState, now: number): boolean {
  return completedSet(s) !== null && s.ended === null && now >= s.claimUntil;
}

const uniq = (a: CardId[]) => [...new Set(a)];

/** Past calls (not the one still open) that the auto-mark aid crosses out. */
function autoMarked(s: PlayerState): PlayerState {
  if (!s.autoMark || s.board.length === 0) return s;
  const open = s.current && !s.currentExpired ? s.current.cardId : null;
  const add = s.calledSoFar.filter(
    (id) => id !== open && s.board.includes(id) && !s.crossed.includes(id),
  );
  return add.length ? { ...s, crossed: [...s.crossed, ...add] } : s;
}

/** Build the board once round and assignment agree. */
function withBoard(s: PlayerState): PlayerState {
  if (!s.round || !s.assign || s.assign.roundNo !== s.round.roundNo) return s;
  if (s.board.length > 0) return s;
  const board = makeBoard(s.round.roomSeed, s.assign.tablaIndex);
  const crossed = uniq([...s.pendingCrossed, ...s.crossed]).filter((id) => board.includes(id));
  return autoMarked({ ...s, board, crossed, pendingCrossed: [] });
}

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'round': {
      const same =
        s.round && s.round.roundNo === a.round.roundNo && s.round.roomSeed === a.round.roomSeed;
      const called = a.called ?? [];
      if (same) {
        const merged = uniq([...called, ...s.calledSoFar]);
        return withBoard(autoMarked({ ...s, round: a.round, calledSoFar: merged }));
      }
      return withBoard({
        ...s,
        round: a.round,
        board: [],
        calledSoFar: uniq(called),
        callsByIndex: {},
        current: null,
        currentExpired: false,
        wrong: [],
        pickPending: false,
        feedback: null,
        crossed: [],
        pendingCrossed: a.crossed ?? [],
        points: {},
        claimUntil: 0,
        claimPending: false,
        claimNoReply: false,
        claimResult: null,
        ended: null,
      });
    }
    case 'assign': {
      if (s.round && s.round.roundNo !== a.roundNo) return s;
      const same =
        s.assign && s.assign.roundNo === a.roundNo && s.assign.tablaIndex === a.tablaIndex;
      if (same) return s;
      // A changed index for the same round invalidates the board.
      return withBoard({
        ...s,
        assign: { tablaIndex: a.tablaIndex, roundNo: a.roundNo },
        board: [],
      });
    }
    case 'call': {
      if (!s.round) return s;
      // A new call closes the previous window for the auto-mark aid.
      const closed = autoMarked({ ...s, currentExpired: true });
      const calledSoFar = closed.calledSoFar.includes(a.cardId)
        ? closed.calledSoFar
        : [...closed.calledSoFar, a.cardId];
      return {
        ...closed,
        calledSoFar,
        callsByIndex: { ...closed.callsByIndex, [a.i]: a.cardId },
        current: {
          cardId: a.cardId,
          choices: a.choices,
          lang: a.lang,
          i: a.i,
          receivedAt: a.now,
        },
        currentExpired: false,
        wrong: [],
        pickPending: false,
        feedback: null,
      };
    }
    case 'pick': {
      const c = s.current;
      if (!c || s.currentExpired || s.crossed.includes(c.cardId)) return s;
      if (!s.board.includes(c.cardId)) return s;
      if (a.cardId === c.cardId) return { ...s, pickPending: true };
      if (s.wrong.includes(a.cardId)) return s;
      return { ...s, wrong: [...s.wrong, a.cardId], feedback: { kind: 'casi' } };
    }
    case 'pickResult': {
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      const cardId = s.callsByIndex[a.i];
      const isCurrent = s.current?.i === a.i;
      if (!a.correct) return isCurrent ? { ...s, pickPending: false } : s;
      if (!cardId || !s.board.includes(cardId)) return s;
      return {
        ...s,
        crossed: s.crossed.includes(cardId) ? s.crossed : [...s.crossed, cardId],
        pickPending: isCurrent ? false : s.pickPending,
        feedback: isCurrent ? { kind: 'ok', first: a.first } : s.feedback,
      };
    }
    case 'expire': {
      if (!s.current || s.current.i !== a.i || s.currentExpired) return s;
      return autoMarked({ ...s, currentExpired: true, pickPending: false });
    }
    case 'scores':
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      return { ...s, points: a.points };
    case 'setAutoMark':
      return a.on ? autoMarked({ ...s, autoMark: true }) : { ...s, autoMark: false };
    case 'setListenOnly':
      return { ...s, listenOnly: a.on };
    case 'claim':
      return canClaim(s, a.now)
        ? { ...s, claimUntil: a.now + CLAIM_COOLDOWN_MS, claimPending: true, claimNoReply: false }
        : s;
    case 'claimTimeout':
      return s.claimPending ? { ...s, claimPending: false, claimNoReply: true } : s;
    case 'claimResult':
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      return {
        ...s,
        claimPending: false,
        claimNoReply: false,
        claimResult: { valid: a.valid, missing: a.missing ?? [] },
      };
    case 'dismissResult':
      return { ...s, claimResult: null };
    case 'dismissEnded':
      return s.ended ? { ...s, ended: { ...s.ended, dismissed: true } } : s;
    case 'end':
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      return {
        ...s,
        ended: { winners: a.winners, wonByMe: a.winners.includes(a.seat), dismissed: false },
      };
  }
}
