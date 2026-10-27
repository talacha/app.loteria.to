# 0006. Keep the current deck

- **Status:** Accepted
- **Date:** 2026-10-26 (`43b560c`, `1840dba`)

## Context

Two 54-card decks existed. One cited a dictionary URL for every Indigenous word and came with 162 MMS clips, but 31 of its ids had no illustrated art. The other was already wired to art, engine and screens.

## Decision

- `src/content/cards.json` is the deck. Six categories, 54 cards, no people.
- Clips for shared ids were regenerated from `cards.json` so the voice says our word.
- Clips for ids that are not in the deck stay unused.

## Consequences

- Art, audio and engine stay consistent.
- Our Indigenous names do not yet carry dictionary citations (see 0007, backlog DEBT-014).
- 93 orphan clips remain in `public/audio` and are precached (backlog DEBT-004).
