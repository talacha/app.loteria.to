import type { CardId } from './types';

export const FIRST_CORRECT_POINTS = 2;

export interface PickState {
  points: Record<string, number>;
  /** call index -> seat that was first correct */
  firstByCall: Record<number, string>;
  /** seat -> crossed-out cards */
  crossed: Record<string, CardId[]>;
}

export const initialPickState = (): PickState => ({ points: {}, firstByCall: {}, crossed: {} });

/** Pure reducer. `at` is the host receive-order index (kept for callers; order of calls decides "first"). */
export function scorePick(
  state: PickState,
  pick: { seat: string; i: number; cardId: CardId; at: number },
  call: { i: number; cardId: CardId },
): { state: PickState; result: { seat: string; i: number; correct: boolean; first: boolean } } {
  const { seat, i } = pick;
  const correct = pick.i === call.i && pick.cardId === call.cardId;
  if (!correct) return { state, result: { seat, i, correct: false, first: false } };
  const already = (state.crossed[seat] ?? []).includes(call.cardId);
  if (already) {
    return { state, result: { seat, i, correct: true, first: state.firstByCall[i] === seat } };
  }
  const isFirst = state.firstByCall[i] === undefined;
  const next: PickState = {
    points: {
      ...state.points,
      [seat]: (state.points[seat] ?? 0) + (isFirst ? FIRST_CORRECT_POINTS : 0),
    },
    firstByCall: isFirst ? { ...state.firstByCall, [i]: seat } : state.firstByCall,
    crossed: { ...state.crossed, [seat]: [...(state.crossed[seat] ?? []), call.cardId] },
  };
  return { state: next, result: { seat, i, correct: true, first: isFirst } };
}

/** Highest points win; equal points share. */
export function resolveWinners(claims: { seat: string; points: number }[]): string[] {
  if (claims.length === 0) return [];
  const max = Math.max(...claims.map((c) => c.points));
  return [...new Set(claims.filter((c) => c.points === max).map((c) => c.seat))];
}
