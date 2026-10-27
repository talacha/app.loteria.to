# Cabécar and Ngäbere readiness

Audit date: 2026-10-27. The selected additions are Cabécar (`cjp`) and Ngäbere (`gym`). Each has a language-specific Meta MMS-TTS checkpoint. That verifies a synthesis route; it does not establish modern spelling, semantic accuracy, local pronunciation or community approval. Public play remains unavailable until those content conditions are met, as required by [ADR 0023](decisions/0023-expanded-catalog-and-language-coverage.md).

## Content actually available

| Language | Original 54 research entries with text | Added 90 research entries with text | Current production names / clips | Approved for these additions |
| --- | ---: | ---: | ---: | ---: |
| Cabécar | 47 | 79 | 47 draft names / 47 synthetic clips | 0 |
| Ngäbere | 14 | 10 | 0 / 0 | 0 |
| Bribri, retained research | 37 | 67 | 37 draft names / 0 clips | 0 |

Counts are entries with non-null text, not counts of accepted translations. Cabécar's original draft contains 39 attested entries, 5 proposed loans and 3 descriptive entries; the remaining 7 are missing. Its expansion research file has 102 entries including 12 reserve IDs; only the 90 IDs in `cards.json` count toward this catalog. Bribri has the same 102-entry research structure. Expansion files have not been imported into production for these languages.

The new `src/content/drafts/gym.json` aligns exactly with all 144 actual card IDs: 24 attested candidate strings with exact printed-page citations, 120 explicitly unresolved entries, no community-approved entries and no production audio. Missing means “not verified in this audit,” never “this language has no term.” All 24 candidates preserve the printed practical spelling; no loans or descriptive forms were constructed. The cited pages were rendered and visually inspected because OCR corrupts diaereses and accents. Historical-source attestation is recorded separately from the remaining review of current usage and pronunciation.

## Verified sources

### Cabécar

