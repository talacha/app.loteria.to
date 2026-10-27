import {
  OTHER_CORRECT_POINTS,
  choicesFor,
  crossedAfterCall,
  deckOrder,
  hashString,
  initialPickState,
  isCardComplete,
  mulberry32,
  resolveFullCardWinners,
  scorePick,
  soloCpuPick,
  tabla,
  type CardId,
  type Category,
  type PickState,
  type Tabla,
} from '@engine';

/** Offline local host for solo mode (rules §1.3): the engine drives the cantor, CPUs and scoring. */

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultySpec {
  accuracy: number;
  /** CPU reaction window in ms [min, max]. */
  reaction: [number, number];
}

export const DIFFICULTY: Record<Difficulty, DifficultySpec> = {
  easy: { accuracy: 0.5, reaction: [2500, 6000] },
  normal: { accuracy: 0.75, reaction: [1500, 4000] },
  hard: { accuracy: 0.9, reaction: [800, 2500] },
};

export const SPEEDS_SEC = [6, 8, 12] as const;
export const MAX_CPUS = 3;
export const HUMAN = 'you';

/** Share of the call window a CPU may use at most (it must pick before the call closes). */
const WINDOW_USE = 0.9;

export interface SoloConfig {
  seed: string;
  cpus: number;
  difficulty: Difficulty;
  /** Seconds between calls. */
  speedSec: number;
  pool: { id: CardId; category: Category }[];
  /** Pairs to keep apart in the three choices (spoken-language dependent). */
  exclude?: (a: CardId, b: CardId) => boolean;
}

export interface CpuPlan {
  correct: boolean;
  /** Elapsed ms in the call at which it answers. */
  atMs: number;
  cardId: CardId;
  done: boolean;
}

export interface ActiveCall {
  i: number;
  cardId: CardId;
  choices: [CardId, CardId, CardId];
  elapsedMs: number;
  plans: Record<string, CpuPlan>;
  /** Wrong choices the human has already tried. */
  humanWrong: CardId[];
  /** Points the human earned on this call. */
  humanPoints: 0 | 1 | 2;
}

export interface SoloState {
  cfg: SoloConfig;
  seats: string[];
  tablas: Record<string, Tabla>;
  order: CardId[];
  called: CardId[];
  crossed: Record<string, CardId[]>;
  pick: PickState;
  /** Order in which picks reach the host (the "at" of scorePick). */
  picksSeen: number;
  call: ActiveCall | null;
  /** Last closed call, for the feedback strip. */
  lastClosed: { i: number; cardId: CardId; humanPoints: 0 | 1 | 2 } | null;
  paused: boolean;
  ended: { winners: string[]; completedOn: number } | null;
}

export const cpuSeat = (n: number): string => `cpu${n}`;
export const isCpu = (seat: string): boolean => seat !== HUMAN;

export function remainingSquares(s: SoloState, seat: string): number {
  return 16 - (s.crossed[seat]?.length ?? 0);
}

function cpuPlan(
  s: SoloState,
  i: number,
  seat: string,
  cardId: CardId,
  choices: CardId[],
): CpuPlan {
  const spec = DIFFICULTY[s.cfg.difficulty];
  const rng = mulberry32(hashString(`solo|${s.cfg.seed}|${i}|${seat}`));
  const decision = soloCpuPick({ accuracy: spec.accuracy, rng });
  const windowMs = s.cfg.speedSec * 1000;
  const [lo, hi] = spec.reaction;
  const reaction = lo + rng() * (hi - lo);
  const atMs = Math.round(Math.min(reaction, windowMs * WINDOW_USE));
  const wrongs = choices.filter((c) => c !== cardId);
  const wrong = wrongs[Math.floor(rng() * wrongs.length)] ?? cardId;
  return {
    correct: decision.correct,
    atMs,
    cardId: decision.correct ? cardId : wrong,
    done: false,
  };
}

export function createSolo(cfg: SoloConfig): SoloState {
  const cpus = Math.min(MAX_CPUS, Math.max(1, Math.round(cfg.cpus)));
  const seats = [HUMAN, ...Array.from({ length: cpus }, (_, k) => cpuSeat(k + 1))];
  const tablas: Record<string, Tabla> = {};
  seats.forEach((seat, idx) => {
    tablas[seat] = tabla(cfg.seed, idx, cfg.pool);
  });
  const crossed: Record<string, CardId[]> = {};
  for (const seat of seats) crossed[seat] = [];
  const s: SoloState = {
    cfg: { ...cfg, cpus },
    seats,
    tablas,
    order: deckOrder(
      cfg.seed,
      1,
      cfg.pool.map((c) => c.id),
    ),
    called: [],
    crossed,
    pick: initialPickState(),
    picksSeen: 0,
    call: null,
    lastClosed: null,
    paused: false,
    ended: null,
  };
  return beginCall(s);
}

