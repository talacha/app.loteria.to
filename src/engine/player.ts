import type { CardId, Tabla } from './types';

export interface TapInput {
  mode: 'play' | 'practice';
  tabla: Tabla;
  called: CardId[];
  current: CardId | null;
  marks: CardId[];
  cardId: CardId;
  attempts: number;
}
export interface TapResult {
  mark: boolean;
  feedback: null | 'ok' | 'late' | 'wrong';
  attempts: number;
  reveal?: CardId | 'not-in-tabla';
}

export const MAX_ATTEMPTS = 3;

function revealFor(i: Pick<TapInput, 'tabla' | 'current'>): CardId | 'not-in-tabla' {
  return i.current !== null && i.tabla.cards.includes(i.current) ? i.current : 'not-in-tabla';
}

function wrong(i: Omit<TapInput, 'cardId'>): TapResult {
  const attempts = i.attempts + 1;
  return attempts >= MAX_ATTEMPTS
    ? { mark: false, feedback: 'wrong', attempts, reveal: revealFor(i) }
    : { mark: false, feedback: 'wrong', attempts };
}

/** R-38 (Jugar: free marking) and R-39 (Practicar: immediate feedback). */
export function evaluateTap(i: TapInput): TapResult {
  if (i.mode === 'play') return { mark: true, feedback: null, attempts: i.attempts };
  if (!i.called.includes(i.cardId)) return wrong(i);
  return { mark: true, feedback: i.cardId === i.current ? 'ok' : 'late', attempts: i.attempts };
}

/** R-39.4 "No la tengo". */
export function evaluateNotInTabla(i: Omit<TapInput, 'cardId'>): TapResult {
  if (i.mode === 'play' || i.current === null)
    return { mark: false, feedback: null, attempts: i.attempts };
  if (!i.tabla.cards.includes(i.current))
    return { mark: false, feedback: 'ok', attempts: i.attempts };
  return wrong(i);
}

export interface PracticeEvent {
  cardId: CardId;
  firstTry: boolean;
  helped: boolean;
}

/** R-41.1. Counts distinct cards; a card is first-try if its first event was. */
export function practiceSummary(log: PracticeEvent[]): {
  heard: number;
  firstTry: number;
  review: CardId[];
} {
  const first = new Map<CardId, PracticeEvent>();
  const review: CardId[] = [];
  for (const e of log) {
    if (!first.has(e.cardId)) first.set(e.cardId, e);
    if (e.helped && !review.includes(e.cardId)) review.push(e.cardId);
  }
  let firstTry = 0;
  for (const e of first.values()) if (e.firstTry) firstTry++;
  return { heard: first.size, firstTry, review };
}
