# Architecture

This document describes the system as it stands in v1.0, checked against the code. The network contract is in [protocol.md](protocol.md) and the game rules are in [rules.md](rules.md). Anything marked _unverified_ could not be confirmed from the repo.

## 1. Shape of the system

The app is a static **Vite + React 19 PWA** with a few **Vercel Functions** in `api/`. The browser does all the game work: shuffling the deck, deriving tablas, choosing the spelling choices, scoring, playing audio and building PDFs. The **host device** (the cantor screen) is the only authority for a room. Phones join a **Supabase Realtime** channel (broadcast + presence). There is no game server and no game database.

During play, only one Function matters: `/api/rooms`, the room-code and host-key registry in **Upstash Redis**. The Postgres, Storage and QStash parts serve a reviewer and metrics pipeline. Their endpoints are deployed, but no current client calls them. The catalog contains 144 cards; a room freezes the available-card intersection of its participating voices, currently 144 for Spanish/English and 54 when an existing Indigenous voice participates.

```mermaid
flowchart LR
  subgraph Room["The room"]
    Host["Host / cantor screen<br/>/host · engine · IndexedDB<br/>ECDSA key pair"]
    Phones["Phones (≤ 20 seats incl. host-local)<br/>/r/CODE · PlayerBoard"]
    Paper["Paper tablas<br/>/print PDF"]
    Solo["Solo device<br/>/solo · CPU players"]
  end
  subgraph Vercel
    Static["Static + prerendered HTML<br/>/, /deck, /creditos, /solo, /print<br/>app.html shell, SW, fingerprinted audio, WebP card art"]
    MW["middleware.ts<br/>/r/* OG tags for link previews"]
    Rooms["/api/rooms · /api/rooms/:code"]
    Other["/api/health · /api/metrics<br/>/api/review/* · /api/jobs/*"]
  end
  subgraph Supabase
    RT["Realtime channel loteria:CODE<br/>broadcast 'msg' + presence"]
    PG[("Postgres<br/>review_*, metric_*, job_runs")]
    ST[("Storage bucket audio-pending")]
  end
  Redis[("Upstash Redis<br/>room:CODE, rl:*, job:*")]
  QStash["Upstash QStash"]

  Host <-->|signed host msgs / hello, pick| RT
  Phones <--> RT
  Host -->|POST code + hostKey| Rooms
  Phones -->|GET hostKey if no #k=| Rooms
  Rooms --> Redis
  Other --> Redis
  Other --> PG
  Other --> ST
  Other -->|publish| QStash -->|signed POST| Other
  Phones -. link preview bots .-> MW --> Static
```

## 2. Vercel surface

**Static and prerendered.** `pnpm build` writes `dist/`. These routes are prerendered to real HTML: `/`, `/deck`, `/creditos`, `/solo`, `/print` and `404.html`. `dist/app.html` is the noindexed SPA shell. `vercel.json` rewrites `/host`, `/r/:code` and `/ui` to `/app.html` and sends `X-Robots-Tag: noindex, nofollow` on those routes. `robots.txt` disallows the same routes plus `/api/`. Cache headers: `/assets`, `/art`, `/fonts` and fingerprinted `/audio/*.hash.m4a` are immutable for one year; `/audio/manifest.json` revalidates, `/og` gets 7 days plus SWR, and `/sw.js` is `no-cache, no-store, must-revalidate`. Illustrated card faces live at `/cards/{id}.webp`.

**Middleware** (`middleware.ts`, matcher `/r/:path*`). Link-preview bots don't run JS, so for GET/HEAD the middleware fetches `/app.html`. It strips the generic title, description, OG, Twitter and canonical tags and injects invite-specific ones: title `¡Te invitaron a la Lotería! · Sala CODE`, image `/og/invite.png`, `noindex`. The response is cached with `s-maxage=3600`. If anything fails, the request passes through to the normal rewrite.

**Functions** (`api/`, Node runtime). Every handler goes through `route()` in `api/_lib/http.ts`, which provides a method guard, same-origin only (no CORS headers; a foreign `Origin` gets 403) and `{"error":code}` bodies. A missing service answers `503 {"error":"not_configured","feature"}`.

