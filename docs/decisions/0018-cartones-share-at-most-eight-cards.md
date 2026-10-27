# 0018. Cartones in a room share at most 8 cards

- **Status:** Accepted
- **Date:** 2026-10-26 (`5fe7f6c`, `8635d89`)

## Context

With 16 of 54 cards per cartón, random deals can produce near-identical cartones, which makes ties likely and rounds dull. The rule caps overlap at 8.

## Decision

- Each cartón is `tabla(seed, index)`: 16 distinct cards, at most 5 per category, deterministic for a given seed and index.
- The host assigns indices with `pickTablaIndex`, skipping any index whose cartón shares more than 8 cards with one already dealt in the room.

## Consequences

- Every device can rebuild any cartón from `(seed, index)`; nothing but the index goes on the wire.
- The cap is comfortable at 20 players; much larger rooms would need a looser cap or a smarter search.
