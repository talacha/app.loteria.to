# Track A — Rob: the app

Read [00-SHARED.md](00-SHARED.md) first. Coding agent Sonnet 5.5; adversarial reviewer Sonnet 5.5 in fresh context (prompt in 00-SHARED §6). Game behaviour is defined in [reglas.md](../reglas.md); **never re-implement a rule in UI code: call the engine** (`hostReduce`, `tabla`, `evaluateTap`…).

| ID | Unit | Depends on | Unblocks |
|---|---|---|---|
| A0 | Scaffold + Supabase + Vercel projects | — | everything |
| A1 | Network transports | A0 | A2, A3 live |
| A2 | Home + host screen | A0, César G2 (layout can start on G0 stubs) | demo |
| A3 | Join + phone player (Jugar / Practicar) | A1, César G1, G3 | demo |
| A4 | Deploy, e2e smoke, README | A2, A3 | demo |
| F1 | Integration fixes (shared, empty on purpose) | all | demo |

---

## A0 — Scaffold + Supabase + Vercel projects

**Steps:**
1. `pnpm create vite` (react-ts) copied into the repo root without touching `docs/`, `src/engine`, `src/content`, `public/audio`. Node 22 (`.nvmrc`), pnpm 10, **exact versions** (`.npmrc` `save-exact=true`).
2. Deps: `react`, `react-dom`, `react-router`, `i18next`, `react-i18next`, `zod`, `@supabase/supabase-js`, `idb`, `qrcode` · dev: `typescript`, `vite`, `@vitejs/plugin-react`, `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@playwright/test`, `@axe-core/playwright`, `fast-check`, `tsx`, `eslint` + `typescript-eslint` + react-hooks plugin, `prettier`, `@types/*`.
3. TS `strict`, `noUncheckedIndexedAccess`, `resolveJsonModule` (the content API imports `cards.json`). Aliases `@engine`, `@content`, `@net`, `@app` in tsconfig and Vite.
4. Scripts: `dev` (`vite --port 5291 --strictPort --host`), `build` (`tsc -b && vite build`), `preview` (port 4291), `typecheck`, `lint`, `test` (`vitest run`), `test:e2e`, `lint:copy` (`tsx scripts/copy-lint.ts`, once César's G3 lands), `check` = format + lint + typecheck + test (+ `lint:copy` after G3).
5. Routes: `/` Home, `/cantor` Host, `/r/:code` Join → Player. i18n `es` (default) and `en` for UI strings.
6. CI (`.github/workflows/ci.yml`): install, `pnpm check`, `pnpm build`, Playwright smoke.
7. **Ops (you):** create the Supabase project (free tier) and the Vercel project linked to `talacha/app.loteria.to`. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel and in your `.env.local`. Commit only `.env.example` with empty values.

**Done when:** `pnpm check` and `pnpm build` exit 0 · `pnpm test:e2e` smoke passes (home renders `home-host`) · CI green on `main` · a Vercel preview URL loads the home page · César's engine tests run under `pnpm test`.

## A1 — Network transports

**Spec:** `src/net/transport.ts` with 00-SHARED §4 exactly; `messages.ts` with zod schemas (name ≤40, glyph ≤8, pronouns ≤16, marks ≤16); invalid messages dropped. `LocalTransport` = `BroadcastChannel('loteria:{CODE}')` with internal presence heartbeat (2 s; drop after 6 s). `SupabaseTransport` = channel `loteria:{CODE}`, `broadcast: { self: false }`, event `msg`, presence key = seat; `join` resolves on `SUBSCRIBED`, rejects after 10 s. `createTransport()`: `VITE_TRANSPORT` = `local` | `supabase`, else Supabase if the env keys exist, else Local.

**Done when:** tests: schema accepts every valid `Msg` and rejects 6+ malformed ones; two LocalTransports on one code talk, a third code hears nothing, no echo to sender, presence lists and drops seats · manual: two phones on the Supabase project exchange a message (write it in Notes; don't claim it if not done).

**Reviewer checks:** mutate away `safeParse` → a test goes red · no `console.log` of payloads (they carry names) · timers cleared on `leave`.

## A2 — Home + host screen

**Rules shown here:** R-11, R-12, R-13, R-14, R-15, R-17, R-21, R-22, R-34, R-44.

**Spec:**
- Home: "Ser cantor" (`home-host`) → `createRoom()` (persist the `RoomState` in IndexedDB via `idb` after every event) → `/cantor`. Join box → `/r/{CODE}`.
- Host holds `RoomState` and **only changes it through `hostReduce`**. Transport messages → `{type:'msg', msg, now: Date.now()}`; send everything in `out.send`; handle `out.effects`.
- `speak` effect: `es`/`en` → Web Speech (`es-MX`/`en-US`), verse first if `withVerse`; `nah`/`yua`/`quz` → play `card.names[lang].audio` and show the `ai-voice-label`. **R-12:** start the `speedSec` timer when audio ends, then dispatch `next`.
- Settings: figure (8 + "Sorpresa" with level), call language (5 + rotating), speed (Calmado 15 / Normal 10 / Rápido 6), Escucha. Keyboard: Space start/next, N next, R repeat, P pause.
- Shows `room-code` + QR of `${location.origin}/r/${code}`, presence count, current card (art + name in call language; hidden text in Escucha; local "Practicar de oído" toggle hides art, R-15), called history.
- `claim` effect valid → `claim-result` with the player's name and glyph and **their tabla with `cells` highlighted** (R-22), plus "Seguir" / "Terminar ronda". Invalid → small toast.
- Resume after reload from IndexedDB, paused.

**Done when:** jsdom test: dispatching UI actions only goes through `hostReduce` (spy) · manual on Vercel: start a round, hear 3 cards in `es`, switch to `nah` and hear the MMS audio with the AI label visible, reload and resume · test ids from 00-SHARED §5 present.

**Reviewer checks:** grep: no game logic in `src/app/host` (no shuffling, no claim checks, no `PATTERNS` use beyond display) · `deckSecret` never rendered or sent · the AI label renders whenever a `nah`/`yua`/`quz` word is shown or played.

## A3 — Join + phone player (Jugar / Practicar)

**Rules shown here:** R-15, R-20, R-26, R-27, R-32, R-34–R-41, R-43.

**Spec:**
- Join (`/r/:code`): name 1–24, 12 glyphs (🌵 🐢 🦋 🌽 🌙 ⭐ 🐟 🦜 🍄 🌻 🐝 🦀), optional pronouns, **"Entiendo"** (`join-label-lang`) and **"Escucho"** (`join-listen-lang`) from `LANGS`, mode Jugar/Practicar. Seat = `crypto.randomUUID()` in sessionStorage `loteria.player.{CODE}` (reload skips the form). The submit tap also unlocks audio (play a silent clip) for R-35.
- Protocol: send `hello` now and every 2 s until `welcome` for this seat; then render `tabla(round.seed, tablaIndex)`.
- Grid: 16 cells (art + name in "Entiendo"), ≥44 px, `aria-pressed`, bean animation (none under reduced motion). **Every tap goes through `evaluateTap`**; "No la tengo" through `evaluateNotInTabla`; show `practice-feedback`; "Otra vez" replays.
- Current call: art + name in "Escucho" (respect Escucha and "Practicar de oído"); if "Oír en mi teléfono" is on, play it in "Escucho" (Web Speech for es/en, MMS file for the rest, with `ai-voice-label`). A new call cancels unfinished audio (R-36). Defaults: hear off in Jugar, on in Practicar, with "Usa audífonos".
- Auto-mark toggle only in Jugar (R-39.6). "¡Lotería!" sends `claim`, disabled 3 s; `claim-feedback` "¡Lotería!" or "¡Casi!" + missing cards. On `end`: "Esta vez no fue. ¡Otra ronda!" or the celebration; in Practicar, `practice-summary` from `practiceSummary`.
- Marks and practice log in sessionStorage keyed `{CODE}:{roundNo}`; new `roundNo` clears them.

**Done when:** tests with a fake transport: `hello` repeats until `welcome`; a new round clears marks; claim button disabled 3 s; taps call `evaluateTap` (spy) · manual on two real phones on Vercel: one in Jugar/es, one in Practicar/listening `yua`, same round; the second hears maya with the AI label and gets "Esa no es" on a wrong tap.

**Reviewer checks:** no correctness decision in `src/app/player` outside the engine calls (grep for `called.includes` etc.) · listen language, mode and practice log never sent over the network · a call in `nah` with "Oír" off produces no audio.

## A4 — Deploy, e2e smoke, README

**Spec:** production deploy on Vercel from `main` (the domain is ops, optional today). Playwright with `VITE_TRANSPORT=local`: (1) host + 2 player tabs, figure `full`, auto-mark on, 54 × `next`, claim → "¡Lotería!"; (2) claim after the first call → "¡Casi!"; (3) axe: no serious/critical violations on `/`, `/cantor`, `/r/{code}`. README: what it is, `pnpm i`, `pnpm dev`, env vars, how to play, the AI-voice disclosure and MMS license (CC-BY-NC 4.0).

**Done when:** `pnpm test:e2e` green locally and in CI · the production URL works from a phone on mobile data (not only on the venue Wi-Fi).

## Notes

_(one short block per finished unit: what was built, deviations, what César must know)_