| Route                      | Method | Does                                                                                                                                                                         | Called by           |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| `/api/rooms`               | POST   | Takes `{code, hostKey}` and runs `SET room:CODE hostKey NX EX 14400` (4 h). Returns 201 when new and 200 when the same key is already stored (resume). A different key gets 409 `code_taken`. Limit 10/min per IP. | host (`useHostRoom`) |
| `/api/rooms/:code`         | GET    | Returns `{hostKey}` or 404, with `no-store`. Limit 60/min per IP.                                                                                                              | host (409 check), phones without `#k=` |
| `/api/health`              | GET    | Returns `{redis, qstash, db}`, each `ok`, `not_configured` or `error`.                                                                                                        | ops                 |
| `/api/metrics`             | POST   | Takes up to 50 anonymous counters (`round_start`, `card_matched`, `claim`, `round_end`, `print`) and inserts them into `metric_events`. With `DNT`/`Sec-GPC` it stores nothing and returns 204. Limit 30/min per IP. | **no client yet**   |
| `/api/review/auth`         | POST   | Checks `{lang, code}` against `REVIEW_CODE` (timing-safe) and returns a 2-hour HMAC token. Only failures count: 5 per IP and 50 globally per 10 min.                          | **no client yet**   |
| `/api/review/submit`       | POST   | Requires a Bearer token. Inserts into `review_submissions` (idempotency key), can return a signed upload URL into `audio-pending`, and enqueues `notify-reviewers`. Limit 20 per 10 min per IP. | **no client yet**   |
| `/api/review/uploaded`     | POST   | Checks that the upload exists in Storage, then enqueues `transcode-recording`.                                                                                                | **no client yet**   |
| `/api/jobs/notify-reviewers` | POST | QStash only. Stub: writes a `job_runs` row.                                                                                                                                  | QStash              |
| `/api/jobs/transcode-recording` | POST | QStash only. Sets the submission from `upload_pending` to `uploaded`. No ffmpeg runs.                                                                                     | QStash              |
| `/api/jobs/rollup-metrics` | POST   | QStash only. Rolls `metric_events` up into `metric_daily` for complete UTC days and deletes raw rows older than 30 days. _Unverified:_ whether a QStash schedule exists.        | QStash schedule     |
| `/api/jobs/publish-content-release` | POST | QStash only. Stub.                                                                                                                                                       | manual              |

Every job (`api/_lib/job.ts`) does the same things. It verifies `Upstash-Signature` over the raw body and the public URL. It takes a Redis lease `job:{jti}` (`NX EX 120`, then `done` for 24 h) and writes `job_runs`. On failure it releases the lease and returns 5xx so QStash retries.

**Data actually stored.** In Redis: `room:CODE`, the `rl:*` rate-limit counters and `job:*`. In Postgres (`supabase/migrations/0001_init.sql`, RLS on with no policies, so only the service role can read or write): `review_submissions`, `metric_events`, `metric_daily` and `job_runs` are written by code. `reviewers`, `review_decisions` and `content_releases` exist, but no code touches them. In Storage: a private `audio-pending` bucket. **No player data is stored by these backend services**: no names, tablas or marks. Browser session/local storage and the host’s IndexedDB do retain the profile and recovery state described below.

## 3. Client module map

Path aliases (`vite.aliases.ts`): `@engine`, `@net`, `@content`, `@print`, `@ai`, `@app`.

