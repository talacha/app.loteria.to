# Track G — César: the game

Read [00-SHARED.md](00-SHARED.md) first. Coding agent Sonnet 5.5; adversarial reviewer Sonnet 5.5 in fresh context (prompt in 00-SHARED §6).

Already done and on `main`: rules ([reglas.md](../reglas.md)), figures and deck ([catalogo.md](../catalogo.md)), `src/content/cards.json`, 162 MMS audio files.

| ID | Unit | Push by | Unblocks |
|---|---|---|---|
| G0 | Engine contract stubs + content API | first, ~20 min | Rob types against it |
| G1 | Engine core: shuffle, tablas, figures, claims | after Rob's A0 | Rob A3 |
| G2 | The referee (`hostReduce`) | after G1 | Rob A2 |
| G3 | Player-side rules + verses + copy lint | after G2 | Rob A3 practice UI |
| F1 | Integration fixes (shared, empty on purpose) | end | demo |

Every test is named after its rule: `it('R-18.2 three corners called + fourth marked but not called → ¡Casi!')`. **Each `Dado / Cuando / Entonces` example in reglas.md that the unit cites is a test.**

---

## G0 — Engine contract stubs + content API

**Files:** `src/engine/index.ts` (every export of 00-SHARED §2 with the exact signature; bodies `throw new Error('not implemented: G1|G2|G3')`; `PATTERNS` and `PATTERN_LEVEL` filled from catalogo.md §A now), `src/content/index.ts` (real implementation of 00-SHARED §3 over `cards.json`).

**Done when:** a scratch `tsc --strict --noEmit` over both files passes · `cards.length === 54` · `cardLabel(cardById('cangrejo'), 'quz')` returns `{ text: 'apanquray', aiVoice: true, weak: false }` · `PATTERNS` equals catalogo.md §A cell by cell. Push straight to `main` (no scaffold yet) and tell Rob.

## G1 — Engine core

**Rules:** R-04, R-05, R-06, R-09, R-10, R-14, R-16, R-17, R-18, R-19.

**Spec:**
- `hash32` = FNV-1a 32-bit; `rng(s)` = mulberry32(`hash32(s)`); Fisher–Yates on a copy.
- `deckOrder(deckSecret, roundNo)` uses `rng(`${deckSecret}:deck:${roundNo}`)` over `cards` in `n` order. **Never the public seed (R-09).**
- `tabla(seed, index)`: shuffle with `rng(`${seed}:tabla:${index}`)`, take in order skipping any card whose category already has 5, until 16.
- `pickTablaIndex(seed, taken, startAt = 10000)`: first index ≥ `startAt` not in `taken` whose tabla shares ≤ 8 cards with every taken tabla (R-06).
- Surprise figure: `rng(`${deckSecret}:figure:${roundNo}`)` over the level's figures in `PatternId` order, excluding the previous round's figure when the level has more than one (R-17).
- `checkClaim`: a cell counts when its card is called and, if `marks` was given, marked. `valid` when some figure instance is complete; then `cells` = that instance. Else `missing` = unsatisfied cards of the instance with the fewest gaps (first on ties).

**Done when:** every cited R-xx example is a passing test · `fast-check` properties (≥200 runs): same inputs ⇒ same output; tablas have 16 unique cards and ≤5 per category; `checkClaim` is never valid with an uncalled cell; 40 tablas from `pickTablaIndex` have no pair sharing >8 · a test re-runs the catalogo.md §A simulation (2000 rounds, 40 players) against the real deck and prints mean calls per figure; update catalogo.md if any mean moved by >2 · golden snapshots of 3 tablas and one deck order are committed (drift fails CI).

**Reviewer checks:** `deckSecret` is the only input to `deckOrder` besides `roundNo` · mutate the `≤5 per category` guard and see R-04.1 go red · mutate `checkClaim` to ignore `marks` and see R-18.3 go red · `src/engine/**` imports nothing from React, the DOM or `src/net`.

## G2 — The referee (`hostReduce`)

**Rules:** R-08, R-10, R-11, R-13, R-14, R-17, R-18, R-19, R-20, R-21, R-22, R-26, R-27, R-44, plus the protocol below.

**Spec (pure; `now` comes in the event, never `Date.now()` inside):**
- `startRound` → resolve the figure, compute `order`, `roundNo+1`, status `running`; send `round`.
- `next` → if `called < 54`: `called+1`, send `call{i, cardId, lang (R-14 over LANGS), at: now}`, effect `speak{withVerse: speedSec ≥ 10 && lang in es|en}` (R-11). At 54 → status `ended`, send `end`, effect `roundEnded` (R-44). Ignored unless `running`.
- `repeat` → effect `speak` for the current card, no state change (R-13.2). `pause`/`resume` toggle `running`/`paused`.
- `msg hello` → known seat keeps its index; new seat gets `pickTablaIndex`. Always reply `welcome{…, called}` (R-26, R-27).
- `msg claim` → ignore if <3000 ms since that seat's last claim (R-20). Else `checkClaim` on the host's own `tabla(seed, tablaIndex)` with `marks`; send `claimResult`; effect `claim{cells|missing}`. A valid claim sets `claimPause` and adds the seat to `winners`; during `claimPause` more valid claims are added too (R-21).
- `end` → status `ended`, send `end{winners}`, effect `roundEnded`.

**Done when:** each cited R-xx example is a test driving `hostReduce` with events · property: the sequence of `call.cardId` over a full round is a permutation of the 54 cards · no `send` ever contains `deckSecret` (property over random event sequences) · a full simulated round (host + 3 seats, random claims) runs without throwing.

**Reviewer checks:** `hostReduce` is pure (no `Date`, `Math.random`, I/O: grep) · two valid claims 300 ms apart both end in `winners` (R-21.1) · a claim for a `tablaIndex` that isn't the seat's assigned one is evaluated on the seat's assigned tabla, not the claimed index.

## G3 — Player-side rules + verses + copy lint

**Rules:** R-38, R-39, R-40, R-41, R-33, R-11.

**Spec:**
- `evaluateTap`. **Play mode:** `{mark: true, feedback: null}`. **Practice mode:** current card → `ok`; earlier called → `late`; not called → `wrong`, `mark: false`, `attempts+1`. At the 3rd wrong attempt → `reveal`, which is the current card if it is on the tabla, else `'not-in-tabla'`.
- `evaluateNotInTabla`: if the current card is not on the tabla → `ok`; else `wrong` + `attempts+1` (R-39.4).
- `practiceSummary` per R-41.1.
- Verses: write `verso.es` and `verso.en` (≤90 chars each, original, no human figures) for all 54 cards in `cards.json`. Never write verses in `nah`/`yua`/`quz` (R-11).
- Copy lint `scripts/copy-lint.ts` over `src/app/i18n/locales/**` and `cards.json`, using the R-33 list, whole word, case-insensitive. Rob adds it to `pnpm check`.

**Done when:** each cited R-xx example is a test · the copy lint fails on fixtures containing "ganaste" and "Prize" and passes "ganadería" · `pnpm check` green with the copy lint included · 54/54 cards have both verses.

**Reviewer checks:** in Practice, no input path returns `mark: true` for an uncalled card (property) · Play mode never returns feedback · verses pass the copy lint and contain none of the human-figure words from R-01.

## Notes

_(one short block per finished unit: what was built, deviations, what Rob must know)_
