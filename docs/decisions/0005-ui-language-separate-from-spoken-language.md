# 0005. Per-player app language separate from spoken language

- **Status:** Accepted
- **Date:** 2026-10-26 (`e647bf3`, `f433899`)

## Context

A Spanish speaker practising Náhuatl needs menus they understand and a cantor in the language they are learning. César proposed two content languages ("Escucho" / "Entiendo").

## Decision

- Each player sets two independent languages, changeable at any time without losing cartón, crossed squares or points:
  - **App language** (es, en): menus, buttons, messages.
  - **Spoken language** (nah, yua, quz, es, en): the voice, the three spelling choices and the words revealed on the cartón.
- The host sends card ids, never words; each device renders in its own spoken language.
- Both settings live in one shared `LanguageSettings` component (home, lobby, in-game sheet).

## Consequences

- Five spoken languages share one room with no extra traffic.
- A gloss in the app language after the reveal is a possible later addition.
