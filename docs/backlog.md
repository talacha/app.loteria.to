# Backlog

Triaged work on top of the v1.0 baseline ([PRD](PRD.md)). Every item was checked against the code on 2026-10-27; items already fixed were dropped. Game rules: [rules.md](rules.md). Decisions: [decisions/](decisions/README.md).

**Priority:** P0 = broken or blocks shipping safely; P1 = next up, visible to players or a rule/claim we don't meet; P2 = when convenient.
**IDs** are stable; don't reuse them. Close an item by deleting it in the commit that fixes it.

## Summary

| Section | P0 | P1 | P2 | Total |
| --- | --- | --- | --- | --- |
| Bugs | 1 | 9 | 5 | 15 |
| Feature requests | 0 | 1 | 4 | 5 |
| Tech debt | 1 | 4 | 12 | 17 |

## Bugs

### BUG-001 · e2e suite fails: `createRoom` never enters a name, and tests wait for a "Siguiente carta" button that no longer exists — P0

- **Why:** CI runs `pnpm e2e`; 27 of 36 tests fail (every flow test: lobby, a11y on host/join/player, offline, on all three device projects), so multiplayer flows are unguarded.
- **Evidence:** `e2e/helpers.ts:24-26` clicks `a[href="/host"]` with an empty name; `src/app/home/HomePage.tsx:55-61` cancels navigation and shows "Escribe tu nombre". `e2e/helpers.ts:10` (`RX.next`) is used at `e2e/lobby.spec.ts:53` and `e2e/offline.spec.ts:8`, but rules §5.1 removed manual "next" (`src/app/host/caller.test.tsx:139` asserts it is absent). `RX.hostCta` ("ser cantor") is also stale.
- **Accept when:** `createRoom` fills `#home-name`, picks the host mode and lands on `/host`; lobby/offline specs assert the automatic cantor (e.g. a call appears within `speedSec`) instead of a next button; `pnpm e2e` passes on phone, tablet and laptop.

### BUG-002 · Copy lint does not ban "bingo" — P1

- **Why:** Rules §9.5 bans "bingo"; the lint that enforces §9.5 doesn't know the word, which is how BUG-004 shipped.
- **Evidence:** `scripts/copy-lint.ts:72-89` (`framing` rule) has no `bingo`.
- **Accept when:** `bingo` (whole word, case-insensitive, es and en) is in the banned list; a fixture in `scripts/copy-lint.test.ts` fails on it; `pnpm check` fails while BUG-004 copy is present.

### BUG-003 · Copy-lint allowlist exempts words the rules forbid — P1

- **Why:** Rules §9.5 and the no-gendered-roles rule say screens never use "ganar"; the allowlist lets "El primero en acertar gana", "Todos los jugadores reciben" and "varios ganadores, el que tenga más puntos gana" through. English says "takes the round".
- **Evidence:** `scripts/copy-lint.ts:105-107`; `src/app/home/strings.es.json` `steps.one.body`, `steps.two.body`, `steps.three.body`; `strings.en.json` `steps.three.body`.
- **Accept when:** the three allowlist entries are removed and the home steps say e.g. "Cada persona recibe…", "Quien acierta primero suma 2 puntos…", "Si varias personas completan, desempatan los puntos"; `pnpm copy-lint` passes with no allowlist entries for banned words.

### BUG-004 · Home, SEO and manifest copy describe the v0 product: "bingo", paper in the same round, "no phone needed", Escucha mode, "pending review" — P1

- **Why:** First thing visitors and search engines read; it promises features that don't exist and contradicts decisions 0007 and 0009.
- **Evidence:** `src/app/home/strings.es.json` / `.en.json`: `tagline` ("El bingo de imágenes… no hace falta ningún teléfono"), `lede` ("o con papel y frijoles"), `inclusion.paper`, `inclusion.access` ("modo Escucha"), `audience.classroom` ("en papel"), `audience.heritage` ("modo Escucha"), `faq.items.who.a` ("imprimir cartones"), `languagesIntro` + `pendingBadge` + `devNotice` ("esperan la revisión de hablantes nativos", "emojis provisionales"); rendered at `HomePage.tsx:231-326`. `vite.config.ts:32` manifest description "Juega con teléfonos o con papel". `src/app/seo/meta.ts` description for `/` (check alongside).
- **Accept when:** `grep -rni bingo src public index.html` is empty; tagline reads "La lotería de imágenes con la que todos crecimos, cantada en cinco idiomas." / "The picture lotería everyone grew up with, called in five languages."; home mentions paper only as a link to the classroom mode; no "Escucha" or "pendiente de revisión"; the dev notice matches DEBT-014's outcome; prerendered `/` and `llms.txt` agree.