- [Meta checkpoint](https://huggingface.co/facebook/mms-tts-cjp), revision `328480db5753278668953a7ed400c265fb469b8f`, is the language-specific TTS model already configured and used for 47 draft clips. Its license is CC-BY-NC-4.0.
- [UCR INIL library](https://inil.ucr.ac.cr/publicaciones/biblioteca-de-linguistica-de-america-central/) lists Margery Peña's 1989 dictionary and records the author's authorization for dissemination. Its linked full PDF currently returns 404. The existing drafts cite an archived copy and individual entry numbers; this audit did not recheck every cited entry.
- [SINABI introduction scan](https://www.sinabi.go.cr/Biblioteca%20Digital/LIBROS%20COMPLETOS/Margery%20Enrique/Diccionario%20cabecar%20espanol/Dicc.%20Cabecar-espanol_espanol-cabecar_pi-Ixx.pdf) is accessible, but these 67 pages are introductory material, not the full lexical section.
- [UCR's publisher sample](https://editorial.ucr.ac.cr/lenguas/item/download/96_182e4273efb37f6164bd6038c83b04be.html) is a limited sample; it cannot verify the whole card vocabulary. [DIPALICORI's bibliography](https://dipalicori.ucr.ac.cr/descripcion-cabecar/) identifies the dictionary and modern orthography references.

The draft mixes general/northern forms with flagged southern forms and Bible spellings. Resolve those differences with a chosen community and orthographic standard. Do not silently drop tone or nasality just because the tokenizer omits a character. The current generator reports unsupported characters and may synthesize without them; that is a pronunciation limitation to review, not a spelling correction.

### Ngäbere

- [Meta checkpoint](https://huggingface.co/facebook/mms-tts-gym), revision `57eb0c7c2757e75b9a006e19de7aa76f2ec935a6`, explicitly identifies Ngäbere TTS. Its license is CC-BY-NC-4.0. The model card alone does not identify its match to a particular Costa Rican community.
- [Lininger Ross 1982, primary PDF](https://archivo.revistas.ucr.ac.cr/index.php/filyling/article/download/16454/15968/32896), DOI [10.15517/rfl.v8i1-2.16454](https://doi.org/10.15517/rfl.v8i1-2.16454), contains a practical alphabet and a provisional dictionary. The new draft cites the practical-orthography column by printed page and PDF page. Publication pages are 137–154; some portal citation exports incorrectly use 2006, while the scanned issue is dated 1982.
- [DIPALICORI's Ngäbere bibliography](https://dipalicori.ucr.ac.cr/descripcion-ngabere/) classifies this source among Costa Rican lexical documentation and distinguishes Costa Rican from Panamanian studies. This supports the documented variety; it does not replace present-day review.
- [Lininger Ross 1981, primary PDF](https://archivo.revistas.ucr.ac.cr/index.php/filyling/article/download/16065/15446) supplies background phonology, with phonological examples. It was not used to convert phonological spellings into new practical forms.
- [Ngäbere Living Dictionary](https://livingdictionaries.app/ngabere) is a promising supplementary source, but its page requests permission before reuse in an app. Its entries were not imported here.

The draft preserves possible ambiguities in notes: a plural bean gloss, multiple house/rain forms and the sea/salt homonym. Review must confirm the exact illustrated referents. Do not reuse a species-specific animal name for another species.

## Local synthesis evidence

Both pinned checkpoints loaded successfully in the project audio runtime and produced a technical sample at 16 kHz. `output/language-expansion/model-preflight.log` records each model, revision, vocabulary size and successful load. `output/language-expansion/synthesis.json` records the inference results:

| Language | Source sample | Duration | Local review file |
| --- | --- | ---: | --- |
| Cabécar | Existing draft `sol` entry | 864 ms | `output/language-expansion/cjp-sol-review.wav` |
| Ngäbere | Visually verified `sol` entry, printed p.152 | 496 ms | `output/language-expansion/gym-sol-review.wav` |

These files are unreviewed technical samples outside public assets. Successful inference establishes that local TTS works; it does not approve either sample's pronunciation or the vocabulary. Production names, clips and public language choices are not changed by these previews.

A local review pack at `output/language-expansion/cabecar-ngabere-review.zip` contains 47 existing Cabécar draft clips, 24 newly synthesized Ngäbere draft clips, and per-language CSV sheets with source citations and blank reviewer/correction fields. All 71 clips remain unapproved. The pack is an ignored local artifact, not a production asset or part of the offline install cache.

## Remaining work and publication gates

1. Select the intended community and writing standard for each language. Recheck Cabécar's per-entry citations and resolve its descriptive forms, proposed loans, dialect differences and missing entries. Continue Ngäbere from accessible primary entries, leaving unmatched cards null.
2. Have qualified community reviewers assess the exact card art, words, everyday/ceremonial context, spelling, collisions and pronunciation. Record the outcome without marking dictionary research as native approval. There is no completed review recorded for either addition.
3. Generate private preview clips only from attested candidate text. Check the tokenizer inventory and have reviewers hear the clips; ASR and signal scores test technical properties, not cultural or linguistic accuracy. Re-record or correct reviewed clips as needed.
4. Import accepted names and their delivered clips, keeping unsupported cards unavailable. A complete 144-word translation is not necessary for a smaller reviewed pool, but all cards in a frozen room deck must be covered by every participating spoken language. Verify grid capacity and avoided pairs for that intersection.
5. Extend public language types, labels, colors, selection settings, credits and factual public language counts together when usable reviewed coverage exists. Run content/audio integrity, type/build checks and game-flow tests before enabling play. Keep unapproved research outside callable language choices.

The present audio checker verifies file/hash/manifest integrity and allowed missing-audio reasons. The generator does not gate synthesis on `status`, `kind` or review. Neither can approve vocabulary. The current `Lang` union and public language list exclude these additions; merely flipping `LANG_PLAYABLE` would not complete the integration or satisfy its publication conditions.
