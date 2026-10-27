# 0017. No prize, betting or winning words; neutral copy

- **Status:** Accepted (enforcement incomplete, backlog BUG-002, BUG-003)
- **Date:** 2026-10-26 (`f433899`, `0cc8240`)

## Context

Lotería is often played for money or prizes. This product is for families and learners, and the cards, copy and roles must not exclude anyone.

## Decision

- Screens never use ganar, premio, apuesta, dinero, fichas, bingo, win, prize, bet, money, chips; the game says "¡Lotería!", "completaste" and "frijoles" (rules §9.5).
- No gendered human roles in Spanish copy ("quien juega", "las personas"); no generic he/she in English.
- "El cantor" is allowed because the cantor is the automatic voice, not a person.
- `scripts/copy-lint.ts` enforces this in `pnpm check`.

## Consequences

- Copy reads neutral in both app languages.
- The lint must keep pace with the rule's list (it does not yet ban "bingo"), and its allowlist must not exempt copy the rules forbid.
