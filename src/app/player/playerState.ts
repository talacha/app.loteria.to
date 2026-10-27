import { tabla, type CardId } from '@engine';
import { cards } from '@content';

export interface RoundInfo {
  roomSeed: string;
  roundNo: number;
  speedSec: number;
  /** Cartón is gridSize x gridSize; 4 when the host did not say. */
  gridSize?: number;
}

export interface CurrentCall {
  cardId: CardId;
  /** Same three cards, same order, for every player. Rendered in my spoken language. */
  choices: [CardId, CardId, CardId];
  i: number;
  /** Local receive time (device clocks are never compared). */
  receivedAt: number;
}

export type Feedback = null | { kind: 'ok'; points: 1 | 2; first: boolean } | { kind: 'casi' };

export interface PlayerState {
  round: RoundInfo | null;
  /** Assigned by the host; only used when its roundNo matches the round. */
  assign: { tablaIndex: number; roundNo: number; closed?: CardId[] } | null;
  /** 16 card ids, row-major; empty until round and assign are both known. */
  board: CardId[];
  /** Card drawn at each call index, for messages that arrive late. */
  callsByIndex: Record<number, CardId>;
  current: CurrentCall | null;
  /** True once the host closed the current call window. */
  currentClosed: boolean;
  /** Wrong choices already tried for the current call (max 2 picks per call). */
  wrong: CardId[];
  /** Picks sent for the current call that the host has not answered yet. */
  pickPending: boolean;
  /** I already got the current call right. */
  solved: boolean;
  feedback: Feedback;
  /** Cards whose call has closed: their word is revealed on the board. */
  revealed: CardId[];
  /** Cards crossed off (frijolito): called cards that are on my tabla. */
  crossed: CardId[];
  /** Points from the host's scores message, per seat. */
  points: Record<string, number>;
  /** Squares crossed per seat, from the host's scores message. */
  crossedBy: Record<string, number>;
  /** Points earned from my own pickResults, used until `scores` arrives. */
  myPoints: number;
  ended: { winners: string[]; wonByMe: boolean; dismissed: boolean } | null;
}

export type PlayerAction =
  | { type: 'round'; round: RoundInfo }
  | { type: 'assign'; tablaIndex: number; roundNo: number; closed?: CardId[] }
  | { type: 'call'; cardId: CardId; choices: [CardId, CardId, CardId]; i: number; now: number }
  | { type: 'pick'; cardId: CardId }
  | {
      type: 'pickResult';
      roundNo: number;
      i: number;
      correct: boolean;
      points: number;
      first: boolean;
    }
  | { type: 'callClosed'; roundNo: number; i: number }
  | {
      type: 'scores';
      roundNo: number;
      points: Record<string, number>;
      crossed?: Record<string, number>;
    }
  | { type: 'dismissEnded' }
  | { type: 'end'; roundNo: number; winners: string[]; seat: string };

export const initialPlayerState: PlayerState = {
  round: null,
  assign: null,
  board: [],
  callsByIndex: {},
  current: null,
  currentClosed: false,
  wrong: [],
  pickPending: false,
  solved: false,
  feedback: null,
  revealed: [],
  crossed: [],
  points: {},
  crossedBy: {},
  myPoints: 0,
  ended: null,
};

export function makeBoard(seed: string, tablaIndex: number, grid = 4): CardId[] {
  return tabla(seed, tablaIndex, cards, grid).cards;
}

const add = (list: CardId[], id: CardId) => (list.includes(id) ? list : [...list, id]);

/** Build the board and restore closed calls once round and assignment agree. */
function withBoard(s: PlayerState): PlayerState {
  if (!s.round || !s.assign || s.assign.roundNo !== s.round.roundNo) return s;
  const board =
    s.board.length > 0
      ? s.board
      : makeBoard(s.round.roomSeed, s.assign.tablaIndex, s.round.gridSize);
  const revealed = [...new Set([...s.revealed, ...(s.assign.closed ?? [])])];
  const currentClosed = s.currentClosed || !!(s.current && revealed.includes(s.current.cardId));
  return {
    ...s,
    board,
    revealed,
    crossed: board.filter((id) => revealed.includes(id)),
    currentClosed,
    pickPending: currentClosed ? false : s.pickPending,
  };
}

