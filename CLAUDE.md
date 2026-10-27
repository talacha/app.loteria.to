# Lotería de los Pueblos (app.loteria.to)

Read before working:

- `docs/PRD.md` — product spec. §3.10 is the current focus (session setup + lobby, mobile first). Turn-by-turn rules will come from `docs/rules.md`.
- `docs/ARCHITECTURE.md`, `docs/PLATFORM.md` — stack: Vite + React SPA (PWA, offline-first), Vercel Functions in `api/`, Supabase (Realtime, Postgres, Storage), Upstash Redis + QStash.
- `docs/DESIGN.md` — look and feel. **The Claude Design canvas is the visual source of truth:** https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc — read it with the Artifact tool (`action: "read"`), not WebFetch. The same artboard source is in `design/look-and-feel/project/*.dc.html` if artifact access is unavailable. Builders read it; only the orchestrator republishes it.

Working rules:

- Stay inside the directories you were assigned; don't `pnpm add` or commit unless told to.
- `pnpm check` (lint, typecheck, tests, content validation, copy lint) must pass; `pnpm e2e` for flows.
- Never invent Indigenous-language words; names come only from `src/content/cards.json` with their review status.
