import type { CardId, Tabla } from './types';

export const FIRST_CORRECT_POINTS = 2;
export const OTHER_CORRECT_POINTS = 1;
export const MAX_PICKS_PER_CALL = 2;
export const ROOM_MIN_PLAYERS = 2;
export const ROOM_MAX_PLAYERS = 20;

export interface PickState {
  /** seat -> total points */
  points: Record<string, number>;
  /** call index -> seat that was first correct */
  firstByCall: Record<number, string>;
  /** call index -> seat -> points earned on that call (a seat scores at most once per call) */
  scored: Record<number, Record<string, number>>;
  /** call index -> seat -> picks used (max 2) */
  picks: Record<number, Record<string, number>>;
}

export const initialPickState = (): PickState => ({
  points: {},
  firstByCall: {},
  scored: {},
  picks: {},
});

export interface PickResult {
  seat: string;
  i: number;
  correct: boolean;
  points: 0 | 1 | 2;
  first: boolean;
}

/**
 * Pure reducer (rules §5). First correct pick of a call = 2, other correct = 1, wrong = 0.
 * At most 2 picks per seat per call; a seat scores at most once per call; replays are idempotent.
 * "First" is decided by the order picks are fed in.
 */
export function scorePick(
  state: PickState,
  pick: { seat: string; i: number; cardId: CardId; at?: number },
  call: { i: number; cardId: CardId },
): { state: PickState; result: PickResult } {
  const { seat, i } = pick;
  const none: PickResult = { seat, i, correct: false, points: 0, first: false };
  if (pick.i !== call.i) return { state, result: none };
  const earned = state.scored[i]?.[seat];
  if (earned !== undefined) {
    return {
      state,
      result: {
        seat,
        i,
        correct: true,
        points: earned as 1 | 2,
        first: state.firstByCall[i] === seat,
      },
    };
  }
  const used = state.picks[i]?.[seat] ?? 0;
  if (used >= MAX_PICKS_PER_CALL) return { state, result: none };
  const picks = { ...state.picks, [i]: { ...state.picks[i], [seat]: used + 1 } };
  if (pick.cardId !== call.cardId) return { state: { ...state, picks }, result: none };
  const first = state.firstByCall[i] === undefined;
  const points = first ? FIRST_CORRECT_POINTS : OTHER_CORRECT_POINTS;
  return {
    state: {
      points: { ...state.points, [seat]: (state.points[seat] ?? 0) + points },
      firstByCall: first ? { ...state.firstByCall, [i]: seat } : state.firstByCall,
      scored: { ...state.scored, [i]: { ...state.scored[i], [seat]: points } },
      picks,
    },
    result: { seat, i, correct: true, points, first },
  };
}

/** Highest points win; equal points share. */
export function resolveWinners(claims: { seat: string; points: number }[]): string[] {
  if (claims.length === 0) return [];
  const max = Math.max(...claims.map((c) => c.points));
  return [...new Set(claims.filter((c) => c.points === max).map((c) => c.seat))];
}

/** §6: cards of `tabla` that have been called (everyone crosses at callClosed, picks irrelevant). */
export function crossedAfterCall(tabla: Tabla, calledIds: readonly CardId[]): CardId[] {
  const called = new Set(calledIds);
  return tabla.cards.filter((c) => called.has(c));
}

/** §7: all g x g squares crossed (the cartón must be a whole 3x3..8x8). */
export function isCardComplete(tabla: Tabla, crossed: readonly CardId[]): boolean {
  const n = tabla.cards.length;
  const g = Math.round(Math.sqrt(n));
  if (g * g !== n || g < 3 || g > 8) return false;
  const set = new Set(crossed);
  return tabla.cards.every((c) => set.has(c));
}

/** §7.2: among seats that completed on the same call, highest points win; ties share. */
export function resolveFullCardWinners(
  completedSeats: readonly string[],
  points: Record<string, number>,
): string[] {
  return resolveWinners(
    [...new Set(completedSeats)].map((seat) => ({ seat, points: points[seat] ?? 0 })),
  );
}

/** Decide how a solo CPU answers a call: right/wrong and how far into the call window (0..1). */
export function soloCpuPick(opts: { accuracy: number; rng: () => number }): {
  correct: boolean;
  delayFrac: number;
  delayMs: (windowMs: number) => number;
} {
  const correct = opts.rng() < Math.min(1, Math.max(0, opts.accuracy));
  const delayFrac = 0.15 + 0.7 * opts.rng();
  return { correct, delayFrac, delayMs: (windowMs) => Math.round(delayFrac * windowMs) };
}
