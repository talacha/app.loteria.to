# Lotería de los Pueblos (app.loteria.to)

## Docs (sources of truth)

| Doc                                        | What it decides                                                                                                                                                                                              |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `docs/PRD.md`                              | Product: pillars, audiences, v1.0 scope, non-goals                                                                                                                                                           |
| `docs/rules.md`                            | **Game rules** (the only rules contract)                                                                                                                                                                     |
| `docs/DESIGN.md` + `design/tokens.json`    | **Design system** (binding). Visual reference: `docs/design/look-and-feel.pdf`, canvas https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc (read with the Artifact tool; only the orchestrator republishes it) |
| `docs/ARCHITECTURE.md`, `docs/protocol.md` | System as built; network messages                                                                                                                                                                            |
| `docs/audio.md`                            | Audio pipeline (preflight generation, engine router, cache)                                                                                                                                                  |
| `docs/decisions/`                          | Why things are the way they are (ADRs)                                                                                                                                                                       |
| `docs/backlog.md`                          | Bugs, features, tech debt, open decisions — **work from here**                                                                                                                                               |
| `docs/archive/`                            | History only; never a source of truth                                                                                                                                                                        |

## Rules for every agent

- Pick work from `docs/backlog.md`; when a change makes or reverses a product decision, add an ADR in `docs/decisions/` and update the backlog item.
- Mobile first (390 × 844), then 768 and 1280. Use only tokens from `design/tokens.json` and components from `src/app/ui/`; `pnpm design-lint` and `pnpm copy-lint` enforce it.
- Game logic lives in `src/engine` and follows `docs/rules.md`; the UI never re-implements a rule.
- Never invent Indigenous-language words; names come from `src/content/cards.json` with their source and status.
- Stay inside your assigned paths; don't `pnpm add` or commit unless told to. `pnpm check` and `pnpm build` must pass; run `pnpm e2e` for flows. The orchestrator verifies, commits to `main`, pushes and deploys.
