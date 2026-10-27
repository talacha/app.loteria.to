# 0023. Expand the catalog with language-safe room decks

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The owner authorized production of static assets and the 144-card expansion, superseding the earlier hold. The proposal has 90 Spanish/English names, but the Indigenous-language research is not approved. Publishing candidate translations as verified would misrepresent that work. A shared 144-card catalog also exceeds the old assumption that every language covers every card.

## Decision

Keep the original 54 cards and append the 90 proposed cards, numbered 55–144, with 24 cards per category. No reserve substitutions are made in this release. Produce original illustrated WebP assets and Spanish/English Kokoro clips. Keep new Indigenous candidate text in research drafts; no invented words, copied guesses or synthetic Indigenous clips are published for the additions.

Availability requires an approved name and delivered audio. The original 54 retain their previous approved-name/audio eligibility; this does not establish new evidence for their sources, and DEBT-014 remains open. New Indigenous entries additionally require an attested name or attested loan, provenance and community review before approval.

At round start freeze the intersection of the participating spoken languages’ available cards. Use it for boards, calls, choices and completion; persist and send its IDs. Saved legacy rounds without an explicit deck use the original 54. Preserve the selected grid when possible, otherwise cap it to the shared deck’s capacity. During a round, language switching and late joining must use a language covering the whole frozen deck. Solo uses the same coverage rule.

Card art remains at most 6 MB and the complete install precache stays below 10 MiB, enforced at build time. Keep game pictures and audio offline; print-only dependencies may cache after their first online use. Generated illustrations contain no labels: localized names and numbers remain accessible HTML.

## Consequences

Spanish/English rooms can use 144 cards and larger grids. Mixed rooms retain their common coverage, currently the original 54 for the three existing Indigenous languages. A 144-card catalog is not a claim of 144 approved words in every language. Bribri and Cabécar remain unavailable for play pending their separate review and recording requirements.

The production art list resolves the proposed referents, but native-language review may still reject or distinguish a referent later. High-risk visual pairs require visual review; no cultural review is implied by automated image generation.
