# Rules: how a round is played (v2.1)

**Authority:** owner direction, 2026-10-26. This file is the build contract for everything behind the game boundary (`src/engine`, `src/app/game`). César's `docs/reglas.md` is consolidated into §9 with conflicts marked; **where they disagree, this file wins.** Lines marked **[Assumption]** fill gaps and can be changed by the owner. Changes between versions are listed at the end ("Delta").

> **Agents: read §0 first.** If your task touches an area that has an **OPEN** decision in §0, stop before writing code for it. Show Rob that decision exactly as written (question, options, recommendation) and wait for his answer. Do not pick an option yourself. When Rob answers, change the row to **DECIDED (Rob, date): option** and apply it in §1–§8. Bugs in §0.2 can be fixed without asking.

## 0. Decisions Rob has to take, and known bugs

### 0.1 Open decisions (recommendation from César's side)

Each row merges a §9.4 conflict with César's position. "Rec." is the recommendation; it mostly keeps what v2 already built, except where v2 breaks its own rules.

| # | Status | Question | Options | Rec. | Why |
|---|---|---|---|---|---|
| D-1 | **OPEN, blocks demo** | The 162 Náhuatl/Maya/Quechua names in `cards.json` have `source: "… unverified draft"`, and several notes say "from memory; page not checked". §2.4 and §2.6 say every word comes from a cited dictionary. How do we make that true? | **A.** Switch to César's deck (`git show 8c96117:src/content/cards.json`): every word has a dictionary URL, 162 MMS clips exist, but no illustrated art for 31 ids. **B.** Keep Rob's deck and art; replace each Indigenous word with a dictionary-sourced word and its URL (César's research already covers 23 shared ids = 69 words; the other 31 ids need the same research), then regenerate those MMS clips. **C.** Keep the deck as is and change §2.4 to say the words are unverified drafts. | **B** | Rob's deck, art and audio are already wired; B keeps all of that and makes §2.4 true. C breaks R-02 ("never invented") and the "verified" claim in §2.3. |
| D-2 | OPEN | Win condition: full card only, or César's 8 figures + "Sorpresa"? | **A.** Full card today, figures later as an organiser option. **B.** Figures now. | **A** | Already built; figures can come back without breaking anything. |
| D-3 | OPEN | Who counts as "first" for the 2 points, given Wi-Fi latency? | **A.** Picks within ~300 ms of the first also count as first. **B.** Strict arrival order. | **A** | Keeps 2/1 points and removes most of the latency unfairness César objected to. |
| D-4 | OPEN | Points vs "no points, no ranking" (R-41, R-43). | **A.** Points last one round only, no cross-round ranking, copy passes §7.8. **B.** Remove points. | **A** | Points only break ties; nothing carries over. |
| D-5 | OPEN | Marking: spelling picks + automatic crossing for everyone, or César's Jugar/Practicar tapping on the tabla? | **A.** Spelling picks (built). **B.** Tap on the tabla. | **A**, with §3.6 enforced | Built and it is the language exercise. The choice panel must never cover the tabla (§3.6, R-45). |
| D-6 | OPEN | One spoken language per player, or César's "Escucho" + "Entiendo"? | **A.** One spoken language + UI language (built). **B.** Two content languages. | **A** | Meets request 2 (change any time, §2.7). Add an optional gloss in the UI language after the reveal. |
| D-7 | OPEN | After a valid lotería: new boards, or same tabla with "Seguir / Terminar"? | **A.** New boards (built). **B.** Same tabla. | **A** | Determinism is unchanged; simpler for the contest. |
| D-8 | OPEN | es/en audio: MMS clips or browser voice? | **A.** MMS for all 5, browser voice only if a clip is missing (built). **B.** Browser voice for es/en. | **A** | Same voice quality across languages; works offline. |
| D-9 | OPEN | Room size: 2–20 with "Esta sala está llena", or PRD's 40? | **A.** 2–20 today (built). **B.** 40. | **A** | Update the PRD to say 40 is a later goal. |
| D-10 | OPEN | Can the organiser end a round early ("Terminar ronda")? | **A.** Yes: add `end.reason: 'ended'` to §8. **B.** No early end. | **A** | The host UI already shows "Terminar ronda"; §8 only allows `'full-card'`. |
| D-11 | OPEN | Which document wins? | **A.** rules.md is the single build contract; reglas.md keeps the R-xx test ids; both owners change rules only through §0. **B.** reglas.md wins. | **A** | One contract avoids agents following two files. Requires that §0 decisions are actually taken. |
| D-12 | **OPEN, affects demo** | Paper / printing. César's request 5 removes printed tablas from today's scope, and §1.6 says "no printed or paper tablas", but §6 keeps `/print`, and the home, join and host screens still offer paper ("Imprimir tablas", "Tengo una tabla de papel", "¿Sin teléfono? Imprime tablas", "Revisar tabla de papel"). | **A.** For the contest, hide every paper/print entry point from the online flow (keep the code and `/print` route unlinked); bring it back as a separate classroom mode later. **B.** Keep paper visible. | **A** | Matches request 5 and §1.6; the inclusion story today is "five languages on any phone". Then update PRD §1 goal 2 and §3.4. |
| D-13 | OPEN | Signed commits: César's commits are unsigned and were removed once (`43b560c`). | **A.** Accept César's unsigned commits. **B.** César sets up signing before his next push. | Rob decides | Process, not a game rule. |

### 0.2 Known bugs (fix without asking)

| # | Bug | Rule it breaks | Fix | Done when |
|---|---|---|---|---|
| B-1 | The home tagline says "El bingo de imágenes…" / "The picture bingo…" (`src/app/home/strings.es.json`, `strings.en.json`). | §7.8 (R-33) | Say "La lotería de imágenes con la que todos crecimos, cantada en cinco idiomas." / "The picture lotería everyone grew up with, called in five languages." Remove "no hace falta ningún teléfono" / "no phone is required" (contradicts §1.6). | `grep -rni bingo src` returns nothing |
| B-2 | `scripts/copy-lint.ts` does not ban "bingo", although §7.8 says a copy lint enforces it. | §7.8 | Add `bingo` to the banned list, whole word, case-insensitive. | A test fixture with "bingo" fails `pnpm copy-lint`; `pnpm check` runs it |
| B-3 | §2.4 says every Indigenous word has a cited dictionary source; all 162 say "unverified draft". | §2.4, §2.6, R-02 | Resolve D-1. Until then, §2.4 is marked **not met**. | Every `nah`/`yua`/`quz` name has a `source` that is a URL or a full bibliographic reference with page |
| B-4 | §4.2 said "the spelling is never shown during the call", but §5.1 shows three spelled choices during the call. | internal | Reworded in §4.2 (this version). | — |
| B-5 | Home copy still describes figures ("Quien completa la figura…") although v2 is full card only. | §7.1 | Say "Quien llena su tabla dice ¡Lotería!…" until D-2 is decided. | Home copy matches §7.1 |

## 1. Players and rooms

1. A room is created by **quien organiza** (the organiser). Creating a room **generates a room code by default** that is not currently in play (reserved in Redis via `/api/rooms`; offline fallback: random code).
2. A round can start with **at least 2 players** and holds **at most 20**. A 21st player who tries to join sees "Esta sala está llena" and is offered **"Crear una sala nueva"**.
3. **Solo mode:** one player against an autonomous **CPU player** on the same device, no network needed.
4. The organiser's device runs the cantor screen. **[Assumption]** It does not hold a tabla; to play, the organiser also joins from a phone.
5. The host (cantor device) is the **only authority**: it shuffles, calls, scores and decides who completed. Phones only show and ask. (R-08)
6. **One tabla per phone.** Everything is played on screens; there are no printed or paper tablas. (R-07, D7)
7. **Names:** free text, 1–24 characters; duplicates allowed. Names never leave the cantor and are not stored on any server. (R-29)
8. **Rejoin:** the same phone (same tab or reload) gets back its tabla, crossed squares, points and languages. (R-27)
9. **Late join:** a player may join mid-round; they get their tabla and the list of cards already called, and those cards are already crossed on their tabla. **[Assumption]** They start at 0 points. (R-26, adapted)

## 2. Languages (per player)

1. **UI language** — Español or English — for menus, buttons and messages. Per player, local, changeable any time.
2. **Spoken language** — Náhuatl, Maya yucateco, Quechua (Cusco-Collao), Español or English — what the cantor speaks to **that** player, the spelling of their **three choices**, and the words revealed on **their** board. Per player, local, independent of the UI language (e.g. UI in Spanish, spoken Náhuatl to practise it).
3. All five languages are treated as **verified** (owner, 2026-10-26). No "en revisión" tags. Audio is pre-recorded Meta **MMS-TTS** (CC-BY-NC 4.0, non-commercial) for all 54 cards × 5 languages; the UI may show a small "voz generada por IA" note.
4. **Words are sourced, never invented.** Every Náhuatl, Maya and Quechua name comes from a cited dictionary (`source` in `cards.json`). (R-02, D1) **Status: not met yet** — see §0 D-1 and B-3.
5. **Varieties:** Náhuatl = Huasteca oriental (`nhe`), modern spelling without macrons; Maya = yucateco (`yua`); Quechua = Cusco (`quz`). (D2, D3)
6. The deck only holds cards that have a sourced word in all five languages, so **all five are always offered and always sung with a voice**. No language is hidden or shown only as text. (R-03, R-46, D4) The "sourced word" half depends on §0 D-1.
7. Changing the spoken language mid-round keeps the tabla, crossed squares and points. The next call (and "Otra vez") uses the new language. (R-32, adapted)
8. **Credits** screen: names Meta MMS-TTS as the voice source and lists the dictionary sources. The CC-BY-NC 4.0 attribution requirement makes this mandatory. (R-31, adapted)

## 3. The board

1. Each player gets a **randomly generated 4×4 tabla** (16 distinct cards from the 54), with **at most 5 cards from any one category**. (R-04)
2. The board shows **icons only, no words**. A square's word (in the player's spoken language) is revealed **once that card has been called**, whether the player guessed right or not.
3. **Deck:** 54 cards, ids 1–54, in 6 categories, defined in `src/content/cards.json` (Rob's deck; owner decision 2026-10-26). César's `catalogo.md §B` is a reference only. No human figures and no gendered human roles. (R-01)
4. **Determinism:** the same `seed` and `tablaIndex` give the same 16 cards, in the same order, on every device. (R-05, partly; see §9)
5. **Similarity cap:** when dealing, the host skips any `tablaIndex` that shares more than 8 cards with a tabla already dealt in the room. (R-06, adapted to 20 players)
6. **The tabla is always visible.** No mode, setting, toast, choice panel or animation hides it or covers it completely; only the end-of-round screen may. Only the _called card_ may be hidden ("Practicar de oído", §4). (R-45)

## 4. The automatic cantor

1. The cantor is **always the app's automatic voice**, never a person. After **Empezar** it draws a card every call interval (speed set by the organiser; the organiser can pause/resume).
2. For each call every device **shows the card's picture** and plays the word in **its own** spoken language. During the call the called card's word is **never shown as a label**; it appears only as one of the three spelling choices (§5.1), unmarked. The host sends the card, not the text. (R-34; R-15's "Escucha" is therefore always on)
3. **No one can predict the next card:** the deck order comes from a host-only `deckSecret` that never leaves the host. `round` carries only `seed`. (R-09)
4. Each card is called **at most once** per round. (R-10)
5. **Speed:** 6–20 s. The interval starts **when the call's audio ends**, not when it starts. (R-12, adapted: timed on the host)
6. **Repeat** says the current card again without advancing or adding it to the called list. A paused round calls nothing. There is no manual "next". (R-13, adapted)
7. **Cantor device speaker:** may say a verse before the name in es/en ("Normal") or just the name ("Rápido"). It may rotate its own language `es, en, nah, yua, quz`. This affects only the cantor speaker, never the phones. (R-11, R-14, adapted)
8. **Phones:** say only the name. A new call cuts off the previous audio. The "Otra vez" button replays the name in the spoken language as often as wanted. (R-36)
9. **"Oír en mi teléfono"** is on by default, with the hint "Usa audífonos". The join tap unlocks audio in the browser. When the toggle is off, the phone still shows the card. (R-35)
10. **"Practicar de oído"** (local, default off, remembered in localStorage) also hides the called card's _picture_. The tabla stays visible. When the call closes, the card is revealed in the history. (R-15, adapted)

## 5. Picking (spelling)

1. **Every player** gets **three spelling choices** — the correct card's word and two other cards' words — spelled in their own spoken language. All players get the **same three cards** in the same order for a call. **[Assumption]** Players pick even if the card is not on their tabla.
2. Points per call: **first correct pick = 2 points**, every **other correct pick = 1 point**, wrong = 0. "First" is decided by the host in arrival order.
3. A wrong pick dims that choice and shows a gentle "¡Casi!"; one more try is allowed within the call window (a correct second try still earns 1 point if not first). **[Assumption]**
4. Practice feedback: a correct pick shows "¡Eso!". After the second wrong try, the correct choice is highlighted and the card goes on the player's "para repasar" list. (R-39, adapted)

## 6. Printing (classroom mode only) — OPEN, see §0 D-12

The online game does not print cartones; online multiplayer is the priority (owner, 2026-10-26). Printed paper boards (`/print`) are a separate, alternative **classroom** mode, kept as is and outside the online flow.
## 6b. Crossing off

1. **Everyone who has the called card on their tabla crosses it off — whether they guessed right, wrong, or not at all.** **[Assumption]** for "not at all": crossed at the end of the call window.
2. Crossed squares show a bean and reveal their word.

## 7. Winning

1. The **first player to complete their whole card** (all 16 crossed) wins; the host detects it when the call that completes a card closes (players may also tap ¡Lotería!).
2. **Simultaneous wins** (completed on the same call): the player with **more points** wins; equal points share the win.
3. Then everyone sees the ¡Lotería! screen; "Otra ronda" starts a new round with new boards in the same room.
4. The cantor screen shows the completing tabla(s), with words in the cantor's language. (R-22, adapted)
5. A ¡Lotería! tap on an incomplete card shows "¡Casi!" and the missing cards, with no penalty. Repeat taps within 3 s are ignored. (R-20, adapted)
6. A player who did not complete sees "Esta vez no fue. ¡Otra ronda!", with no penalty. (R-43, copy only)
7. **Practice summary**, shown only on the phone (never sent to the host or a server): words heard, correct on the first try, and the "para repasar" list with picture and word. (R-41, adapted)
8. **Copy/tone:** screen text never says ganar, ganaste, ganador(a/es), premio(s), apuesta, apostar, dinero, fichas, win(s), winner(s), won, prize(s), bet(s), betting, money, chips or **bingo**. Use "¡Lotería!", "completaste" and "frijoles". A copy lint enforces this (it does not ban "bingo" yet: §0 B-1, B-2). Code identifiers such as `winners` are not screen text. (R-33)

## 8. Protocol (binding for `src/engine` and `src/net`)

- host → all `round{seed, roundNo, speedSec, hostKey}`; host → seat `assign{seat, tablaIndex, roundNo}`; board = `tabla(seed, tablaIndex)`.
- host → all `call{roundNo, i, cardId, choices:[CardId,CardId,CardId], at}` — `choices` from `choicesFor(seed, roundNo, i, cardId)`; clients render each choice's word in their spoken language. No `lang`, no word on the wire.
- player → host `pick{seat, roundNo, i, cardId}` (max 2 per call per seat).
- host → all `pickResult{roundNo, i, seat, correct, points: 0|1|2, first}`; host → all `scores{roundNo, points: Record<seat, number>}`.
- host → all `callClosed{roundNo, i}` (window over; clients cross the card off if on their tabla and reveal its word).
- host → all `end{roundNo, winners, reason: 'full-card'}`. Lobby: `lobby{status: 'waiting'|'started'|'full', players, hostKey}`; Empezar enabled only with ≥ 2 players; the host rejects the 21st `hello` with `lobby{status:'full'}`.
- All host messages are signed (ECDSA, TOFU), as today.

## 9. César's reglas.md (consolidated)

_Every R-xx rule (§9.2) and D-decision (§9.3) from `docs/reglas.md` v1 is marked **Adopted** (with its place in §1–§7, tagged `(R-xx)`), **Adapted** (with how), or **⚠ Conflict** (with what this file says instead). §9.4 lists the conflicts to resolve with César._

### 9.1 César's decisions doc (`docs/decisiones-rules-vs-reglas.md`, 2026-10-26)

César's doc compares rules **v1** (`2163db0`) with reglas.md v1 (`b8ba34e`). This table shows which way **v2** (this file) goes for each decision. "A" is César's option.

| # | Decision | v2 goes | Where in v2 |
|---|---|---|---|
| 0 | Which document wins | **B**: rules.md wins | header |
| 1 | Deck (Rob's vs César's `catalogo.md` §B) | **B**: Rob's deck (`src/content/cards.json`), all five languages treated as verified (owner, 2026-10-26). César's `catalogo.md` and his MMS clips for ids not in our deck stay in the repo as reference only | §2.3, §3.3 |
| 2 | Languages offered | **A**: all five, always; no "en revisión" | §2.3 |
| 3 | Audio | **A, extended**: MMS pre-recorded for all 54 × 5, es/en included (César: browser voice for es/en) | §2.3 |
| 4 | How a card is marked | **Neither.** Every player picks from three **spelled words** (not drawings), even if the card is not on their tabla; crossing off is automatic | §5, §6 |
| 5 | Is the called picture shown | **A**: the picture is shown and the spelling is hidden during the call. "Practicar de oído" (per player, off by default) also hides the picture; the tabla is never hidden | §3.6, §4.2, §4.10 |
| 6 | Points and ties | **B**: 2 / 1 points; simultaneous wins go to more points, equal points share | §5.2, §7.2 |
| 7 | After a valid lotería | **B**: ¡Lotería! screen, "Otra ronda" deals new boards | §7.3 |
| 8 | Figures | **Neither**: full card only (César: 8 figures + Sorpresa; v1: 4) | §7.1 |
| 9 | Player language | **Adapted A**: two per-player languages, UI (es/en) + spoken (5), not "Escucho / Entiendo". Both can change mid-round without losing tabla, crossed squares or points | §2.1, §2.2, §2.7 |
| 10 | Cantor controls | **Partly A**: automatic, interval timed from the end of the audio, with pause/resume, speed and **Repeat**. There is no manual "next" | §4.1, §4.5, §4.6 |
| 11 | Paper tablas | **A**: one tabla per phone, no paper. PRD §1 goal 2 and §3.4 still require paper | §1.6 |
| 12 | Network messages | Follows 4, 6 and 7: `pick` / `pickResult` / `scores` / `callClosed` | §8 |
| 13 | Additions from rules.md | **Adopted.** The host detects a full card and players may also tap ¡Lotería! (§7.1). Distractors are seeded and the same for everyone (`choicesFor`, §5.1, §8) | §5.1, §7.1, §8 |
| 14 | Signed commits | Process, not a game rule; out of scope here | — |

Points of agreement still hold in v2: host is the only authority (§1.5), 4×4 tabla of 16 cards (§3.1), "¡Casi!" without penalty (§5.3), deck order from a host-only `deckSecret` (§4.3). Auto-mark is now the rule for everyone (§6.1). Escucha's "hide the text" has become "the spelling is never shown during the call" for every player (§4.2).

### 9.2 Rules R-xx (`docs/reglas.md` v1, `b8ba34e`)

R-23, R-24, R-25 (paper) and R-37 (unrecorded words) are deleted in reglas.md v1 and are not listed. Totals for 9.2 + 9.3: **21 Adopted · 19 Adapted · 9 ⚠ Conflict**.

| ID | César's rule | Status |
|---|---|---|
| R-01 | 54 cards in 6 categories; no human figures or gendered roles | **Adopted** → §3.3 |
| R-02 | Indigenous words "con fuente" from a cited dictionary; never invented | **Adopted** → §2.4 |
| R-03 | All 5 languages are always offered and always sung | **Adopted** → §2.6 |
| R-04 | Random 4×4 tabla, 16 distinct cards, max 5 per category | **Adopted** → §3.1 |
| R-05 | Same seed + index gives the same tabla on every device; **the tabla does not change between rounds** | **⚠ Conflict** (partly). Determinism adopted (§3.4); v2 deals **new boards** each "Otra ronda" (§7.3) |
| R-06 | Skip indices that share > 8 cards with a dealt tabla (sized for 40 players) | **Adapted**: same cap, with at most 20 players (§3.5) |
| R-07 | One tabla per phone | **Adopted** → §1.6 |
| R-45 | 🔒 The tabla is always visible; only the called card may be hidden | **Adopted** → §3.6 (the choice panel must not cover the tabla either) |
| R-08 | 🔒 "El cantor manda": the cantor device is the only authority | **Adopted** → §1.5 |
| R-09 | Deck order comes from a host-only `deckSecret`, never from `seed` | **Adopted** → §4.3 |
| R-10 | No repeats; the round closes after 54 calls | **Adopted** → §4.4 (with 16-card full card, someone always completes before the deck runs out) |
| R-11 | "Normal" = verse + name (es/en); "Rápido" = name only | **Adapted**: cantor speaker only; phones say the name (§4.7) |
| R-12 | Interval 6–20 s, counted from the **end** of the audio | **Adapted**: timed on the host (§4.5) |
| R-13 | Pause, "repetir", "siguiente" | **Adapted**: pause and Repeat kept; no manual "next" (§4.6) |
| R-14 | Rotating cantor language `es, en, nah, yua, quz` | **Adapted**: cantor speaker only (§4.7) |
| R-15 | Escucha mode hides the called card's **text**; local "Practicar de oído" also hides the picture | **Adapted**: Escucha is always on (§4.2); "Practicar de oído" kept as a local toggle (§4.10); there is no `mode` field in `round` |
| R-16 | 8 "figuras" (chorro, cuadrito, cuatro esquinas, centrito, la L, la equis, marco, llena) | **⚠ Conflict**: v2 plays **full card only** (§7.1) |
| R-17 | "Figura sorpresa" drawn by level and announced before the first card | **⚠ Conflict**: there are no figures in v2 |
| R-18 | A lotería is valid if a figure's cards are **called and marked** | **Adapted**: valid = all 16 called; crossing is automatic (§6.1, §7.1) |
| R-19 | "El dormido vale": a late claim still counts | **Adapted**: moot, because the host detects completion at `callClosed` (§7.1) |
| R-20 | "¡Casi!" with no penalty; 3 s cooldown before claiming again | **Adapted**: applies to ¡Lotería! taps (§7.5); wrong picks use §5.3 |
| R-21 | Ties: **all** valid claims count, because "first on the network" is unfair; then Seguir / Terminar | **⚠ Conflict**: v2 breaks ties on points and gives 2 points to the first correct pick **by arrival order** (§5.2, §7.2); the round ends at the ¡Lotería! screen |
| R-22 | The cantor shows the completing tabla, in the cantor's language | **Adapted**: full card, possibly several tablas (§7.4) |
| R-26 | Late join gets the tabla and the called list; auto-mark crosses them | **Adapted**: crossing is automatic for everyone; starts at 0 points (§1.9) |
| R-27 | Rejoin recovers the tabla, marks and languages | **Adopted** → §1.8 (+ points) |
| R-28 | Full room: PRD max 40; ◆ do not build a "sala llena" message today | **⚠ Conflict**: v2 allows 2–20 and shows "Esta sala está llena" (§1.2) |
| R-29 | Names 1–24 characters, duplicates allowed, never stored on a server | **Adopted** → §1.7 |
| R-30 | MMS audio for nah/yua/quz; **browser voice for es/en** | **⚠ Conflict**: v2 uses MMS for all 5 languages (§2.3) |
| R-46 | 🔒 All 5 languages are sung with a voice, never text only | **Adopted** → §2.6 |
| R-31 | Credits name MMS-TTS + dictionary sources (CC-BY-NC attribution) | **Adapted**: MMS now covers all 5 languages (§2.8) |
| R-32 | Two per-player languages, **"Escucho"** (sung) and **"Entiendo"** (tabla names), both changeable mid-round | **⚠ Conflict**: v2 has one spoken language (audio + spellings + board words) plus a UI language (§2.1–2.2). Changing mid-round is adopted (§2.7) |
| R-34 | "Un canto, muchos idiomas": the host sends the card, not the text | **Adopted** → §4.2, §8 |
| R-35 | "Oír en mi teléfono" on by default; "Usa audífonos"; the join tap unlocks audio | **Adopted** → §4.9 |
| R-36 | New audio cuts the old one; phones say the name only; "Otra vez" button | **Adopted** → §4.8 |
| R-33 | 🔒 Banned screen words (ganar, premio, dinero, win, prize, money, **bingo**…); say "¡Lotería!", "completaste", "frijoles" | **Adopted** → §7.8 |
| R-38 | "Jugar": free marking on any square, no instant feedback, optional auto-mark | **⚠ Conflict**: v2 has no manual marking; crossing is automatic and picks get instant feedback (§5, §6) |
| R-39 | "Practicar": instant feedback ("¡Eso!", "Esa no es"), "No la tengo", help on the 3rd miss, "para repasar" | **Adapted**: the spelling pick is the practice; help after the 2nd miss; "No la tengo" is not needed (§5.4) |
| R-40 | Practice never breaks the lotería | **Adapted**: moot, with one mode and automatic crossing |
| R-41 | Practice summary (heard, first-try, para repasar), phone only, no ranking | **Adapted**: kept on the phone (§7.7); the host still shows round points |
| R-42 | Complete the figure and the cantor confirms | **Adapted**: full card, detected by the host (§7.1) |
| R-43 | No penalty: "Esta vez no fue. ¡Otra ronda!"; **no points or ranking**; the tabla is kept | **⚠ Conflict** (partly). Copy adopted (§7.6); v2 has 2 / 1 points and new boards |
| R-44 | The round ends on "Terminar ronda" at any time, or after 54 cards with no winners | **Adapted**: the deck cannot run out without a full card; an organiser "Terminar ronda" would need `end.reason` beyond `'full-card'` (open) |

### 9.3 Decisions D1–D7 and César's six requests

| ID | César's decision | Status |
|---|---|---|
| D1 | Dictionary words "con fuente" + pre-recorded Meta MMS-TTS (CC-BY-NC 4.0) | **Adopted** → §2.3, §2.4 (v2 extends MMS to es/en, see R-30) |
| D2 | Náhuatl = Huasteca oriental (`nhe`), modern spelling, no macrons | **Adopted** → §2.5 |
| D3 | Quechua = Cusco `quz`; Maya = yucateco `yua` | **Adopted** → §2.5 |
| D4 | The deck only holds cards with a sourced word in all 5 languages | **Adopted** → §2.6 |
| D5 | Demo on real phones; Rob sets up Supabase + Vercel | **Adapted**: real phones kept; room codes reserved in Redis (`/api/rooms`); solo mode added (§1.1, §1.3) |
| D6 | Offline (PWA) out of scope today | **Adapted**: no PWA, but solo mode and the room-code fallback work without network (§1.1, §1.3) |
| D7 | Everything is played on the phone (paper rules R-23–R-25 removed) | **Adopted** → §1.6 |

Six requests ("seis pedidos", v0 → v1): (1) the tabla is random 4×4 and always visible → §3.1, §3.6; (2) the spoken language can change at any time → §2.7; (3) never "bingo" → §7.8; (4) no "pendiente de revisión" → §2.3; (5) no paper → §1.6; (6) every language is sung → §2.6. **All adopted.**

### 9.4 Conflicts to resolve with César

_Superseded by §0.1 (v2.1), which keeps one row per conflict with options and a recommendation. Kept here for history._

Most important first; the suggested resolution keeps v2. Numbers in brackets are §9.1 decision numbers.

1. **Win condition: figures vs full card** (R-16, R-17, R-18, R-42; [8]). _Suggest:_ full card for the contest build; bring figures back later as an organiser option.
2. **Fairness of "first"** (R-21 vs §5.2/§7.2; [6]). César rejects arrival order because of Wi-Fi latency. _Suggest:_ keep 2 / 1, but count picks that arrive within ~300 ms of the first as "first" too.
3. **Points vs "no points, no ranking"** (R-43, R-41). _Suggest:_ points last one round only, with no cross-round ranking; check that "puntos" copy passes R-33.
4. **Marking** (R-38, R-39, R-40; [4]). _Suggest:_ spelling picks + automatic crossing for everyone; drop free marking and the auto-mark toggle.
5. **One spoken language vs "Escucho" + "Entiendo"** (R-32; [9]). _Suggest:_ one spoken language; after the reveal, optionally show a gloss in the UI language.
6. **After a lotería: same tabla, Seguir / Terminar vs new boards** (R-05, R-21, R-43; [7]). _Suggest:_ new boards via a new `tablaIndex`; determinism is unchanged.
7. **es/en audio** (R-30, D1; [3]). _Suggest:_ MMS for all 5; use the browser voice only as a fallback when a clip is missing.
8. **Room size 20 vs 40, and "sala llena"** (R-28). _Suggest:_ keep 2–20 with the message; the PRD's 40 is a later goal.
9. **"Terminar ronda" / manual next** (R-13, R-44; [10]). _Suggest:_ no manual next; if an early end is wanted, add `end.reason: 'ended'` in §8.
10. **Deck** (R-01, R-02; [1]). Owner kept Rob's deck. César's MMS clips voice his words, so clips for shared ids are being regenerated from `cards.json`; his clips for ids not in our deck are reference only. _Suggest:_ César reviews our 162 Indigenous words against his dictionary sources and adds `source` links.
11. **Which document wins** ([0]). César asks for reglas.md. _Suggest:_ rules.md stays the build contract, and reglas.md keeps the R-xx test ids.
12. **Paper** ([11]). v2 and reglas v1 (D7) both drop paper, but PRD §1 goal 2 and §3.4 still require it. _Suggest:_ update the PRD.
13. **Signed commits** ([14]). Process, not a game rule. _Suggest:_ Rob decides (A or B in César's doc).

## Delta

### v2 → v2.1 (2026-10-26, César)

**Added**
- Agent instruction under the header: read §0 first; when a task touches an OPEN decision, show Rob the decision and wait; bugs can be fixed without asking.
- **§0.1 Open decisions D-1…D-13**, one row per conflict, each with options and a recommendation. D-1 (word sources) and D-12 (paper) are marked as affecting the demo.
- **§0.2 Known bugs B-1…B-5** with the rule each breaks, the fix and a "done when" check.

**Changed**
- §2.4: marked **not met yet**. All 162 Indigenous names carry `source: "… unverified draft"` (D-1, B-3).
- §2.6: the "sourced word" half now points to D-1.
- §4.2: "the spelling is never shown" became "the called card's word is never shown as a label; it appears only as one of the three choices". This removes the contradiction with §5.1 (B-4).
- §6: heading marked OPEN (D-12).
- §7.8: notes that the copy lint does not ban "bingo" yet (B-1, B-2).
- §9.4: marked superseded by §0.1 and kept for history.

**Unchanged:** every rule Rob decided in v2 (§1–§8 behaviour, §8 protocol) stays as written. This version only adds the decision list, marks what is not met yet, and fixes one internal contradiction.