| Module        | What it is                                                                                                                                                                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/engine`  | Pure, deterministic rules with no I/O. `deckOrder(seed, roundNo, ids)`, `tabla(seed, index, frozenPool, gridSize)` (3×3–8×8, default 4×4, category cap scaled from 5/16), `pickTablaIndex` (at most `⌊gridSize²/2⌋` shared cards), `minDeckFor`/`maxGridFor` (capacity per grid and player count), `choicesFor(seed, roundNo, i, correct, pool, exclude)`, `scorePick` (2/1/0, ≤ 2 picks per call), `resolveFullCardWinners`, `tablaCode`/`decodeTablaCode` (6-char Crockford code with a GF(32) check), `roomCode` (5 chars, no I/L/O/0/1), `checkClaim`/`PATTERNS` (legacy validation helpers; active rounds and loadtest bots use automatic full-card completion), `soloCpuPick`. Room limits: `ROOM_MIN_PLAYERS = 2`, `ROOM_MAX_PLAYERS = 20`. |
| `src/net`     | `Transport` interface. `BaseTransport` adds the send queue (≤ 100 before join), generation guards and the `Session`, which validates with zod, signs and verifies, and applies rate limits. Two transports: `LocalTransport` (`BroadcastChannel loteria:CODE` with its own presence heartbeat, 2 s beat and 6 s expiry) and `SupabaseTransport` (Realtime channel `loteria:CODE`, broadcast event `msg`, `self: false`, presence key = seat, track `{role}`). `createTransport()` uses Supabase when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set, otherwise Local. Host messages are signed with **ECDSA P-256** over the version-3 envelope `{v:3,seq,m}`. `sequence.ts` durably reserves sender counters and receiver high-water marks in IndexedDB; storage/version failures propagate to bilingual recovery UI. `round.deck` is the frozen pool sent to every phone. Players pin the key from the QR `#k=` or `/api/rooms`, or else use **trust-on-first-use** (TOFU). See [protocol.md](protocol.md). |
| `src/content` | `cards.json`: 144 cards, 24 per category. Spanish/English labels and clips cover all 144; nah/yua/quz retain the original 54-card coverage. Expansion Indigenous names are omitted until approved and voiced; research drafts are not playable. Names include review status and optional IPA/provenance/clip metadata. `cardsAvailableIn(langs)` computes room intersections, `langsForDeck(ids)` constrains language switches, `callableLangs()` lists available voices, and `isAvoidedPair` excludes confusing distractors. The previous 54-name eligibility does not certify new provenance. Zod validates the catalog at import, and `StartupGate` catches content/import failure before it can blank the app. UI catalogs and `credits.json` live here too. |
| `src/ai`      | `hint.ts`: retained offline matcher helper. The active spelling-pick game does not call it; there is no online provider.                                                                                                                                                                                       |
| `src/print`   | Separate classroom-mode PDF tablas built with `pdf-lib` + fontkit in a Web Worker (`worker.ts`). Layout, seeds and options. Each tabla carries its 6-char check code.                                                                                                                                                                  |
| `src/app`     | React Router routes (`routes.tsx`): `/` home, `/host`, `/r/:code` join → lobby → player game, `/solo`, `/print`, `/deck`, `/creditos`, `/ui` (component gallery), `*` 404. Areas: `home`, `host` (`useHostRoom`: code, keys, registry, roster, presence; `useGame`: frozen room deck, automatic caller and scoring; `roundMachine`; `persist` in IndexedDB), `join`, `lobby` (`LobbyWaiting`: hello/retry), `player` (`playerState` reducer restores the explicit deck/closed-call history; `PlayerBoard`, `WinScreen`), `game` (`HostGame`, `PlayerGame` boundary), `solo` (`soloEngine`: local host + CPUs using a language-covered pool), `audio` (`speakCall`), `print`, `deck`, `credits`, `ui` (shared components), `theme` (tokens, preferences), `seo` (head/meta and the SSR entry used by prerender), `i18n.ts` (es/en UI via i18next + ICU). |

**Audio.** `speakCall(card, lang)` plays the fingerprinted path in `card.names[lang].audio`, with integrity/provenance in `clip`. The catalog references 497 clips: 144 each for Spanish/English (Kokoro), 54 each for Náhuatl, Maya yucateco and Quechua, and 47 Cabécar research clips (Meta MMS-TTS). The five playable languages account for 450; Cabécar remains unavailable for play. If a clip cannot play, es/en may fall back to Web Speech; Indigenous languages return `no-audio` and never synthesize guesses at runtime. New Indigenous additions remain unavailable until their names and audio are approved. See [audio.md](audio.md). The host screen starts muted; each phone plays the call in its effective supported language.

**Round coverage and recovery.** A new room round freezes `cardsAvailableIn(participatingSpokenLangs)` and sends/persists its IDs as `deck`. `tabla`, caller order, spelling choices, scoring/completion and reload restoration all use that pool. The selected grid is preserved when supported and otherwise capped for the shared pool and roster count. Twenty 8×8 boards are supported by 144 cards; twenty players sharing the 54-card pool use at most 4×4. Header/player language controls disable voices that cannot cover the frozen pool; a late incompatible preference receives a supported fallback and explanation. Legacy saved rounds without `deck` restore the original 54. Signed `assign.closed` restores earlier crosses without revealing the open call, and `scores` restores points.

## 4. Offline and PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'` generates the service worker.

