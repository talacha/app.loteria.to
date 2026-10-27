# 0007. All five languages are treated as verified for v1.0

- **Status:** Accepted, with an open follow-up (backlog DEC-001)
- **Date:** 2026-10-26 (owner decision, recorded in `1840dba`)

## Context

The original plan hid Náhuatl, Maya and Quechua until native speakers approved each word (`VITE_HIDE_UNREVIEWED`, "pendiente de revisión" badges). César asked that every language always be offered and sung, with no "pending review" label. No native-speaker review has happened yet.

## Decision

- Every name in all five languages has `status: "approved"` in `cards.json`, so `callableLangs()` offers all five.
- The UI never shows "pendiente de revisión" during play.
- The `source` field still says "unverified draft" for all 162 Indigenous names; that provenance is kept honestly in the data.

## Consequences

- The full five-language experience ships.
- The status field no longer means "a native speaker approved this". Public copy and credits must not claim dictionary citations or native review that do not exist yet (backlog BUG-005).
- Closing the gap (dictionary source per word, native review, regenerated clips) is the top open decision.
