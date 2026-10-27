# 0014. Deploy gate and rollback policy

- **Status:** Accepted
- **Date:** 2026-10-26 (`0cc8240`, `b43e3fc`)

## Context

On build day a merge broke `main` and production had to be rolled back to the last verified commit (`91edf9f`). Several agents edit the tree at once, so a local green run can include uncommitted files.

## Decision

- Vercel's build command is `pnpm check && pnpm build`: lint, typecheck, unit tests, content validation and copy lint must pass or the deploy fails. CI runs the same plus Playwright.
- The orchestrator verifies a commit in a **clean worktree** (only committed files) before pushing to `main`.
- When production breaks, roll back first with `vercel promote <last-good-deployment>` (instant, no rebuild), then fix forward or revert on `main`.

## Consequences

- A broken check blocks a deploy instead of reaching players.
- Files Vercel needs for checks (e.g. `tests/`) must be uploaded, not ignored (`5a168f4`).
- e2e is not part of the Vercel gate; a broken e2e suite does not block deploys (backlog BUG-001).
