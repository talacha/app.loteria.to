# 0007. All five languages are treated as verified for v1.0

- **Status:** Accepted (provenance follow-up: backlog DEBT-014)
- **Date:** 2026-10-26 (`1840dba`)

## Context

The original plan hid Náhuatl, Maya and Quechua until native speakers approved each word (`VITE_HIDE_UNREVIEWED`, "pendiente de revisión" badges). The decision is that every language is always offered and sung, with no "pending review" label. No native-speaker review has happened yet.

## Decision

- Every name in all five languages has `status: "approved"` in `cards.json`, so `callableLangs()` offers all five.
- The UI never shows "pendiente de revisión" during play.
- The `source` field still says "unverified draft" for all 162 Indigenous names; that provenance is kept honestly in the data.

## Consequences

- The full five-language experience ships.
- The status field no longer means "a native speaker approved this". Public copy and credits must not claim dictionary citations or native review that do not exist yet (backlog BUG-005).
- Closing the gap (dictionary source per word, native review, regenerated clips) is tracked as backlog DEBT-014.
