# 0009. Printing is a separate classroom mode, not part of the online game

- **Status:** Accepted
- **Date:** 2026-10-26 (`5ec48d7`, `ddb679d`)

## Context

The first PRD mixed phones, a shared tablet and printed paper boards in one round, with 6-character check codes for paper claims. César's request 5 removed paper from the online game. A "print my cartón" option was tried and cancelled.

## Decision

- The online game is one cartón per phone; it never prints and never accepts paper claims.
- `/print` (PDF cartones built in the browser) remains as a separate **classroom mode** for playing with paper and beans.

## Consequences

- Online rules and screens stay simple.
- Home, SEO and manifest copy that promises paper in the same round must be removed (backlog BUG-004).
- A proper classroom mode (cantor screen for paper only, check codes) is future work.
