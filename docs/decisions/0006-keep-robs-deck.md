# 0006. Keep Rob's deck; César's catalogue is archived

- **Status:** Accepted
- **Date:** 2026-10-26 (`43b560c`, `1840dba`)

## Context

Two 54-card decks existed. César's (`8c96117`, `catalogo.md`) cited a dictionary URL for every Indigenous word and came with 162 MMS clips, but 31 of its ids had no illustrated art. Rob's deck was already wired to art, engine and screens.

## Decision

- `src/content/cards.json` (Rob's deck) is the deck. Six categories, 54 cards, no people.
- César's `catalogo.md` and his research are kept in `docs/archive/` as reference. His clips for ids that are not in our deck stay unused.
- Clips for shared ids were regenerated from `cards.json` so the voice says our word.

## Consequences

- Art, audio and engine stay consistent.
- Our Indigenous names do not carry César's dictionary citations (see 0007, backlog DEC-001).
- 93 orphan clips remain in `public/audio` and are precached (backlog DEBT-004).
