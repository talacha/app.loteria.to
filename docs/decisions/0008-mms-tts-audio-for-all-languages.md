# 0008. Meta MMS-TTS clips for all 54 cards × 5 languages (CC-BY-NC)

- **Status:** Accepted
- **Date:** 2026-10-26 (`7da8660`, `2ef1bf1`)

## Context

Rules require every card to be voiced in every language. There are no native-speaker recordings yet. Meta MMS-TTS covers the Indigenous languages; the browser's voice was considered for es/en.

## Decision

- Pre-render every name with Meta MMS-TTS (`facebook/mms-tts-spa`, `-eng`, `-nhe`, `-yua`, `-quz`) via `scripts/generate-audio.py`, stored as `public/audio/{lang}/{id}.m4a` and precached (270 clips).
- Same voice quality in all five languages; works offline; no Web Speech dependency.
- The game says the voices are synthetic and credits MMS on `/creditos`.

## Consequences

- CC-BY-NC 4.0 makes the product **non-commercial** while these clips ship.
- MMS mispronounces some words (e.g. Spanish ó/ñ in cóndor, piña; backlog BUG-006); clips must be regenerated whenever a word changes.
- The Náhuatl voice model is Huasteca oriental (`nhe`) while our spellings are labelled Classical/Central ([0020](0020-nahuatl-variant-and-voice.md)).
- Native recordings can replace clips one by one later.
