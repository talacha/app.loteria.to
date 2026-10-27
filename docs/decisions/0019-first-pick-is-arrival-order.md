# 0019. The first correct pick is decided by arrival order at the host

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The 2-point "first" bonus ([0004](0004-rules-spelling-picks-points-full-card.md)) needs a definition. Alternatives were a tolerance window (picks within about 300 ms count as first) or client-reported reaction time.

## Decision

- "First" is the order in which picks reach the host's scorer (`scorePick` in `src/engine/scoring.ts`). No window, no client clocks, which cannot be trusted.

## Consequences

- Simple, deterministic and testable.
- Wi-Fi jitter and the organiser's local seat (see [0011](0011-host-screen-modes.md)) can decide a close call. Points only break ties, so the effect on a round is small.