/** Close the call at index i: reveal its word and cross it off if it is on my tabla. */
function close(s: PlayerState, cardId: CardId, isCurrent: boolean): PlayerState {
  return {
    ...s,
    revealed: add(s.revealed, cardId),
    crossed: s.board.includes(cardId) ? add(s.crossed, cardId) : s.crossed,
    currentClosed: isCurrent ? true : s.currentClosed,
    pickPending: isCurrent ? false : s.pickPending,
  };
}

/** True when every square is crossed. */
export function fullCard(s: Pick<PlayerState, 'board' | 'crossed'>): boolean {
  return s.board.length >= 9 && s.board.every((id) => s.crossed.includes(id));
}

export function playerReducer(s: PlayerState, a: PlayerAction): PlayerState {
  switch (a.type) {
    case 'round': {
      const same =
        s.round && s.round.roundNo === a.round.roundNo && s.round.roomSeed === a.round.roomSeed;
      if (same && (s.round?.gridSize ?? 4) !== (a.round.gridSize ?? 4))
        return withBoard({ ...s, round: a.round, board: [], crossed: [] });
      if (same) return withBoard({ ...s, round: a.round });
      return withBoard({
        ...initialPlayerState,
        assign: s.assign && s.assign.roundNo === a.round.roundNo ? s.assign : null,
        round: a.round,
      });
    }
    case 'assign': {
      if (s.round && s.round.roundNo !== a.roundNo) return s;
      const same =
        s.assign && s.assign.roundNo === a.roundNo && s.assign.tablaIndex === a.tablaIndex;
      // Merge snapshots: a delayed resend must not erase calls already closed locally.
      const closed = [...new Set([...(same ? (s.assign?.closed ?? []) : []), ...(a.closed ?? [])])];
      return withBoard({
        ...s,
        assign: { tablaIndex: a.tablaIndex, roundNo: a.roundNo, closed },
        board: same ? s.board : [],
      });
    }
    case 'call': {
      if (!s.round) return s;
      // Hello/repeat broadcasts resend the current call to everyone. Keep its progress.
      if (s.current && a.i <= s.current.i) return s;
      // A new call implicitly closes the previous one (in case callClosed was missed).
      const prev = s.current && !s.currentClosed ? close(s, s.current.cardId, true) : s;
      return {
        ...prev,
        callsByIndex: { ...prev.callsByIndex, [a.i]: a.cardId },
        current: { cardId: a.cardId, choices: a.choices, i: a.i, receivedAt: a.now },
        currentClosed: prev.revealed.includes(a.cardId),
        wrong: [],
        pickPending: false,
        solved: false,
        feedback: null,
      };
    }
    case 'pick': {
      const c = s.current;
      if (!c || s.currentClosed || s.solved || s.pickPending) return s;
      if (s.wrong.length + 1 > 2) return s;
      // A wrong tap is judged by the host; locally dim it right away (the host's
      // pickResult is what confirms). The right card stays pending until answered.
      if (a.cardId === c.cardId) return { ...s, pickPending: true };
      if (s.wrong.includes(a.cardId)) return s;
      return { ...s, wrong: [...s.wrong, a.cardId], feedback: { kind: 'casi' } };
    }
    case 'pickResult': {
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      const isCurrent = s.current?.i === a.i;
      if (!isCurrent) return s;
      if (!a.correct) return { ...s, pickPending: false, feedback: { kind: 'casi' } };
      const points: 1 | 2 = a.points === 2 ? 2 : 1;
      return {
        ...s,
        pickPending: false,
        solved: true,
        myPoints: s.myPoints + points,
        feedback: { kind: 'ok', points, first: a.first },
      };
    }
    case 'callClosed': {
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      const cardId = s.callsByIndex[a.i];
      if (!cardId) return s;
      return close(s, cardId, s.current?.i === a.i);
    }
    case 'scores':
      if (!s.round || a.roundNo !== s.round.roundNo) return s;
      return { ...s, points: a.points, crossedBy: a.crossed ?? s.crossedBy };
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