### BUG-005 · Credits claim dictionary sources "cited on each card" — P1

- **Why:** Constraint "honesty about Indigenous words". Every Indigenous `source` in `cards.json` says "…, unverified draft"; the credits state the opposite.
- **Evidence:** `src/content/credits.json:11-12`; `src/content/cards.json` `names.{nah,yua,quz}.source` (162 × "unverified draft").
- **Accept when:** credits describe the current provenance truthfully (drafts from named references, pending verification) until DEBT-014 lands; a content test fails if credits claim citations while any `source` contains "unverified".

### BUG-006 · MMS clips for "El Cóndor" and "La Piña" mispronounce ó / ñ — P1

- **Why:** The voice is the lesson; a wrong Spanish pronunciation teaches the wrong word.
- **Evidence:** `public/audio/es/condor.m4a`, `public/audio/es/pina.m4a` (listening test); generator `scripts/generate-audio.py`.
- **Accept when:** both clips are regenerated (e.g. with respelled input text) and approved by a Spanish speaker; the generator records any respelling per card so future regenerations keep it; sweep the other 52 es clips and all en clips for the same issue.

### BUG-007 · "Terminar ronda" sends `end{reason:'full-card'}` — P1

- **Why:** Rules §1.4 lets the organiser end early, but the wire says a full cartón happened; players may see a ¡Lotería! screen with no completed cartón.
- **Evidence:** `src/app/host/useGame.ts:518-521`; `src/net/messages.ts:59,147` allow only `'full-card'`.
- **Accept when:** `reason: 'full-card' | 'ended'` in the schema and [protocol.md](protocol.md); `endRound` sends `'ended'` with `winners: []`; players see a neutral "La ronda terminó" screen with "Otra ronda"; unit test in `caller.test.tsx` covers it.

### BUG-008 · Room code shown twice on the host lobby — P1

- **Why:** Two large codes compete for attention on the projector; players ask which one to type.
- **Evidence:** `src/app/host/HostLobby.tsx:111` (`QrCard` renders `code`, `src/app/ui/game.tsx:377`) and `HostLobby.tsx:113` (`RoomCodeTiles` "SALA").
- **Accept when:** the code appears once at display size (keep the SALA tiles, drop the code under the QR, or the reverse); axe and a 390 px screenshot show no duplicate.

### BUG-009 · `nube` art shows rain streaks — P2

- **Why:** "La Nube" should read as a cloud; streaks read as rain and confuse the picture-to-word link.
- **Evidence:** `public/art/nube.svg` (source `design/look-and-feel/art/nube.svg`).
- **Accept when:** streaks removed in both copies; card reviewed in light, dark and high-contrast.

### BUG-010 · `/solo` layout-shift fix is unmeasured — P2

- **Why:** A CLS fix was applied without a measurement; Core Web Vitals affect the prerendered public page.
- **Evidence:** `src/app/solo/SoloPage.tsx`, `SoloPage.module.css`.
- **Accept when:** Lighthouse (mobile) or a `PerformanceObserver` e2e check shows CLS < 0.1 on `/solo` cold load and when starting a game.

### BUG-011 · Wrong-choice tile and speed slider not verified in a browser — P2

- **Why:** Both were changed for accessibility (state not colour-only, ≥ 3:1 borders) and only covered by jsdom tests.
- **Evidence:** `src/app/ui/game.tsx:181-230` (`ChoiceState 'wrong'`); range inputs at `src/app/host/HostLobby.tsx:207`, `src/app/game/HostGame.tsx:165`.
- **Accept when:** checked on a real phone and desktop in all four themes (keyboard, touch, screen reader announces value and "¡Casi!"); screenshots attached to the PR.