/** Draw the next card (the automatic cantor). */
export function beginCall(s: SoloState): SoloState {
  if (s.ended) return s;
  const i = s.called.length;
  const cardId = s.order[i];
  if (cardId === undefined) return s;
  const choices = choicesFor(s.cfg.seed, 1, i, cardId, s.cfg.pool, s.cfg.exclude);
  const plans: Record<string, CpuPlan> = {};
  for (const seat of s.seats) if (isCpu(seat)) plans[seat] = cpuPlan(s, i, seat, cardId, choices);
  return {
    ...s,
    call: { i, cardId, choices, elapsedMs: 0, plans, humanWrong: [], humanPoints: 0 },
  };
}

function applyPick(
  s: SoloState,
  seat: string,
  cardId: CardId,
): { s: SoloState; points: 0 | 1 | 2 } {
  const call = s.call;
  if (!call) return { s, points: 0 };
  const { state, result } = scorePick(
    s.pick,
    { seat, i: call.i, cardId, at: s.picksSeen },
    { i: call.i, cardId: call.cardId },
  );
  return { s: { ...s, pick: state, picksSeen: s.picksSeen + 1 }, points: result.points };
}

/** The human taps a spelling choice. Up to two tries per call (rules §5.3). */
export function humanPick(s: SoloState, cardId: CardId): { s: SoloState; correct: boolean } {
  const call = s.call;
  if (!call || s.ended || s.paused || call.humanPoints > 0 || call.humanWrong.length >= 2) {
    return { s, correct: false };
  }
  if (call.humanWrong.includes(cardId)) return { s, correct: false };
  const { s: next, points } = applyPick(s, HUMAN, cardId);
  const correct = cardId === call.cardId;
  const nc: ActiveCall = correct
    ? { ...call, humanPoints: points || (OTHER_CORRECT_POINTS as 1) }
    : { ...call, humanWrong: [...call.humanWrong, cardId] };
  return { s: { ...next, call: nc }, correct };
}

/** Close the call: everyone with the card on the tabla crosses it (§6), then check §7. */
export function closeCall(s: SoloState): SoloState {
  const call = s.call;
  if (!call) return s;
  const called = [...s.called, call.cardId];
  const crossed: Record<string, CardId[]> = {};
  for (const seat of s.seats) crossed[seat] = crossedAfterCall(s.tablas[seat] as Tabla, called);
  const completed = s.seats.filter((seat) =>
    isCardComplete(s.tablas[seat] as Tabla, crossed[seat] ?? []),
  );
  const base: SoloState = {
    ...s,
    called,
    crossed,
    call: null,
    lastClosed: { i: call.i, cardId: call.cardId, humanPoints: call.humanPoints },
  };
  if (completed.length > 0) {
    return {
      ...base,
      ended: { winners: resolveFullCardWinners(completed, s.pick.points), completedOn: call.i },
    };
  }
  return beginCall(base);
}

/** Advance the clock by `dtMs` (ignored while paused or ended). Fires CPU picks and closes the call. */
export function tick(s: SoloState, dtMs: number): SoloState {
  let cur = s;
  let left = dtMs;
  while (left > 0 && cur.call && !cur.ended && !cur.paused) {
    const call = cur.call;
    const windowMs = cur.cfg.speedSec * 1000;
    const step = Math.min(left, windowMs - call.elapsedMs);
    const elapsed = call.elapsedMs + step;
    left -= step;
    // Fire CPU picks due by `elapsed`, earliest first (arrival order decides "first").
    const due = Object.entries(call.plans)
      .filter(([, p]) => !p.done && (p.atMs <= elapsed || elapsed >= windowMs))
      .sort((a, b) => a[1].atMs - b[1].atMs || (a[0] < b[0] ? -1 : 1));
    let next: SoloState = { ...cur, call: { ...call, elapsedMs: elapsed } };
    for (const [seat, plan] of due) {
      next = applyPick(next, seat, plan.cardId).s;
      const c = next.call as ActiveCall;
      next = { ...next, call: { ...c, plans: { ...c.plans, [seat]: { ...plan, done: true } } } };
    }
    cur = next;
    if (elapsed >= windowMs) cur = closeCall(cur);
  }
  return cur;
}

export const setPaused = (s: SoloState, paused: boolean): SoloState => ({ ...s, paused });
export const setSpeed = (s: SoloState, speedSec: number): SoloState => ({
  ...s,
  cfg: { ...s.cfg, speedSec },
});
