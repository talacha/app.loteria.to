# Rules: how a round is played (v2)

**Authority:** owner direction, 2026-10-26. This file is the build contract for everything behind the game boundary (`src/engine`, `src/app/game`). César's `docs/reglas.md` is consolidated into §9 with conflicts marked; **where they disagree, this file wins.** Lines marked **[Assumption]** fill gaps and can be changed by the owner.

## 1. Players and rooms

1. A room is created by **quien organiza** (the organiser). Creating a room **generates a room code by default** that is not currently in play (reserved in Redis via `/api/rooms`; offline fallback: random code).
2. A round can start with **at least 2 players** and holds **at most 20**. A 21st player who tries to join sees "Esta sala está llena" and is offered **"Crear una sala nueva"**.
3. **Solo mode:** one player against an autonomous **CPU player** on the same device, no network needed.
4. The organiser's device runs the cantor screen. **[Assumption]** It does not hold a tabla; to play, the organiser also joins from a phone.

## 2. Languages (per player)

1. **UI language** — Español or English — for menus, buttons and messages. Per player, local, changeable any time.
2. **Spoken language** — Náhuatl, Maya yucateco, Quechua (Cusco-Collao), Español or English — what the cantor speaks to **that** player, the spelling of their **three choices**, and the words revealed on **their** board. Per player, local, independent of the UI language (e.g. UI in Spanish, spoken Náhuatl to practise it).
3. All five languages are treated as **verified** (owner, 2026-10-26). No "en revisión" tags. Audio is pre-recorded Meta **MMS-TTS** (CC-BY-NC 4.0, non-commercial) for all 54 cards × 5 languages; the UI may show a small "voz generada por IA" note.

## 3. The board

1. Each player gets a **randomly generated 4×4 tabla** (16 distinct cards from the 54).
2. The board shows **icons only, no words**. A square's word (in the player's spoken language) is revealed **once that card has been called**, whether the player guessed right or not.

## 4. The automatic cantor

1. The cantor is **always the app's automatic voice**, never a person. After **Empezar** it draws a card every call interval (speed set by the organiser; the organiser can pause/resume).
2. For each call every device **shows the card's picture** and plays the word in **its own** spoken language. **The spelling is never shown** during the call.

## 5. Picking (spelling)

1. **Every player** gets **three spelling choices** — the correct card's word and two other cards' words — spelled in their own spoken language. All players get the **same three cards** in the same order for a call. **[Assumption]** Players pick even if the card is not on their tabla.
2. Points per call: **first correct pick = 2 points**, every **other correct pick = 1 point**, wrong = 0. "First" is decided by the host in arrival order.
3. A wrong pick dims that choice and shows a gentle "¡Casi!"; one more try is allowed within the call window (a correct second try still earns 1 point if not first). **[Assumption]**

## 6. Crossing off

1. **Everyone who has the called card on their tabla crosses it off — whether they guessed right, wrong, or not at all.** **[Assumption]** for "not at all": crossed at the end of the call window.
2. Crossed squares show a bean and reveal their word.

## 7. Winning

1. The **first player to complete their whole card** (all 16 crossed) wins; the host detects it when the call that completes a card closes (players may also tap ¡Lotería!).
2. **Simultaneous wins** (completed on the same call): the player with **more points** wins; equal points share the win.
3. Then everyone sees the ¡Lotería! screen; "Otra ronda" starts a new round with new boards in the same room.

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