### BUG-012 · Room code may not be unique when the registry is down (rules §1.1) — P2

- **Why:** Rules §1.1 says the code is not in use by any other room. If `/api/rooms` fails (Redis missing or unreachable), the host continues without a reservation and two rooms could share a channel.
- **Evidence:** `src/app/host/useHostRoom.ts:48-61, 213-256` (`'failed'` path proceeds).
- **Accept when:** on `'failed'` the host either retries with backoff and shows a notice, or the host key in the link fragment is enough to keep two rooms with the same code apart (phones ignore frames signed by another key); test covers both.

### BUG-013 · Late joiners and reloaded phones don't get previously called cards crossed (rules §1.5–1.6) — P1

- **Why:** Rules say a late joiner gets a cartón with every called card crossed, and a reload restores crossed squares. The phone only crosses cards for which it receives `callClosed`, so a late or reloaded phone can never complete its cartón.
- **Evidence:** `src/app/player/playerState.ts:178-182` (`callClosed` is the only path that crosses); `round` / `assign` carry no called list (protocol.md).
- **Accept when:** the host sends the closed call list (e.g. `closed: CardId[]` or a count into the seeded order) in `assign` and on resume; the player reducer crosses them on receipt; unit test for late join and reload mid-round; protocol.md updated.

### BUG-014 · Player names allow 40 characters; rules say 1–24 (rules §1.2) — P2

- **Evidence:** `src/net/messages.ts:20` (`t.length <= 40`); `src/app/home/profile.ts:4` (`NAME_MAX = 40`).
- **Accept when:** one shared `NAME_MAX = 24` used by the schema, home and join inputs; schema test rejects 25 characters.

### BUG-015 · Loadtest crashes after the rules v2 protocol change — P1

- **Why:** The loadtest is our only concurrency and quota evidence (DEBT-002, DEBT-003).
- **Evidence:** `loadtest/bot.ts:99` reads `m.pattern` from `round`, which no longer has patterns; the bot still models v1 claims.
- **Accept when:** bots follow protocol.md (assign → tabla, pick within the call window, callClosed, end); `pnpm tsx loadtest/run.ts` with 20 players × 3 rooms exits 0 and writes a report.

## Feature requests

### FEAT-001 · Add Bribri (`bzd`) and Cabécar (`cjp`) — P1

- **Why:** Pillar 2: adding a language should be a content change. Two Costa Rican Chibchan languages.
- **Evidence:** drafts at `src/content/drafts/{bzd,cjp}.json`; `facebook/mms-tts-cjp` exists for Cabécar; there is no MMS model for Bribri. `Lang` union in `src/content/types.ts`; `LANG_COLORS` in `src/content/index.ts`.
- **Scope notes:** Bribri has no MMS voice, so its audio needs native recordings or a text-only call; copy, SEO and OG images that say "cinco idiomas" change to seven.
- **Accept when:** Bribri audio is resolved and a decision record written; drafts have a source per word; adding the languages touches only content, audio, i18n labels and one token per language colour; all rules in §2 hold for 7 languages.

### FEAT-002 · Optional gloss in the app language after the reveal — P2

- **Why:** Helps learners connect a Náhuatl word to its meaning.
- **Evidence:** decision 0005; `cards.json` already holds `gloss`.
- **Accept when:** a per-player toggle shows the es/en name under the revealed word; off by default; never shown before the call closes.

### FEAT-003 · Figures as an organiser option — P2

- **Why:** Eight figures plus a "Sorpresa" figure were deferred, not rejected.
- **Evidence:** decision 0004.
- **Accept when:** the organiser can choose full card (default) or a figure before the round; host detects the figure; rules.md and protocol.md updated first.

### FEAT-004 · Classroom mode for paper cartones — P2

