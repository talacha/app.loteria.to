# 0020. Náhuatl names use Classical/Central spellings; the voice is Huasteca (`nhe`)

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

Our Náhuatl names are labelled Classical/Central Nahuatl (Molina, Karttunen). The only MMS-TTS Náhuatl model is Huasteca oriental (`nhe`).

## Decision

- Keep the current spellings and the `nhe` voice. Native recordings can replace clips later ([0008](0008-mms-tts-audio-for-all-languages.md)).
- The credits and language label state the voice model, not just the spelling variant (backlog DEBT-016).

## Consequences

- Some clips may sound slightly off for a Classical/Central spelling.
- Moving to one variant end to end means new words and new clips.
