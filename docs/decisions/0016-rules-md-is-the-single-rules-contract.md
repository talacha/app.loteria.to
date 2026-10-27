# 0016. rules.md is the single rules contract; protocol and history live elsewhere

- **Status:** Accepted
- **Date:** 2026-10-26 (`3247efd`, `23dd06c`)

## Context

Two rule files existed, and `rules.md` mixed game rules, wire protocol and decision history.

## Decision

- [rules.md](../rules.md) states game rules only and wins over every other document on gameplay.
- The wire contract lives in [protocol.md](../protocol.md); decisions live here; work lives in [backlog.md](../backlog.md).
- Superseded planning documents were removed; git history keeps them.

## Consequences

- Rule changes go through rules.md plus a decision record.
