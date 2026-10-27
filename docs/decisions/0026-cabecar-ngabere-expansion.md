# 0026. Cabécar and Ngäbere spoken-language expansion

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The owner selected Cabécar and Ngäbere (Guaymí) from the requested Costa Rican languages after checking dedicated TTS support. Meta provides language-specific MMS checkpoints for both: `facebook/mms-tts-cjp` and `facebook/mms-tts-gym`. A model checkpoint establishes synthesis support, not native-speaker review or coverage of every regional variety.

## Decision

Prepare Cabécar (`cjp`) and Ngäbere (`gym`) as the next two spoken languages. Retain the existing Cabécar model revision and pin the Ngäbere model revision in the audio router. Keep UI languages Spanish and English. This replaces the proposed Bribri/Cabécar and Ngäbere/Mekatelyu pairings in the backlog; Bribri and Mekatelyu remain deferred.

Preserve the publication requirements in [0023](0023-expanded-catalog-and-language-coverage.md): source verification, community review and delivered audio before enabling new content. Do not relabel drafts as approved, substitute Spanish for missing words, or advertise seven playable languages while preparation is incomplete. Existing unreviewed Cabécar words and new Ngäbere research remain outside playable decks. See the [readiness report](../language-expansion-cjp-gym.md).

## Consequences

Dedicated models can generate review samples through the existing Python audio engine. Both checkpoints use the existing MMS CC-BY-NC-4.0 license. A playable release still requires reviewed names and pronunciation for a sufficient shared card pool, followed by UI, content-schema, language-color, print, offline-budget and public-copy updates. The active round must continue to restrict switching to languages covering its entire frozen deck.
