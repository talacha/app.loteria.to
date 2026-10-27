import { describe, expect, it } from 'vitest';
import { cards } from '@content';
import { resolveFullCardWinners } from '@engine';
import {
  DIFFICULTY,
  HUMAN,
  closeCall,
  createSolo,
  humanPick,
  remainingSquares,
  setPaused,
  tick,
  type Difficulty,
  type SoloState,
} from './soloEngine';

const pool = cards.map((c) => ({ id: c.id, category: c.category }));
const mk = (seed: string, difficulty: Difficulty = 'normal', cpus = 2, speedSec = 8) =>
  createSolo({ seed, cpus, difficulty, speedSec, pool });

function playOut(s0: SoloState, human: 'perfect' | 'none'): SoloState {
  let s = s0;
  for (let guard = 0; guard < 1000 && !s.ended; guard++) {
    if (human === 'perfect' && s.call) s = humanPick(s, s.call.cardId).s;
    s = tick(s, 1000);
  }
  return s;
}

describe('solo CPU decisions', () => {
  it('are deterministic for a seed', () => {
    const a = mk('seed-a');
    const b = mk('seed-a');
    expect(a.call?.plans).toEqual(b.call?.plans);
    expect(a.tablas).toEqual(b.tablas);
    expect(mk('seed-b').call?.plans).not.toEqual(a.call?.plans);
  });

  it('respect the reaction window of each difficulty', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      let s = mk(`react-${d}`, d, 3);
      const [lo, hi] = DIFFICULTY[d].reaction;
      for (let k = 0; k < 20 && s.call; k++) {
        for (const p of Object.values(s.call.plans)) {
          expect(p.atMs).toBeGreaterThanOrEqual(lo);
          expect(p.atMs).toBeLessThanOrEqual(hi);
        }
        s = closeCall(s);
      }
    }
  });

  it('hits roughly the configured accuracy', () => {
    for (const d of ['easy', 'hard'] as const) {
      let s = mk(`acc-${d}`, d, 3, 12);
      let right = 0;
      let n = 0;
      while (!s.ended) {
        for (const p of Object.values(s.call?.plans ?? {})) {
          n++;
          if (p.correct) right++;
        }
        s = closeCall(s);
      }
      expect(Math.abs(right / n - DIFFICULTY[d].accuracy)).toBeLessThan(0.15);
    }
  });
});

describe('solo round', () => {
  it('completes with a winner, crossing every called card for everyone', () => {
    const s = playOut(mk('round-1'), 'none');
    expect(s.ended).not.toBeNull();
    expect(s.ended?.winners.length).toBeGreaterThan(0);
    for (const seat of s.seats) {
      const t = s.tablas[seat];
      expect(t?.cards.filter((c) => s.called.includes(c))).toEqual(s.crossed[seat]);
    }
    const winner = s.ended?.winners[0] as string;
    expect(s.crossed[winner]).toHaveLength(16);
  });

  it('scores 2 for the first correct pick and 1 for the next', () => {
    let s = mk('score-1', 'hard', 1);
    const call = s.call!;
    const plan = Object.values(call.plans)[0]!;
    // Human answers before the CPU can: first = 2 points.
    s = humanPick(s, call.cardId).s;
    expect(s.pick.points[HUMAN]).toBe(2);
    s = tick(s, plan.atMs + 1);
    if (plan.correct) expect(s.pick.points['cpu1']).toBe(1);
  });

  it('gives a second try: wrong scores 0, then 1 point when a CPU was first', () => {
    let s = mk('score-2', 'hard', 1);
    const call = s.call!;
    const plan = call.plans['cpu1']!;
    s = tick(s, plan.atMs + 1);
    const wrong = call.choices.find((c) => c !== call.cardId)!;
    s = humanPick(s, wrong).s;
    expect(s.pick.points[HUMAN] ?? 0).toBe(0);
    s = humanPick(s, call.cardId).s;
    expect(s.pick.points[HUMAN]).toBe(plan.correct ? 1 : 2);
    // No third try.
    const again = humanPick(s, wrong);
    expect(again.s.pick.points[HUMAN]).toBe(s.pick.points[HUMAN]);
  });

  it('does not advance while paused', () => {
    let s = setPaused(mk('pause'), true);
    s = tick(s, 20000);
    expect(s.call?.elapsedMs).toBe(0);
    expect(s.called).toHaveLength(0);
  });

  it('breaks same-call completions by points (equal points share)', () => {
    expect(resolveFullCardWinners(['you', 'cpu1'], { you: 10, cpu1: 12 })).toEqual(['cpu1']);
    expect(resolveFullCardWinners(['you', 'cpu1'], { you: 12, cpu1: 12 }).sort()).toEqual([
      'cpu1',
      'you',
    ]);
  });

  it('applies the points tie-break when two tablas complete on the same call', () => {
    const base = mk('tie', 'normal', 1);
    // Force both tablas to hold the same 16 cards, so they complete together.
    const same = base.tablas[HUMAN]!;
    let s: SoloState = { ...base, tablas: { [HUMAN]: same, cpu1: { ...same, index: 9 } } };
    s = { ...s, pick: { ...s.pick, points: { [HUMAN]: 5, cpu1: 7 } } };
    // (no picks are made: the human and the CPU plans are empty)
    // Call all 16 tabla cards first, then the rest of the deck is irrelevant.
    s = { ...s, order: [...same.cards, ...s.order.filter((c) => !same.cards.includes(c))] };
    s = { ...s, call: null };
    s = playOutFrom(s);
    expect(s.pick.points[HUMAN]).toBe(5);
    expect(s.ended?.winners).toEqual(['cpu1']);
    expect(s.ended?.completedOn).toBe(15);
  });
});

function playOutFrom(s0: SoloState): SoloState {
  // beginCall via a zero-length close of a synthetic state: use createSolo's own begin by ticking.
  let s = s0;
  const first = s.order[0]!;
  s = {
    ...s,
    call: {
      i: 0,
      cardId: first,
      choices: [first, s.order[1]!, s.order[2]!],
      elapsedMs: 0,
      plans: {},
      humanWrong: [],
      humanPoints: 0,
    },
  };
  for (let g = 0; g < 400 && !s.ended; g++) s = tick(s, 1000);
  return s;
}

describe('solo grid sizes and the only end of a game', () => {
  it.each([3, 4, 5])('deals %i x %i cartones and ends only on a full card', (g) => {
    const s0 = createSolo({
      seed: `grid-${g}`,
      cpus: 2,
      difficulty: 'normal',
      speedSec: 8,
      pool,
      grid: g,
    });
    for (const seat of s0.seats) expect(s0.tablas[seat]!.cards).toHaveLength(g * g);
    expect(remainingSquares(s0, HUMAN)).toBe(g * g);
    let s = s0;
    for (let guard = 0; guard < 1000 && !s.ended; guard++) {
      s = tick(s, 1000);
      if (!s.ended) {
        // Not over while nobody has crossed every square.
        for (const seat of s.seats) expect(remainingSquares(s, seat)).toBeGreaterThan(0);
      }
    }
    expect(s.ended).not.toBeNull();
    expect(s.ended!.completedOn).toBeLessThan(s.order.length);
    expect(s.seats.some((seat) => remainingSquares(s, seat) === 0)).toBe(true);
    expect(s.ended!.winners.every((w) => remainingSquares(s, w) === 0)).toBe(true);
  });
});
