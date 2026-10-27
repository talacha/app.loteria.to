# Decision records

Lightweight ADRs for Lotería de los Pueblos. One file per decision: `NNNN-short-title.md` with Status, Date, Context, Decision, Consequences. Superseding a decision means a new record that links the old one; old records are not rewritten.

| # | Decision | Status |
| --- | --- | --- |
| [0001](0001-vite-spa-pwa-on-vercel-prerendered.md) | Vite SPA + PWA on Vercel, prerendered public pages | Accepted |
| [0002](0002-realtime-broadcast-host-authority-signed-messages.md) | Supabase Realtime broadcast, host authority, ECDSA-signed host messages (TOFU) | Accepted |
| [0003](0003-upstash-and-supabase-postgres-only.md) | Upstash Redis + QStash; Supabase Postgres the only database (no Neon) | Accepted |
| [0004](0004-rules-spelling-picks-points-full-card.md) | Rules v2: spelling picks, 2/1 points, full-card win | Accepted |
| [0005](0005-ui-language-separate-from-spoken-language.md) | Per-player app language separate from spoken language | Accepted |
| [0006](0006-keep-the-current-deck.md) | Keep the current deck | Accepted |
| [0007](0007-all-five-languages-treated-as-verified.md) | All five languages treated as verified for v1.0 | Accepted |
| [0008](0008-mms-tts-audio-for-all-languages.md) | Meta MMS-TTS clips for all 54 × 5 (CC-BY-NC) | Accepted |
| [0009](0009-printing-is-a-separate-classroom-mode.md) | Printing is a separate classroom mode | Accepted |
| [0010](0010-rooms-2-to-20-overflow-to-new-room.md) | Rooms 2–20 players, overflow to a new room | Accepted |
| [0011](0011-host-screen-modes.md) | Host screen modes: "Solo pantalla" / "Jugar también" | Accepted |
| [0012](0012-solo-mode-vs-cpu-no-in-browser-llm.md) | Solo mode vs CPU; no in-browser LLM | Accepted |
| [0013](0013-themes-and-design-system-enforcement.md) | Light/dark/high-contrast themes; tokens + design-lint + copy-lint | Accepted |
| [0014](0014-deploy-gate-and-rollback.md) | Deploy gate (`pnpm check && pnpm build`), clean-worktree verification, `vercel promote` rollback | Accepted |
| [0016](0016-rules-md-is-the-single-rules-contract.md) | rules.md is the single rules contract | Accepted |
| [0017](0017-banned-words-and-neutral-copy.md) | No prize/betting/winning words; neutral copy | Accepted |
| [0018](0018-cartones-share-at-most-eight-cards.md) | Cartones share at most 8 cards | Accepted |
| [0019](0019-first-pick-is-arrival-order.md) | First correct pick is decided by arrival order at the host | Accepted |
| [0020](0020-nahuatl-variant-and-voice.md) | Náhuatl: Classical/Central spellings, Huasteca (`nhe`) voice | Accepted |
| [0021](0021-no-hide-picture-practice-mode.md) | No "hide the picture" practice mode in v1.0 | Accepted |
| [0022](0022-durable-signed-frame-sequences.md) | Durable signed host-frame sequences and explicit legacy recovery | Accepted |
| [0023](0023-expanded-catalog-and-language-coverage.md) | 144-card catalog and language-safe room decks | Accepted |
| [0024](0024-painted-paper-brand.md) | Painted ribbon identity and rugged paper background | Accepted |
| [0025](0025-public-search-and-ai-discovery.md) | Public search and AI discovery | Accepted |
