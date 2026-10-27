# Rules: how a round is played

**Status:** v1, from the owner's direction (2026-10-26). Lines marked **[Assumption]** fill gaps the owner hasn't decided yet; change them here and the build follows. This file is the contract for everything behind the game boundary (`src/app/game/`).

## 1. Setup
1. A room is created and players join (link, QR or code) and pick a call language: Náhuatl, Maya yucateco, Quechua (Cusco-Collao), Español or English. Only languages whose names are approved are offered in production.
2. Each phone player gets one 4×4 tabla (16 cards) assigned by the host. Paper players use printed tablas.
3. The host chooses the winning pattern (line, four corners, centre, full board) and the call speed. **[Assumption]** Default pattern: any line (row, column or diagonal). Default speed: Normal, 10 s per call.

## 2. The automatic caller
1. When the host taps **Empezar**, cards are drawn automatically from the shuffled 54-card deck, one every call interval. There is no manual "next card". The host can **pause and resume** and change speed.
2. Every connected device sees and hears **the same drawn card at the same time**: the word in each player's own language (audio where a reviewed recording exists; Escucha mode hides the written word).
3. **[Assumption]** The picture of the drawn card is not shown during the call. It is revealed to everyone when the call window closes, in the "ya cantadas" history.

## 3. Picking (crossing out)
1. Every player sees the drawn card. **If the card is on their tabla**, they get **three picture choices**: the correct card and two distractors. All players see the same three choices, in the same order, for a given call.
2. **If the card is not on their tabla**, they see "No está en tu tabla" and no choices. **[Assumption]** No penalty and no hint about which card it was until the reveal.
3. Picking the correct picture **crosses the card out** on that player's tabla (a frijolito / bean). **Every** player who picks correctly crosses it out, not just the first.
4. **Wrong pick:** the choice dims, the player sees a gentle "¡Casi!" and may pick again within the same call window. No penalty. **[Assumption]**
5. **Time runs out without a correct pick:** the card is **not** crossed out for that player, because crossing out is earned by picking. **[Assumption]** Exception: the accessibility setting **auto-mark** crosses it out automatically (and earns no points).
6. Distractors are chosen to be fair, not tricky: they are never the same card twice and prefer cards from other categories over look-alikes (`confusableWith`) for young players. **[Assumption]**

## 4. Points (tie-breakers only)
1. The **first** player whose correct pick reaches the host for a call earns **2 points**. Everyone else who picks correctly earns **0 points** but still crosses the card out. **[Assumption]** for the 0.
2. "First" is decided by the host in the order picks arrive; device clocks are not used.
3. Points are shown small; they are **only used to break ties** and never decide a round on their own.

## 5. Winning
1. A player wins by completing the round's pattern with crossed-out cards and tapping **¡Lotería!**. The host verifies the claim (all cards in the pattern were called and correctly picked by that player).
2. **[Assumption]** Phones may also detect a completed pattern and prompt "¡Lotería!" automatically; the tap still sends the claim.
3. **Tie:** if more than one valid claim is made for the **same call** (before the next card is drawn), the player with more points wins. If points are equal, they share the win.
4. When a winner is declared the caller stops and everyone sees the ¡Lotería! screen with the winning line and its words in their language. "Otra ronda" starts a new round in the same room with new tablas.
5. Invalid claim: friendly "¡Casi!", no penalty.

## 6. Paper tablas
Paper players cross out by hand and shout "¡Lotería!"; the host checks the 6-character code on the board. Paper players earn no points; in a tie between a paper claim and a phone claim on the same call, they share the win. **[Assumption]**

## 7. What travels on the network (for builders)
- host → all: `call{i, cardId, choices:[CardId,CardId,CardId], lang-independent}` — choices derived deterministically from `(seed, roundNo, i)`.
- player → host: `pick{seat, roundNo, i, cardId}` — one message per tap.
- host → all: `pickResult{roundNo, i, seat, correct, first?}` and a periodic `scores{roundNo, points:{seat:number}}`.
- The host is the authority for "first", for crossed-out state used in claim checks, and for winners.
