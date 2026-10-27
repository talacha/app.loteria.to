# Backlog

Triaged work on top of the v1.0 baseline ([PRD](PRD.md)). Updated after the 2026-10-27 maintenance pass; completed and superseded items were removed. See [maintenance evidence](maintenance-2026-10-27.md). Game rules: [rules.md](rules.md). Decisions: [decisions/](decisions/README.md).

**Priority:** P0 = broken or blocks shipping safely; P1 = next up, visible to players or a rule/claim we don't meet; P2 = when convenient.
**IDs** are stable; don't reuse them. Close an item by deleting it in the commit that fixes it.

## Summary

| Section | P0 | P1 | P2 | Total |
| --- | --- | --- | --- | --- |
| Bugs | 0 | 2 | 3 | 5 |
| Feature requests | 0 | 2 | 4 | 6 |
| Tech debt | 1 | 2 | 5 | 8 |

## Completed

- **2026-10-27 · Solo boards through 8×8:** made the Spanish/English voice requirement explicit beside the board-size selector and added coverage for larger boards. The 144-card pool supports 64 unique squares; 54-card language pools retain their capacity limits.

- **2026-10-27 · Language settings during gameplay:** synchronized in-game and header preferences, added direct solo-game access to UI and spoken-language settings, and corrected the playing host's voice selection to follow the active deck's language coverage. Language changes preserve the round, board and score; unavailable translations remain disabled for the current deck.

- **2026-10-27 · Public SEO/GEO and crawler guidance:** updated factual summaries for all five public routes, linked deck cards to stable fragments, excluded private and API paths across crawler groups without changing the existing AI crawler allow policy, and documented the implementation in [seo.md](seo.md) and [decision 0025](decisions/0025-public-search-and-ai-discovery.md). No follow-up backlog item remains open.

## Bugs

### BUG-013 · Solo sizes above 5×5 unavailable in the owner's session — P1

