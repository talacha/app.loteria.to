# 0016. rules.md is the single rules contract; protocol and history live elsewhere

- **Status:** Accepted
- **Date:** 2026-10-26 (`3247efd`, `23dd06c`); archive 2026-10-27 (`34ee2ee`)

## Context

On build day agents followed two rule files (`rules.md`, César's `reglas.md`), and `rules.md` mixed game rules, wire protocol and decision history.

## Decision

- [rules.md](../rules.md) states game rules only and wins over every other document on gameplay.
- The wire contract lives in [protocol.md](../protocol.md); decisions live here; work lives in [backlog.md](../backlog.md).
- Build-day documents (`reglas.md`, `catalogo.md`, `rules-open-items.md`, `decisiones-rules-vs-reglas.md`, `PLATFORM.md`, review sheets) are archived in `docs/archive/` and are not binding.

## Consequences

- Rule changes go through rules.md plus a decision record.
- Some files still point at old paths (backlog DEBT-011).