- **Precached:** `index.html`, game chunks, all 144 delivered WebP illustrations, every referenced voice clip and the UI assets needed for offline play. Unreferenced historical audio is excluded. `scripts/precache-budget.ts` enforces card art ≤ 6,000,000 bytes and total installation < 10 MiB; the final generated service-worker manifest is checked again by `scripts/check-precache.mjs`, including coverage of every catalog illustration and referenced clip. The generated manifest currently includes `index.html`; public-route snapshots and `app.html` are written later by prerender. Offline navigations use the `/index.html` fallback and render their requested route in React, rather than relying on individually cached HTML snapshots. Files retain the 3 MB individual Workbox limit. `/api/*` is `NetworkOnly` and excluded from navigation fallback.
- **Printing:** large print-worker/builder chunks and the Noto Sans PDF font are excluded from installation to keep the game’s offline budget bounded. They use a separate `CacheFirst` runtime cache and become available offline after a successful connected print use. A first-ever PDF request without a connection is not guaranteed.
- **Works offline after installation:** `/solo` (engine and CPU players on-device), `/deck`, `/creditos`, and the host’s local calling/scoring. Phones need the network unless they share a browser with the host (LocalTransport). Connectivity failure is distinct from protection-storage failure: unavailable durable sequence storage blocks protected messaging and shows recovery instructions.
- **Host persistence:** IndexedDB `loteria-host` stores the round’s settings, seed, frozen deck, call position, scores and roster in `state`; tabla indexes live in `assignments`; `keys` holds a non-extractable ECDSA key pair per room code. A separate `loteria-sequences` database atomically persists per-key sender counters and per-key/per-seat receiver high-water marks before protected messages are sent or delivered. Reload does not reset either the key or replay history.

## 5. Build pipeline

1. `scripts/cards-index.mjs` indexes delivered `/cards/{id}.webp` assets, then `tsc -b` and `vite build` produce the client, worker chunks, manifest and service worker. The Workbox transform excludes unused audio and deferred print assets, and checks the installation budget.
2. `scripts/prerender.mjs` writes `dist/app.html` (the noindexed shell without a public-route canonical or OG URL). It bundles `src/app/seo/ssr-entry.tsx` with Vite SSR and renders the public routes into that shell under jsdom, applying route-specific title, description, OG and JSON-LD. It writes each public `index.html`, `404.html` and `sitemap.xml`.
3. Audio inventory (`scripts/audio/check.mjs`), SEO (`scripts/seo-check.mjs`) and final precache (`scripts/check-precache.mjs`) checks verify delivered assets and generated output. Missing illustrations/voices or a budget overrun fail the build.
4. Offline production scripts are run separately and their outputs committed: OG/icons, illustrated WebP card faces, and `scripts/generate-audio.py` (Kokoro or MMS-TTS → normalized AAC `.m4a`, fingerprinted paths and catalog clip metadata). `scripts/export-review.ts` exports reviewer sheets; expansion Indigenous candidates remain outside the playable corpus.

On Vercel the install command is `pnpm install --frozen-lockfile` and the build command is `pnpm check && pnpm build`.

## 6. Security model

- **The host is the authority.** The host alone draws cards, sends choices, assigns tablas, scores picks in arrival order and decides winners. Phones send only `hello` and `pick`. `claim` exists in the schema, but the app neither sends nor handles it.
- **Signed host messages.** Every host-only type is signed with ECDSA P-256/SHA-256 over sorted-key JSON `{v:3,seq,m}`. Browser IndexedDB atomically persists sender counters and per-key/per-seat receiver high-water marks; replayed or older sequences are dropped. Authenticated legacy hosts require every screen to reload. Receivers drop any host-type frame that is unsigned, carries a bad signature or claims `role ≠ host`. `round` and `lobby` carry `hostKey`.
- **Key distribution.** The best source is the QR link fragment `#k=` (the UI shows "verified" only in this case). Next is `GET /api/rooms/:code` (1.5 s timeout). Otherwise the player uses TOFU and pins the first signed `round`/`lobby` that verifies. _Known limit:_ under TOFU, whoever speaks first on the channel gets pinned. Player messages are not signed. The host only checks that `frame.from === m.seat` and that the seat is in the roster, so a channel member who learns another seat id from `lobby` could pick in that seat's name.
- **Code reservation.** `room:CODE` is held with `NX` for 4 h and bound to one key. The host retries up to 3 new codes on 409. If registration fails, the host runs "unverified" and re-registers every 15 s and whenever the browser comes back online.
- **Rate limits.** In the client, the receiving `Session` allows at most 2 picks per seat per call, picks ≥ 400 ms apart per seat, and claims at 1 per seat per 3 s and ≤ 20/s room-wide. The host throttles roster/name `hello` updates from one seat within 2 s; voice updates apply immediately to keep waiting-room coverage accurate. In Functions: the Redis fixed windows listed in §2, keyed by IP from `x-vercel-forwarded-for` (falling back to `x-real-ip`, then the last `x-forwarded-for` hop), with IPv6 collapsed to its /64.
- **Input hygiene.** Everything on the wire is zod-validated. Names, glyphs and pronouns reject control, format and bidi-override characters (ZWJ is allowed). Lengths: name ≤ 24, glyph ≤ 16, pronouns ≤ 30.
- **Privacy and indexing.** There are no accounts or tracking cookies; player recovery data stays in browser storage rather than backend game tables. `/host`, `/r/*` and `/ui` are noindexed by header, meta tag and `robots.txt`. Functions never log request data. Public tables have RLS enabled with no anonymous/authenticated policies; the backend uses its configured database connection or service role.

