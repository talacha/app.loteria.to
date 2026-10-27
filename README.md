# Lotería de los Pueblos

**Live:** https://app.loteria.to

Lotería de los Pueblos is the Mexican picture lotería, called in five languages: Náhuatl, Maya yucateco, Quechua (Cusco-Collao), Español and English. One screen acts as the automatic cantor. Family, friends or a classroom join from their phones by scanning a QR code, and each player hears the cards in the language they choose. When a card is called, players pick its written name from three choices. There are no accounts and no app store, nobody bets money, and you play with beans. Solo mode against computer players and printable paper tablas work without a network. The game exists so people can play the game they grew up with and learn the languages of the pueblos while they play.

## Quick start

Requirements: Node 24 (`.nvmrc`) and pnpm 11 (`packageManager` in `package.json`).

```sh
pnpm install
pnpm dev            # Vite dev server
```

With no env vars, the app uses **LocalTransport** (`BroadcastChannel`). You can open a host tab and player tabs in the same browser and play a full round without Supabase. To play across devices, pull the project env:

```sh
vercel link         # project talachadev/app.loteria.to
vercel env pull .env.local
```

`vite.config.ts` maps the Supabase integration's `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the `VITE_SUPABASE_*` names that `src/net` reads. When both are set, the app uses `SupabaseTransport`. The `api/` Functions only run under `vercel dev` or on Vercel. Plain `pnpm dev` does not serve them, so the host shows the room as "unverified" and phones fall back to trust-on-first-use. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#7-environments-and-env-vars) for every variable.

## Scripts

| Script                                                   | What it does                                                                                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                                               | Vite dev server.                                                                                                                                                                                         |
| `pnpm build`                                             | `tsc -b` → `vite build` (PWA + service worker) → `scripts/prerender.mjs` (static HTML for `/`, `/deck`, `/creditos`, `/solo`, `/print`, 404, `app.html` shell, `sitemap.xml`) → `scripts/seo-check.mjs`. |
| `pnpm preview`                                           | Serves `dist/`.                                                                                                                                                                                          |
| `pnpm check`                                             | `lint` (ESLint + `prettier --check .`) → `typecheck` (app, `api/`, `tests/api`) → `test` (Vitest) → `validate-content` → `copy-lint`.                                                                    |
| `pnpm design-lint`                                       | Rejects raw colours, fonts, radii and shadows outside the tokens. **Not** part of `check`; run it on its own.                                                                                            |
| `pnpm e2e`                                               | Playwright (Chromium; phone, tablet and laptop projects). It builds and previews with Supabase vars blanked, so it runs over LocalTransport.                                                             |
| `pnpm format`                                            | `prettier --write .`                                                                                                                                                                                     |
| `pnpm og:render`                                         | Renders `design/og/og.html` to `public/og/{default,invite}.png` (1200×630).                                                                                                                              |
| `pnpm icons:render`                                      | Renders the PNG app icons from the favicon design.                                                                                                                                                       |
| `pnpm prerender`, `pnpm seo:check`                       | The two post-build steps, run on their own.                                                                                                                                                              |
| `pnpm exec tsx loadtest/run.ts …`                        | Load-test harness (headless bots, `--transport local\|supabase`). See [ARCHITECTURE §9](docs/ARCHITECTURE.md#9-testing).                                                                                 |
| `python scripts/generate-audio.py [--langs …] [--ids …]` | Generates every card name with Meta MMS-TTS into `public/audio/{lang}/{id}.m4a` and writes the paths into `src/content/cards.json`. Needs torch, transformers, scipy, numpy and ffmpeg.                  |

## Deploy

- Vercel project **talachadev/app.loteria.to**, framework Vite, Node 24.x, output `dist/`.
- The build is gated. `vercel.json` sets `buildCommand: "pnpm check && pnpm build"`, so a lint, type, test, content or copy failure stops the deploy. `seo:check` runs inside `build`.
- GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm check`, `pnpm build` and `pnpm e2e` on every push to `main` and on every PR.
- Production flow: commit the intended changes, verify the clean checkout (`pnpm verify:release`), and push to `main`, then deploy to production (`vercel deploy --prod`, or the Git integration if it is connected). Git auto-deploy was confirmed by the 2026-10-27 deployment logs.
- Rollback: run `vercel promote <previous-deployment-url>` (or `vercel rollback`) to put the last good deployment back on `app.loteria.to` without rebuilding.
- One-time platform setup (Supabase migration, Upstash Redis/QStash) is in [docs/ARCHITECTURE.md §7](docs/ARCHITECTURE.md#7-environments-and-env-vars).

## Docs

| Doc                                          | What                                                                                    |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| [docs/PRD.md](docs/PRD.md)                   | Product: pillars, scope, non-goals.                                                     |
| [docs/rules.md](docs/rules.md)               | The game rules (source of truth for play).                                              |
| [docs/DESIGN.md](docs/DESIGN.md)             | Design system (binding), with `design/tokens.json` and `docs/design/look-and-feel.pdf`. |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System, modules, offline, build, env, security, tests.                                  |
| [docs/protocol.md](docs/protocol.md)         | Network messages and round lifecycle, generated from `src/net`.                         |
| [docs/decisions/](docs/decisions/)           | Decision records.                                                                       |
| [docs/backlog.md](docs/backlog.md)           | What is next.                                                                           |

## Credits and licences

- **Voices:** Spanish and English use **Kokoro-82M** (Apache-2.0); Náhuatl, Maya yucateco and Quechua use **Meta MMS-TTS** (`facebook/mms-tts-nhe`, `-yua`, `-quz`, CC-BY-NC 4.0). The `/creditos` page credits both. See [audio pipeline](docs/audio.md).
- **Fonts:** Bricolage Grotesque, Atkinson Hyperlegible and Noto Sans (used for PDF tablas) are all under the **SIL Open Font License 1.1**. See `public/fonts/LICENSES.md`.
- **Art:** 32 generated illustrations are indexed from `public/cards/`. The shared card renderer falls back to SVGs in `public/art/`, then Unicode emoji. Full-deck art and clear reuse licences remain backlog work.
- **Names:** the team wrote the Spanish and English names. The Náhuatl, Maya yucateco and Quechua names include draft dictionary and grammar references in `src/content/cards.json` that still require verification and native-speaker review.
