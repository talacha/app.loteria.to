# Lotería de los Pueblos (app.loteria.to)

## Sources of truth (in order)

1. `docs/reglas.md` — game behaviour (`R-xx`). Owner decision 2026-10-26: César's rules and deck.
2. `docs/plan/00-SHARED.md` — code contracts (engine §2, content §3, network §4) and ownership. Plans: `docs/plan/CESAR.md`, `docs/plan/ROB.md`.
3. `docs/catalogo.md` — deck and figures.
4. `docs/DESIGN.md` + `design/tokens.json` + `docs/design/look-and-feel.pdf` — **how everything looks. Binding.** Claude Design canvas: https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc (read with the Artifact tool `action: "read"`; mirror in `design/look-and-feel/project/`). Only the orchestrator republishes it.
5. `docs/PRD.md` (product pillars §0), `docs/ARCHITECTURE.md`, `docs/PLATFORM.md`.

## Rules for every agent

- **Ownership** (00-SHARED §1): `src/engine/**`, `src/content/**`, `public/audio/**`, `scripts/copy-lint.ts`, `docs/reglas.md`, `docs/catalogo.md` belong to the game owner; everything else to the app owner. Stay inside the paths you were assigned.
- **Game logic lives only in `src/engine`**, each rule tested by its `R-xx`. UI never re-implements a rule.
- **Design is enforced:** use only tokens from `design/tokens.json` (via CSS variables in `src/app/theme/tokens.css`) and build screens from `src/app/ui/` components. `pnpm design-lint` (in `pnpm check`) rejects raw colours, fonts, radii and shadows.
- Never invent Indigenous-language words; every shown word comes from `src/content/cards.json` with its source and review label (AI voice per reglas D1).
- `pnpm check` must pass; `pnpm e2e` for flows. Don't `pnpm add` or commit unless told to; the orchestrator verifies, commits to `main`, pushes and deploys.
