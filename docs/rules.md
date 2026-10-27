# Rules: how a round is played (v2)

**Authority:** owner direction, 2026-10-26. This file is the build contract for everything behind the game boundary (`src/engine`, `src/app/game`). César's `docs/reglas.md` is consolidated into §9 with conflicts marked; **where they disagree, this file wins.** Lines marked **[Assumption]** fill gaps and can be changed by the owner.

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
4. **Words are sourced, never invented.** Every Náhuatl, Maya and Quechua name comes from a cited dictionary (`source` in `cards.json`). (R-02, D1)
5. **Varieties:** Náhuatl = Huasteca oriental (`nhe`), modern spelling without macrons; Maya = yucateco (`yua`); Quechua = Cusco (`quz`). (D2, D3)
6. The deck only holds cards that have a sourced word in all five languages, so **all five are always offered and always sung with a voice**. No language is hidden or shown only as text. (R-03, R-46, D4)
7. Changing the spoken language mid-round keeps the tabla, crossed squares and points. The next call (and "Otra vez") uses the new language. (R-32, adapted)
8. **Credits** screen: names Meta MMS-TTS as the voice source and lists the dictionary sources. The CC-BY-NC 4.0 attribution requirement makes this mandatory. (R-31, adapted)

## 3. The board

1. Each player gets a **randomly generated 4×4 tabla** (16 distinct cards from the 54), with **at most 5 cards from any one category**. (R-04)
2. The board shows **icons only, no words**. A square's word (in the player's spoken language) is revealed **once that card has been called**, whether the player guessed right or not.
3. **Deck:** 54 cards, ids 1–54, in 6 categories (animales, plantas y comida, cielo, tierra, hecho a mano, lugares); see `catalogo.md §B`. No human figures and no gendered human roles. (R-01)
4. **Determinism:** the same `seed` and `tablaIndex` give the same 16 cards, in the same order, on every device. (R-05, partly; see §9)
5. **Similarity cap:** when dealing, the host skips any `tablaIndex` that shares more than 8 cards with a tabla already dealt in the room. (R-06, adapted to 20 players)
6. **The tabla is always visible.** No mode, setting, toast, choice panel or animation hides it or covers it completely; only the end-of-round screen may. Only the _called card_ may be hidden ("Practicar de oído", §4). (R-45)

## 4. The automatic cantor

1. The cantor is **always the app's automatic voice**, never a person. After **Empezar** it draws a card every call interval (speed set by the organiser; the organiser can pause/resume).
2. For each call every device **shows the card's picture** and plays the word in **its own** spoken language. **The spelling is never shown** during the call. The host sends the card, not the text. (R-34; R-15's "Escucha" is therefore always on)
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

## 6. Crossing off

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
8. **Copy/tone:** screen text never says ganar, ganaste, ganador(a/es), premio(s), apuesta, apostar, dinero, fichas, win(s), winner(s), won, prize(s), bet(s), betting, money, chips or **bingo**. Use "¡Lotería!", "completaste" and "frijoles". A copy lint enforces this. Code identifiers such as `winners` are not screen text. (R-33)

## 8. Protocol (binding for `src/engine` and `src/net`)

- host → all `round{seed, roundNo, speedSec, hostKey}`; host → seat `assign{seat, tablaIndex, roundNo}`; board = `tabla(seed, tablaIndex)`.
- host → all `call{roundNo, i, cardId, choices:[CardId,CardId,CardId], at}` — `choices` from `choicesFor(seed, roundNo, i, cardId)`; clients render each choice's word in their spoken language. No `lang`, no word on the wire.
- player → host `pick{seat, roundNo, i, cardId}` (max 2 per call per seat).
- host → all `pickResult{roundNo, i, seat, correct, points: 0|1|2, first}`; host → all `scores{roundNo, points: Record<seat, number>}`.
- host → all `callClosed{roundNo, i}` (window over; clients cross the card off if on their tabla and reveal its word).
- host → all `end{roundNo, winners, reason: 'full-card'}`. Lobby: `lobby{status: 'waiting'|'started'|'full', players, hostKey}`; Empezar enabled only with ≥ 2 players; the host rejects the 21st `hello` with `lobby{status:'full'}`.
- All host messages are signed (ECDSA, TOFU), as today.

## 9. César's reglas.md (consolidated)

_Filled in by the consolidation pass: every R-xx rule from `docs/reglas.md` is listed here as **Adopted**, **Adapted** (with how) or **⚠ Conflict** (with what this file says instead)._

### 9.1 César's decisions doc (`docs/decisiones-rules-vs-reglas.md`, 2026-10-26)

César's doc compares rules **v1** (`2163db0`) with reglas.md v1 (`b8ba34e`). This table shows which way **v2** (this file) goes for each decision. "A" is César's option.

| # | Decision | v2 goes | Where in v2 |
|---|---|---|---|
| 0 | Which document wins | **B**: rules.md wins | header |
| 1 | Deck (Rob's vs César's `catalogo.md` §B) | **A**: César's 54-card deck in 6 categories, every Indigenous word from a cited dictionary. `7da8660` restored the 162 MMS clips and `catalogo.md`; `src/content/cards.json` still has to be switched | §2.4, §3.3 |
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

### 9.2 Conflicts to resolve with César

1. **Which document wins (0).** César asks for reglas.md; v2 keeps rules.md.
2. **Deck (1).** v2 adopts César's deck, but `src/content/cards.json` on `main` is still Rob's. Until it is swapped, audio and text disagree (e.g. rana in Náhuatl).
3. **es/en audio (3).** v2 uses MMS for es/en as well; César uses the browser voice.
4. **Marking (4).** v2's spelling choices for every player replace both "tap the tabla" (A) and "three drawings" (B).
5. **Points (6).** César's objection is that Wi-Fi latency makes "first" unfair; v2 keeps 2 / 1 points.
6. **After a lotería (7).** César wants pause with Seguir / Terminar and the same tabla kept; v2 deals new boards.
7. **Figures (8).** v2 plays full card only; César has 8 figures + Sorpresa.
8. **Two languages (9).** v2 uses UI + spoken, not César's "Escucho / Entiendo". He should confirm that this matches what he meant.
9. **Manual "next" (10).** César wants it; v2 has Repeat but no manual next.
10. **Paper (11).** v2 drops paper, but PRD §1 goal 2 and §3.4 still require it. The PRD has to change.
11. **Signed commits (14).** Rob's call (A or B in César's doc).
