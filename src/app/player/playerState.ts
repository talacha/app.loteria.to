import { tabla, type CardId, type Lang, type PatternId } from '@engine';
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
}

export interface PlayerState {
  round: RoundInfo | null;
  /** Assigned by the host; only used when its roundNo matches the round. */
  assign: { tablaIndex: number; roundNo: number } | null;
  /** 16 card ids, row-major; empty until round and assign are both known. */
  board: CardId[];
  calledSoFar: CardId[];
  current: { cardId: CardId; lang: Lang; i: number } | null;
  marks: CardId[];
  /** Persisted marks waiting for the board to exist. */
  pendingMarks: CardId[];
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
  | { type: 'round'; round: RoundInfo; called?: CardId[]; marks?: CardId[] }
  | { type: 'assign'; tablaIndex: number; roundNo: number }
  | { type: 'call'; cardId: CardId; lang: Lang; i: number }
  | { type: 'toggleMark'; cardId: CardId }
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
  current: null,
  marks: [],
  pendingMarks: [],
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

export function canClaim(s: PlayerState, now: number): boolean {
  return s.board.length > 0 && s.ended === null && now >= s.claimUntil;
}

const uniq = (a: CardId[]) => [...new Set(a)];

function autoMarked(s: PlayerState): PlayerState {
  if (!s.autoMark || s.board.length === 0) return s;
  const add = s.calledSoFar.filter((id) => s.board.includes(id) && !s.marks.includes(id));
  return add.length ? { ...s, marks: [...s.marks, ...add] } : s;
}

/** Build the board once round and assignment agree. */
function withBoard(s: PlayerState): PlayerState {
  if (!s.round || !s.assign || s.assign.roundNo !== s.round.roundNo) return s;
  if (s.board.length > 0) return s;
  const board = makeBoard(s.round.roomSeed, s.assign.tablaIndex);
  const marks = uniq([...s.pendingMarks, ...s.marks]).filter((id) => board.includes(id));
  return autoMarked({ ...s, board, marks, pendingMarks: [] });
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
        current: null,
        marks: [],
        pendingMarks: a.marks ?? [],
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
      const calledSoFar = s.calledSoFar.includes(a.cardId)
        ? s.calledSoFar
        : [...s.calledSoFar, a.cardId];
      return autoMarked({
        ...s,
        calledSoFar,
        current: { cardId: a.cardId, lang: a.lang, i: a.i },
      });
    }
    case 'toggleMark': {
      if (!s.board.includes(a.cardId)) return s;
      return {
        ...s,
        marks: s.marks.includes(a.cardId)
          ? s.marks.filter((id) => id !== a.cardId)
          : [...s.marks, a.cardId],
      };
    }
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
