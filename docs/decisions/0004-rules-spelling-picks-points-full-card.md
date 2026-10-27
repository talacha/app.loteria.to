# 0004. Rules v2: spelling picks, 2/1 points, full-card win

- **Status:** Accepted
- **Date:** 2026-10-26 (`278728f`, `af072a0`)

## Context

Two rule sets existed: tap-to-mark on the tabla with several figures, all simultaneous claims valid and no points, versus a learning-first design. The product's first pillar is learning languages by playing.

## Decision

- Every player picks the called card's **spelling** from three choices in their spoken language, whether or not the card is on their cartón; crossing off is **automatic** for everyone who holds the card.
- **2 points** for the first correct pick, **1** for every other correct pick, 0 otherwise; points live for one round and only break ties.
- **Full cartón** (16/16) is the only win; ties on the same call go to more points; equal points share.
- No manual "next"; the cantor is automatic. "Otra ronda" deals new cartones.
- [rules.md](../rules.md) is the single rules contract.
- "First" is strict arrival order at the host (`src/engine/scoring.ts`); there is no latency-compensation window. See [0019](0019-first-pick-is-arrival-order.md).

## Consequences

- The pick is the language exercise; no one can "miss" a card on their cartón.
- Figures can return later as an organiser option without breaking anything (backlog FEAT-003).
