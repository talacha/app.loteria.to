# Lotería de los Pueblos (app.loteria.to)

## Sources of truth

- `docs/PRD.md` — product (pillars in §0). `docs/rules.md` — the game rules. `docs/protocol.md` — the network contract for `src/engine` and `src/net`. `docs/decisions/rules-open-items.md` — open decisions and history. `docs/reglas.md` — César's rules reference.
- **Design (binding):** `docs/DESIGN.md` + `design/tokens.json` + `docs/design/look-and-feel.pdf`. Claude Design canvas: https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc (read with the Artifact tool `action: "read"`; mirror in `design/look-and-feel/project/`). Only the orchestrator republishes it.
- `docs/ARCHITECTURE.md`, `docs/PLATFORM.md` — Vite + React PWA, Vercel Functions in `api/`, Supabase, Upstash Redis + QStash.

## Rules for every agent

- Mobile first (390 × 844), then tablet (768) and laptop (1280).
- Use only tokens from `design/tokens.json` (CSS variables in `src/app/theme/tokens.css`) and build screens from `src/app/ui/`. `pnpm design-lint` rejects raw colours, fonts, radii and shadows.
- Never invent Indigenous-language words; names come only from `src/content/cards.json` with their review status.
- Stay inside your assigned paths; don't `pnpm add` or commit unless told to. `pnpm check` must pass; `pnpm e2e` for flows. The orchestrator verifies, commits to `main`, pushes and deploys.
