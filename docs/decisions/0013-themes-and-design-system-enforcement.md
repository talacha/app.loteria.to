# 0013. Light/dark/high-contrast themes, enforced by tokens and lints

- **Status:** Accepted
- **Date:** 2026-10-26 (`74282b2`, `7b2301b`, `f433899`, `3673c04`, `1138936`)

## Context

The game is played on projectors in bright rooms, phones at night and by people with low vision. Many agents built screens in parallel, which invites one-off colours and off-brand copy.

## Decision

- "Feria de noche" design system: tokens in `design/tokens.json`, CSS variables in `src/app/theme/tokens.css`, shared components in `src/app/ui/`. Binding spec: [DESIGN.md](../DESIGN.md).
- Themes **auto, light, dark, high-contrast**, chosen in the shell and stored per device.
- `pnpm design-lint` rejects raw colours, fonts, radii and shadows, and text colours that ignore the theme (`theme-text-on-ground`).
- `pnpm copy-lint` (part of `pnpm check`) rejects gendered human roles and prize/betting/money framing.
- Contrast: text ≥ 4.5:1, controls and focus ring ≥ 3:1 in every theme; state never shown by colour alone.

## Consequences

- Screens stay consistent across agents and themes.
- Token parity gaps and lint gaps are tracked in the backlog (DEBT-007…DEBT-010, BUG-002).
