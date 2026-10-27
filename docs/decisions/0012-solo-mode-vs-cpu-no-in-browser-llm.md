# 0012. Solo mode against computer players; no in-browser language model

- **Status:** Accepted
- **Date:** 2026-10-26 (`5ecc5d1`, `78dd88f`)

## Context

Learners need to practise without gathering a room. The owner asked whether a small language model in the browser could power solo play ([evaluation](../evaluations/solo-mode-slm.md)).

## Decision

- `/solo` runs a full round on one device with no network against one or more computer players. All game rules apply.
- Computer players are seeded rules, not a model: levels Fácil / Normal / Difícil set accuracy (0.5 / 0.75 / 0.9) and reaction time (`src/app/solo/soloEngine.ts`).
- **No in-browser LLM now.** The smallest useful model is ~27× the precache budget, unreliable on iOS Safari, and would invent Náhuatl, Maya and Quechua words. A later experiment could only be opt-in, es/en-only banter behind a flag.

## Consequences

- Solo mode is offline, instant and costs nothing.
- Revisit only if the evaluation's conditions change.