- **Why:** Decision 0009 keeps paper out of the online game; classrooms without phones still need a cantor screen that checks paper cartones.
- **Evidence:** `/print` (`src/app/print/`), rules §12.
- **Accept when:** a separate flow pairs `/print` cartones (with check codes) with a display-only cantor screen and a "check a cartón" action; it never mixes with an online room.

### FEAT-005 · Commissioned art for the 38 cards still shown as emoji — P2

- **Why:** Only 16 cards have illustrations; emoji vary by platform and look unfinished next to the art.
- **Evidence:** `public/art/` has 16 SVGs; the other 38 cards fall back to `art`/`emoji` in `cards.json`.
- **Accept when:** 54 SVGs in the Feria de noche style, no people, each under the per-file budget; precache stays < 10 MB.

## Tech debt

### DEBT-001 · Fix the react-refresh lint warning in `Shell.tsx` — P2

- **Evidence:** `src/app/Shell.tsx:11` exports `titleKey` from a component file (`react-refresh/only-export-components`).
- **Accept when:** `titleKey` moves to its own module (e.g. `src/app/titles.ts`); `pnpm lint` shows 0 warnings.

### DEBT-002 · Signed host frames have no nonce; replays are accepted — P1

- **Why:** Anyone on a room channel can re-broadcast a captured signed frame (e.g. an old `pickResult` or `end`) within the round.
- **Evidence:** `src/net/crypto.ts` signs canonical JSON only; `loadtest/run.ts:424` reports `replayOfSignedFrameAccepted`.
- **Accept when:** host frames carry a monotonically increasing `seq` (per room key) inside the signature; phones drop `seq <= last`; loadtest reports `replayOfSignedFrameAccepted: 0`; protocol.md updated.

### DEBT-003 · O(n²) pick fan-out against the Supabase Free Realtime quota — P1

- **Why:** Every `pick` produces a `pickResult` and a `scores` broadcast to every phone; with 20 players a call costs ~n² deliveries, and loadtest peaks approach the assumed 100 msg/s limit.
- **Evidence:** protocol.md (`pickResult`/`scores` to all); `loadtest/run.ts:407-420` (`peakTxPlusRxPerSec`, quota assumption).
- **Accept when:** results go only to the picking seat (or are batched once per call at `callClosed`), and `scores` is sent once per call; a 20-player loadtest stays under 50 % of the quota; quota numbers confirmed in the Supabase dashboard.

### DEBT-004 · 93 orphan clips in `public/audio` (0.43 MB precached) — P2

- **Evidence:** 85 clips each in `public/audio/{nah,yua,quz}` vs 54 cards; 93 files (429,536 bytes) are not referenced by `cards.json` (decision 0006). Workbox glob `vite.config.ts:52` precaches them.
- **Accept when:** orphans deleted (they stay in git history) or moved out of `public/`; `scripts/validate-content.ts` fails on unreferenced clips.

### DEBT-005 · Stray sed backup files — P2 · ✅ Fixed 2026-10-27 (files deleted)

- **Evidence:** `src/app/deck/DeckPage.module.css-E`, `src/app/home/HomePage.module.css-E` are tracked.
- **Accept when:** deleted; `*-E` added to `.gitignore`.

### DEBT-006 · e2e is not part of the deploy gate — P2

- **Why:** BUG-001 went unnoticed because only CI runs Playwright and nothing blocks a deploy on it.
- **Evidence:** `vercel.json` `buildCommand`; `.github/workflows/ci.yml`.
- **Accept when:** branch protection requires the CI job, or the clean-worktree verification includes `pnpm e2e` (decision 0014 updated).

### DEBT-007 · High-contrast theme values only in `tokens.css`, not in `design/tokens.json` — P2

- **Evidence:** `src/app/theme/tokens.css` (contrast block); `src/app/theme/tokens.test.ts` parity test does not cover the contrast theme.
- **Accept when:** contrast values live in `design/tokens.json` and the parity test covers every theme.

### DEBT-008 · `--border-w` and `--text-call` missing from `design/tokens.json` — P2

- **Evidence:** defined in `src/app/theme/tokens.css` only.
- **Accept when:** both are tokens in `design/tokens.json` and covered by the parity test.