## 7. Environments and env vars

Environments: local (`pnpm dev`, LocalTransport by default), Vercel preview and Vercel production (`app.loteria.to`). QStash cannot reach protected preview deployments.

| Variable                                                                         | Where                                                         |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, mapped in `vite.config.ts`) | client bundle: Realtime transport |
| `VITE_HIDE_UNREVIEWED`                                                           | client: hide unreviewed labels by default; playable-pool eligibility still requires approved names and audio |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | `api/_lib/redis.ts`                           |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_URL` (optional, regional) | `api/_lib/qstash.ts`                     |
| `POSTGRES_URL` (pooled; `prepare: false`, `max: 1`)                              | `api/_lib/db.ts`                                              |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`                                      | Storage signed upload URLs                                    |
| `REVIEW_CODE`                                                                    | `/api/review/*` and token HMAC                                |
| `ADMIN_CODE`                                                                     | read by `env.ts`, but no route uses it yet                    |
| `PUBLIC_ORIGIN` (optional)                                                       | canonical origin for job URLs and signature checks            |
| `E2E_DEV`, `LOADTEST_PORT`, `LOADTEST_BASE_URL`, `CI`                            | test tooling                                                  |

One-time setup: apply `supabase/migrations/0001_init.sql` (`supabase db push` or the SQL editor), then provision Upstash Redis and QStash from the Vercel Marketplace and run `vercel env pull .env.local`. The daily `rollup-metrics` schedule, if wanted, is a QStash cron on `/api/jobs/rollup-metrics`.

**Degrading.** With no Supabase vars the app uses LocalTransport (same browser only). Without Redis, `/api/rooms` returns 503: the host plays on "unverified" and phones use TOFU. Postgres, QStash and Storage are not on the play path.

## 8. Room capacity and timing constants

These are summarised here; [protocol.md](protocol.md) has the full detail. Max 20 roster seats (the host's "Jugar también" seat counts) and min 2 to start. Speed is 6–20 s per call, with presets 14/10/7 and a default of 10. The lobby is rebroadcast 300 ms after a change and every 10 s; `round` + `lobby` every 10 s during play. A seat missing from presence for more than 4 s is dropped from the roster.

## 9. Testing

- `pnpm check`: ESLint/Prettier, app/API/loadtest typechecks, Vitest, content validation, copy lint and relative Markdown links.
- `pnpm design-lint`: token enforcement; theme parity and contrast are also covered by Vitest.
- `pnpm build`: card-art index, TypeScript, Vite/PWA, prerender, audio inventory, SEO and final precache checks.
- `pnpm e2e`: Chromium phone/tablet/laptop flows over LocalTransport, axe accessibility, offline host calling, PDF download after connected use, and solo CLS measurement. These same-browser LocalTransport tests do not replace an isolated-browser production Supabase smoke check. Helpers follow the name → language → room join flow and automatic calling.
- `pnpm exec tsx loadtest/run.ts --players 20 --rooms 3 --transport local`: real local transport/signature exercise with headless bots. It checks spelling picks, scores, closed cards, automatic completion and attack probes. Local throughput is not a certification of a Supabase plan limit.
- Frozen-pool integration tests exercise twenty 8×8 boards from 144 cards, mixed-language 54-card capacity, legacy save restoration, late-language fallback and disabled unsupported gear choices. `pnpm test:replay-storage` checks browser durable counter behavior across tabs/reload.
- `pnpm verify:release`: requires a clean committed tree, runs the check/design/build/e2e gates, then detects generated-file drift before push/deploy.

See [maintenance evidence](maintenance-2026-10-27.md) for this pass and [backlog](backlog.md) for remaining work.
