# Existing-game maintenance — 2026-10-27

Scope: stabilize the existing 54-card game. The 144-card expansion and additional languages remain on hold at the owner's request.

## Findings and changes

- The last production build failed on an unknown ESLint rule in `CardFace`. The next local failure was the case-insensitive `CardArt`/`cardArt` module-name collision. Both are fixed; the existing illustrations now render through the shared picture component, with SVG and emoji fallbacks.
- Browser tests were written for the old home/join flows and manual calling. They now enter the organiser name, choose display mode, complete the two-step join flow, and verify automatic calling. Browser accessibility checks exposed and fixed the ES/EN button accessible-name mismatch.
- Late and reloaded phones receive closed-call history and current scores. Repeated current-call broadcasts preserve an in-progress answer.
- Signed host frames now use version 2 envelopes with persistent, atomic sequence counters. Previously accepted replays are rejected, including after page reload. Existing rooms must reload every screen together; clearing protection storage requires a new room/key.
- Names share a 24-character limit across home, join and the wire schema. The host lobby displays one room code.
- Home, SEO, manifest, machine-readable description and credits reflect phone-based multiplayer, separate printable boards, actual audio engines and unverified Indigenous-name references. Copy lint rejects the forbidden framing word and no longer exempts forbidden home-page phrases.
- Content/import failures have a bilingual recovery screen and reload action; malformed content still fails build-time validation.
- The load-test bots and reference host now follow spelling picks, call-window closure and automatic full-card completion. Reports distinguish local delivery measurements from unverified Supabase quota claims.
- High-contrast, border-width and called-text tokens are recorded in the token source and checked for parity. Browser theme-color follows the selected theme, including temporary contrast mode.
- Release verification includes lint, types, unit/content/copy checks, design lint, production build and browser tests on the exact committed tree (`pnpm verify:release`).

## Platform inspection

The checkout is linked to Vercel project `talachadev/app.loteria.to`, configured for Vite and Node 24. CLI versions at inspection: Vercel 64.5.0, Supabase 2.122.0. The Vercel Git integration is active: the failed deployment logs identify commit `8175b7d` on `main`.

The Supabase CLI and connector account listings do not include this project's database. The configured pooled database connection does work. Read-only inspection confirmed all seven expected public tables exist with RLS enabled, and the `audio-pending` and `audio-masters` buckets are private. There is no `supabase_migrations.schema_migrations` table: the schema exists, but CLI migration history is not established. Do not blindly push the existing SQL migrations without reconciling this state.

## Remaining external work

- Dictionary citations and native-speaker review remain incomplete; public credits now say so. Existing `approved` flags are not proof of such review.
- Spanish pronunciation acceptance needs a Spanish-speaker listening review. Regeneration alone is not approval.
- Physical-phone/screen-reader verification and Supabase plan/quota confirmation remain separate from Chromium emulation and local load tests.
- Code/content licence choices require the owner. Native recordings and commissioned art require contributors.
- The backlog retains uncompleted product features and technical work; this maintenance pass does not mark them delivered.

## Verification evidence

- All 36 baseline browser flows passed across phone/tablet/laptop after test repairs. The added solo layout-shift check also passed all three sizes (CLS < 0.1), with screenshots in Playwright output.
- The protected local load test (20 people × 3 rooms) passed; all three replay probes were rejected (`replayOfSignedFrameAccepted: 0`). Its JSON report is generated under `loadtest/reports/` and intentionally ignored by Git.
- Chromium verified atomic allocation across tabs, receiver duplicate rejection, host-key reuse after reload and fail-closed unavailable IndexedDB. Unit suites cover signing order, tampering, sequence validation and explicit legacy protocol errors.
- Remaining Supabase fan-out/quota work (DEBT-003) is not solved by a local load-test pass.