### DEBT-009 · Deprecated legacy alias block still in `tokens.css` — P2

- **Evidence:** legacy alias section in `src/app/theme/tokens.css`.
- **Accept when:** remaining uses migrated to current tokens; block deleted; `pnpm design-lint` rejects the old names.

### DEBT-010 · `index.html` `theme-color` `#b3261e` is not a token — P2

- **Evidence:** `index.html` meta `theme-color`; `vite.config.ts:36-37` manifest colours.
- **Accept when:** theme-color follows the active theme (night / maíz tokens, one `<meta media>` per scheme) and the manifest uses the same values.

### DEBT-011 · Docs and agent guidance point at moved files — P1 · ✅ Fixed 2026-10-27 (CLAUDE.md rewritten)

- **Why:** Agents follow `CLAUDE.md`; dead pointers send them to missing docs.
- **Evidence:** `CLAUDE.md` and `docs/ARCHITECTURE.md` were rewritten against the code.
- **Accept when:** `CLAUDE.md` points to PRD, rules, protocol, decisions/ and backlog; no doc links to a missing path (add a link check to `pnpm check`).

### DEBT-012 · Stale lint messages and test helpers from rules v1 — P2

- **Evidence:** `scripts/copy-lint.ts:63,69` suggest "completar la figura" / "complete the pattern" (figures are not in v1.0); `e2e/helpers.ts:5-11` regexes for v1 copy.
- **Accept when:** messages suggest "completaste" / "¡Lotería!"; helper regexes match current strings.

### DEBT-013 · `claim` message is defined but never sent — P2

- **Why:** Rules §9.1 has the host detect a full cartón at `callClosed`; the `claim` schema and its session rate limit are dead code, and players cannot tap ¡Lotería!. Dead protocol surface confuses agents and the loadtest (BUG-015).
- **Evidence:** `claim` in `src/net/messages.ts:104,149` and `src/net/session.ts:94`; no sender in `src/app/player/` or `src/app/game/PlayerGame.tsx`.
- **Accept when:** `claim` is removed from the schema, session rate limit, host and protocol.md (rules §9.1: the host detects a full cartón; players do not claim).

### DEBT-014 · Indigenous word sourcing: every Náhuatl, Maya and Quechua name needs a dictionary source — P0

- **Why:** Decision 0007 ships all five languages as verified, but all 162 Indigenous names say "unverified draft" and several notes say "from memory; page not checked". This is the product's biggest honesty risk.
- **Evidence:** `src/content/cards.json` `names.{nah,yua,quz}.source`/`headword`; earlier sourced research is in git history (`git show 8c96117:src/content/cards.json`, 23 shared ids = 69 words).
- **Accept when:** each Indigenous word is replaced or confirmed against a dictionary, with a URL or full reference with page in `source`; clips are regenerated for changed words; `validate-content` fails on "unverified".

### DEBT-015 · `status` in `cards.json` no longer records review — P2

- **Why:** After decision 0007 every name is `approved`; `VITE_HIDE_UNREVIEWED` and `callableLangs()` gate on a value that never varies.
- **Evidence:** `src/content/index.ts:22-38`; `src/content/schema.ts`.
- **Accept when:** status values are redefined (`draft` / `sourced` / `native-reviewed`) without hiding any language, or the gate is removed; UI copy matches.

### DEBT-016 · Náhuatl credits and label do not name the voice variant — P2

- **Why:** Decision 0020: spellings are Classical/Central, the voice is Huasteca (`nhe`).
- **Evidence:** `cards.json` `names.nah.source`; `scripts/generate-audio.py:20`; `src/content/credits.json`.
- **Accept when:** credits and the language label state both the spelling variant and the voice model.

### DEBT-017 · Content licence and code licence — P1

- **Why:** MMS clips are CC-BY-NC 4.0; the repo has no LICENSE, so reuse terms for code, art and words are undefined.
- **Evidence:** no `LICENSE` at repo root; `public/fonts/LICENSES.md` only covers fonts; `src/content/credits.json`.
- **Accept when:** LICENSE file(s) added for code and content, compatible with CC-BY-NC audio; credits page links them.
