# 0014. Deploy gate and rollback policy

- **Status:** Accepted
- **Date:** 2026-10-26 (`0cc8240`, `b43e3fc`)

## Context

A merge once broke `main` and production had to be rolled back to the last verified commit (`91edf9f`). Several people and tools edit the tree at once, so a local green run can include uncommitted files.

## Decision

- Vercel's build command is `pnpm check && pnpm build`: lint, typecheck, unit tests, content validation and copy lint must pass or the deploy fails. CI runs the same plus Playwright.
- A commit is verified in a **clean worktree** (only committed files) before it is pushed to `main`. Run `pnpm verify:release`: it requires a clean checkout, runs `check`, `design-lint`, `build`, `e2e` and `test:replay-storage`, then rejects generated-file drift.
- When production breaks, roll back first with `vercel promote <last-good-deployment>` (instant, no rebuild), then fix forward or revert on `main`.

## Consequences

- A broken check blocks a deploy instead of reaching players.
- Files Vercel needs for checks (e.g. `tests/`) must be uploaded, not ignored (`5a168f4`).
- e2e is part of the clean-worktree release verification and CI, not the Vercel build command. Direct CLI deployments must follow release verification; Vercel alone cannot enforce this local procedure.