- **Tracking:** [GitHub #2](https://github.com/talacha/app.loteria.to/issues/2).
- **Status:** Open; do not treat a successful clean-session 8×8 check as resolution. No fix implemented.
- **Handoff:** [report, hypotheses and acceptance criteria](pending-ui-2026-10-27.md#open-bug-cannot-select-boards-larger-than-55). Investigate persisted spoken-language preferences, capacity messaging and installed-PWA state.

### BUG-006 · MMS clips for "El Cóndor" and "La Piña" mispronounce ó / ñ — P1

- **Why:** The voice is the lesson; a wrong Spanish pronunciation teaches the wrong word.
- **Evidence:** `public/audio/es/condor.m4a`, `public/audio/es/pina.m4a` (listening test); generator `scripts/generate-audio.py`.
- **Accept when:** both clips are regenerated (e.g. with respelled input text) and approved by a Spanish speaker; the generator records any respelling per card so future regenerations keep it; sweep the other 52 es clips and all en clips for the same issue.

### BUG-009 · `nube` art shows rain streaks — P2

- **Why:** "La Nube" should read as a cloud; streaks read as rain and confuse the picture-to-word link.
- **Evidence:** `public/art/nube.svg` (source `design/look-and-feel/art/nube.svg`).
- **Accept when:** streaks removed in both copies; card reviewed in light, dark and high-contrast.

### BUG-011 · Wrong-choice tile and speed slider not verified in a browser — P2

- **Why:** Both were changed for accessibility (state not colour-only, ≥ 3:1 borders) and only covered by jsdom tests.
- **Evidence:** `src/app/ui/game.tsx:181-230` (`ChoiceState 'wrong'`); range inputs at `src/app/host/HostLobby.tsx:207`, `src/app/game/HostGame.tsx:165`.
- **Accept when:** checked on a real phone and desktop in all four themes (keyboard, touch, screen reader announces value and "¡Casi!"); screenshots attached to the PR.

### BUG-012 · Room code may not be unique when the registry is down (rules §1.1) — P2

- **Why:** Rules §1.1 says the code is not in use by any other room. If `/api/rooms` fails (Redis missing or unreachable), the host continues without a reservation and two rooms could share a channel.
- **Evidence:** `src/app/host/useHostRoom.ts:48-61, 213-256` (`'failed'` path proceeds).
- **Accept when:** on `'failed'` the host either retries with backoff and shows a notice, or the host key in the link fragment is enough to keep two rooms with the same code apart (phones ignore frames signed by another key); test covers both.

## Feature requests

### FEAT-008 · Solo board-first layout and reordered sidebar — P1

- **Tracking:** [GitHub #3](https://github.com/talacha/app.loteria.to/issues/3).
- **Status:** Documented for later; owner explicitly requested no implementation now.
- **Scope:** main region = board (3); sidebar = taller called card (1), answers (2), leaderboard (4); called-card history (5) spans the bottom.
- **Handoff:** [annotated screenshot, component mapping and acceptance criteria](pending-ui-2026-10-27.md#layout-enhancement-from-the-annotated-screenshot).

The owner authorized static asset production and the 144-card expansion on 2026-10-27, superseding the earlier hold. New language publication still requires source verification, community review and recordings.

### FEAT-001 · Add Cabécar (`cjp`) and Ngäbere (`gym`) — P1

- **Selection:** owner confirmed this pair on 2026-10-27; see [decision 0026](decisions/0026-cabecar-ngabere-expansion.md). This supersedes the earlier Bribri/Cabécar pairing.
- **TTS ready:** dedicated Meta MMS checkpoints exist for both; model revisions are pinned in `scripts/audio/engines.json`. Both loaded successfully in the local audio runtime. Ngäbere's pinned ASR adapter is also available.
- **Content pending:** Cabécar's 47 imported words remain drafts; Ngäbere has 24 sourced candidates. The owner subsequently authorized TTS-only publication without speaker review; see the [latest handoff](pending-ui-2026-10-27.md#other-pending-handoff-cabecar-and-ngabere). Missing vocabulary must not be invented.
- **Accept when:** sourced words and synthetic clips cover a valid shared deck, selectors and printing work, offline assets stay in budget, and public copy accurately labels synthetic/unreviewed voices and actual coverage. Update the content gate deliberately; neither language is enabled yet.

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

### FEAT-007 · Future Bribri and Mekatelyu support — P2

The owner selected Cabécar and Ngäbere for the next expansion (FEAT-001). Retain Bribri and Mekatelyu as future work. Meta's MMS catalog has no Bribri (`bzd`) checkpoint. The `jam` checkpoint is specifically Jamaican English Creole; it does not establish a native Limón/Mekatelyu voice. Revisit only with sourced vocabulary, suitable recordings or validated synthesis, and community review. Do not relabel Jamaican synthesis as verified Mekatelyu pronunciation.

## Tech debt

### DEBT-003 · O(n²) pick fan-out against the Supabase Free Realtime quota — P1

- **Why:** Every `pick` produces a `pickResult` and a `scores` broadcast to every phone; with 20 players a call costs ~n² deliveries, and loadtest peaks approach the assumed 100 msg/s limit.
- **Evidence:** protocol.md (`pickResult`/`scores` to all); `loadtest/run.ts:407-420` (`peakTxPlusRxPerSec`, quota assumption).
- **Accept when:** results go only to the picking seat (or are batched once per call at `callClosed`), and `scores` is sent once per call; a 20-player loadtest stays under 50 % of the quota; quota numbers confirmed in the Supabase dashboard.

### DEBT-004 · 93 retained former-deck clips in `public/audio` (0.43 MB precached) — P2

- **Evidence:** 85 clips each in `public/audio/{nah,yua,quz}` vs 54 cards; 93 files (429,536 bytes) are not referenced by `cards.json` (decision 0006). Workbox glob `vite.config.ts:52` precaches them.
- **Audit 2026-10-27:** 93 files are absent from active cards, drafts and manifest; 25 of their 31 IDs recur in the held expansion. Decision 0006 explicitly retains them. They were not deleted during existing-game maintenance.
- **Accept when:** reconcile retention with decision 0006, move archival clips out of `public/` or remove them, and make validation reject unreferenced public clips.

### DEBT-009 · Deprecated legacy alias block still in `tokens.css` — P2

- **Evidence:** legacy alias section in `src/app/theme/tokens.css`.
- **Accept when:** remaining uses migrated to current tokens; block deleted; `pnpm design-lint` rejects the old names.

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
- **Evidence:** credits now explain Classical/Central spelling and Huasteca (`nhe`) synthesis. The language picker label still needs a concise variant disclosure.
- **Accept when:** credits and the language label state both the spelling variant and the voice model.

### DEBT-017 · Content licence and code licence — P1

- **Why:** MMS clips are CC-BY-NC 4.0; the repo has no LICENSE, so reuse terms for code, art and words are undefined.
- **Evidence:** no `LICENSE` at repo root; `public/fonts/LICENSES.md` only covers fonts; `src/content/credits.json`.
- **Accept when:** LICENSE file(s) added for code and content, compatible with CC-BY-NC audio; credits page links them.
