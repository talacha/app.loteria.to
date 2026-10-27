# 0015. Signed commits

- **Status:** Open (owner decision pending; backlog DEC-004)
- **Date:** 2026-10-26

## Context

Rob's commits are signed (`%G? = G`). César's commits (`8135c2f`, `8c96117`, `7da8660`, `b8ba34e`, `05485ef`, `b464c5e`) are unsigned. `main` has no branch protection.

## What happened

- `43b560c` replayed Rob's work signed and left César's unsigned files out (deck, MMS clips, catalogue, plan docs); only `reglas.md` was kept.
- César later pushed the audio and catalogue again, still unsigned (`7da8660`), and they remain in history.

## Options

- **A.** Accept unsigned commits from César and stop removing them.
- **B.** César sets up commit signing before his next push; then require signed commits on `main` via branch protection.

## Consequences

Until decided, history mixes signed and unsigned commits and there is no enforcement either way.
