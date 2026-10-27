# Pending solo UI work — 2026-10-27

Documentation only. The owner explicitly requested that these fixes be recorded for a later session, not implemented now.

## Layout enhancement from the annotated screenshot

Tracking: [GitHub issue #3](https://github.com/talacha/app.loteria.to/issues/3).

Reference: [original annotated screenshot](design/solo-layout-request.png).

The annotation numbers identify components, not a single vertical sequence. The requested desktop layout is a prominent board in the main region, a sidebar ordered **1 → 2 → 4**, and history **5** beneath both columns.

| Annotation | Current component | Requested placement |
| --- | --- | --- |
| 1 | Current called-card picture, replay button, personal points, synthetic-voice notice and timer | Keep in the sidebar, at its top. Make the card taller so the art has more vertical space. |
| 2 | Three spelling-answer choices | Move to the sidebar directly below component 1. |
| 3 | “Tu tabla” board, heading and remaining-square count | Move into the main region and show it first, giving it visual priority. |
| 4 | “Tabla de puntos” leaderboard | Move to the sidebar below component 2. |
| 5 | “Ya cantadas” history strip | Keep at the bottom, spanning the full width of the main region and sidebar. |

```text
Existing header / game controls
+---------------------------------+-------------------------+
| MAIN: 3. Player board            | SIDEBAR: 1. Taller call |
| Heading + remaining squares     |          2. Answers     |
|                                 |          4. Leaderboard |
+---------------------------------+-------------------------+
| 5. Called-card history — full width                        |
+-----------------------------------------------------------+
```

### Implementation handoff

- Primary files: `src/app/solo/SoloGame.tsx` and `src/app/solo/SoloGame.module.css`. Reuse `Tabla`, `Leaderboard`, `HistoryStrip`, `CardArt`, `ProgressBar` and existing tokens.
- The screenshot describes the desktop layout. Exact sidebar width, taller-card height and mobile stacking details are not specified. Resolve those when implementing; preserve board priority and a usable answer/replay flow on small screens.
- The feedback/pause strip has no numbered relocation instruction. Keep its state visible and associated with answering; do not remove it or mistake it for history.
- Preserve the top controls, all language settings, pause/resume, speed selection, audio replay, scores, markings, round state and exit behavior.
- Do not copy the screenshot's Quechua/54-card session into fixed product settings. The layout must support all available languages and 3×3 through 8×8 boards.
- Validate desktop main/sidebar placement, sidebar order 1 → 2 → 4 and full-width bottom history. Check 390, 768 and 1280px, keyboard/reading order, long words, paused/running feedback, large boards and no horizontal page overflow.

## Open bug: cannot select boards larger than 5×5

Tracking: [GitHub issue #2](https://github.com/talacha/app.loteria.to/issues/2).

The owner reports that sizes above 5×5 cannot be selected at <https://app.loteria.to/solo>. Fresh Spanish-session checks succeeded for 8×8, so they do not reproduce the owner's session or close this report.

The attached screenshot shows Quechua (Cusco-Collao) and “Carta 14 de 54.” That is evidence of a 54-card language session in this screenshot, not proof that the reported setup failure used the same session. Such a pool intentionally cannot fill 64 unique squares. Investigate saved spoken language versus UI language, legacy `loteria:solo:lang`, `loteria:profile`, and stale PWA/service-worker assets.

Acceptance: reproduce the actual blocked session; selecting Spanish/English spoken language must unlock and start 6×6, 7×7 and 8×8 without clearing storage or reloading. Legitimate restrictions must explain why and how to choose a supported voice. Preserve unique cards and coverage requirements. Add the discovered persisted-session regression to `e2e/solo-grid.spec.ts` and check mobile, desktop and an installed PWA.

## Other pending handoff: Cabécar and Ngäbere

The owner's latest direction is to rely on TTS without requiring speaker review. This supersedes the speaker-review prerequisite previously recorded in decision 0026 and the readiness report; it does not authorize fabricated translations or claims of native validation. Future implementation should use sourced words and clearly labeled synthetic, unreviewed voices. Missing vocabulary remains unresolved. Both models and the private review pack are prepared, but neither new language is publicly enabled. No language activation is part of this documentation-only change.
