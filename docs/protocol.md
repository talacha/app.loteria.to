# Network protocol

Implementation contract for `src/engine` and `src/net` (moved from `docs/rules.md` §8). The game rules are in [rules.md](rules.md).


- host → all `round{seed, roundNo, speedSec, hostKey}`; host → seat `assign{seat, tablaIndex, roundNo}`; board = `tabla(seed, tablaIndex)`.
- host → all `call{roundNo, i, cardId, choices:[CardId,CardId,CardId], at}` — `choices` from `choicesFor(seed, roundNo, i, cardId)`; clients render each choice's word in their spoken language. No `lang`, no word on the wire.
- player → host `pick{seat, roundNo, i, cardId}` (max 2 per call per seat).
- host → all `pickResult{roundNo, i, seat, correct, points: 0|1|2, first}`; host → all `scores{roundNo, points: Record<seat, number>}`.
- host → all `callClosed{roundNo, i}` (window over; clients cross the card off if on their tabla and reveal its word).
- host → all `end{roundNo, winners, reason: 'full-card'}`. Lobby: `lobby{status: 'waiting'|'started'|'full', players, hostKey}`; Empezar enabled only with ≥ 2 players; the host rejects the 21st `hello` with `lobby{status:'full'}`.
- All host messages are signed (ECDSA, TOFU), as today.

