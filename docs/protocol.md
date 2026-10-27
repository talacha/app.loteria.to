# Network protocol

This file is generated from `src/net/messages.ts`, `src/net/session.ts`, `src/net/transport.ts`, `src/app/host/useHostRoom.ts`, `src/app/host/useGame.ts`, `src/app/lobby/LobbyWaiting.tsx` and `src/app/player/*`. If this file and the code disagree, the code wins and this file should be fixed. The game rules are in [rules.md](rules.md).

## 1. Wire and envelope

- **Channel:** `loteria:{CODE}`, where `CODE` is 5 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`.
  - `SupabaseTransport` uses Realtime broadcast event `msg` with `self: false`, plus presence keyed by seat with `{role}`.
  - `LocalTransport` uses a `BroadcastChannel` with `{k:'msg', frame}` and its own `{k:'presence', seat, role, leave?}` heartbeat (2 s beat, 6 s expiry).
- **Frame:** players send `{ role: 'player', from: seat, m: Msg }`; hosts send `{ role: 'host', from: seat, v: 3, seq: positiveSafeInteger, m: Msg, sig: string }`. `from` is 1–64 characters.
- **Seat:** 16 hex characters (8 random bytes), cached per tab in `sessionStorage` under `loteria:seat:{code}:{role}`. The host's own playing seat is the constant `host-local`, which never goes on the network.
- **Validation:** every message is parsed with the zod `msgSchema`, on send and on receive. Invalid messages are dropped (on send, `encode` throws).
- **Signing:** every host-only type is signed. The signature is ECDSA P-256 / SHA-256 over **canonical JSON** of `{v: 3, seq, m}` (keys sorted recursively, `undefined` dropped), base64url. Public keys are raw P-256, base64url. When sending `round` and `lobby`, the session fills `hostKey` with its own key.
- **Receive policy** (`Session.check`):
  - Host-only types are accepted only by players, only from frames with `role: 'host'` and a `sig`, and only if the signature verifies against the pinned key.
  - With no pinned key, only `round` or `lobby` can establish one, through their embedded `hostKey`. The first message that verifies **pins** that key (TOFU).
  - Player types are accepted only by the host, only from `role: 'player'`, and only if `m.seat === frame.from`.
- **Before join:** `send` queues up to 100 messages and drops the oldest. Sends are serialised, and so is decoding, so order is preserved.

Shared field constraints: `seat` 1–64 chars. `cardId` 1–64 chars. `roundNo` integer 0–10000. Call index `i` integer 0–1000. `tablaIndex` integer 0–4095 (`MAX_TABLA_INDEX`). Text fields reject `\p{C}` and bidi overrides, except ZWJ.

## 2. Messages

| `t`          | Direction       | Signed  | Fields                                                                                                                                                       | Limits / notes                                                                                                                                                                                                                    |
| ------------ | --------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lobby`      | host → all      | yes     | `status: 'waiting' \| 'started' \| 'full'`, `defaults?: {spokenLang, uiLang: 'es' \| 'en'}`, `players: {seat, name (1–24), glyph (1–16), pronouns? (≤ 30)}[]` (≤ 20, unique seats), `roundNo?`, `hostKey?` (1–128) | In the lobby: `waiting`, sent 300 ms after a roster change (debounced) and every 10 s. During a round: `started`, sent every 10 s and on each `hello`. `full`: see §5. `players` includes `host-local` when the host plays.                    |
| `round`      | host → all      | yes     | `seed` (1–128), `roundNo`, `speedSec` (3–60, finite), `gridSize?` (int 3–8; absent = 4), `deck?: CardId[]` (9–144, unique), `hostKey?`                                                                                              | Sent when a transport boots, every 10 s while running or paused, on every `hello` (before `lobby`, so TOFU players can pin), and on a speed change. The host clamps speed to 6–20 and always sends the frozen deck IDs; absent `deck` means the original 54-card pool for legacy saved rounds.                                                     |
| `assign`     | host → all      | yes     | `seat`, `tablaIndex`, `roundNo`, `closed?: CardId[]` (≤ 144, unique)                                                                                              | One per seat, on boot/resume and on every `hello`. `closed` contains only calls whose windows have ended (the open call is excluded); older hosts may omit it. Players apply only their own seat and restore revealed words and crossed squares from this history. The tabla is `tabla(seed, tablaIndex, frozenDeck, gridSize)`; `pickTablaIndex` keeps at most `⌊gridSize²/2⌋` cards shared with another tabla.                                      |
| `call`       | host → all      | yes     | `i`, `cardId`, `choices: [CardId, CardId, CardId]` (distinct, containing `cardId`), `at` (host `Date.now()`)                                                  | **No `roundNo`, no language, no word.** `choices = choicesFor(seed, roundNo, i, cardId, deck, isAvoidedPair(·, roomLangs))`, cached per `i`, so a resend is identical. The host resends the current call to a seat after its `hello`. Players ignore `at` and time the window from local receipt. |
| `pick`       | player → host   | no      | `seat`, `roundNo`, `i`, `cardId`                                                                                                                              | `Session`: ≥ 400 ms between picks per seat and ≤ 2 per seat per `(roundNo, i)`. The host also drops picks that are not for the current call of the current round, picks from a seat outside the roster, and picks when the phase isn't running or paused. |
| `pickResult` | host → all      | yes     | `roundNo`, `i`, `seat`, `correct`, `points: 0 \| 1 \| 2`, `first`                                                                                            | One per accepted pick, from `scorePick`, in arrival order. First correct pick = 2, other correct = 1, wrong = 0. The host scores a seat at most once per call; envelope replay protection rejects captured results before delivery. Players apply only their own seat.                                                    |
| `scores`     | host → all      | yes     | `roundNo`, `points: Record<seat, 0–288>` (≤ 60 keys), `crossed: Record<seat, 0–64>` (≤ gridSize²) (≤ 60 keys; optional in the schema, always sent by the host) | `crossed` = squares crossed out per seat, counting only calls that have closed. It feeds the leaderboard (sorted by points, then squares, then name). Sent immediately after a first-correct pick (debounced to 500 ms otherwise), right after every `callClosed`, and on boot/resume and each accepted `hello` to restore points immediately.                                                                                                                                                       |
| `callClosed` | host → all      | yes     | `roundNo`, `i`                                                                                                                                                | Sent at the end of each window. Players reveal the word and cross the card off if it is on their tabla. A new `call` also closes the previous one on the player side, in case `callClosed` was lost.                                         |
| `end`        | host → all      | yes     | `roundNo`, `reason: 'full-card'`, `winners: seat[]` (≤ 54, unique)                                                                                            | `reason` is always `'full-card'`. A round has no other end: the organiser cannot end it early, and every tabla is drawn from the frozen pool, so a seat completes by the end of that pool (`winners: []` is only reachable when no seat has a tabla). The final `scores` is sent just before `end`, so every screen can show the final standings.                                                                            |
| `hello`      | player → host   | no      | `seat`, `name` (1–24), `glyph` (1–16), `pronouns?` (≤ 30), `labelLang: 'es' \| 'en' \| 'nah' \| 'yua' \| 'quz'`                                              | Join and re-announce. The host throttles roster/name updates from a seat within 2 s and ignores seats it has removed; spoken-language updates are applied immediately so the waiting-room intersection stays accurate. `labelLang` is the player's spoken language; the host uses the set of these for distractor fairness.                                    |
| `claim`      | player → host   | no      | `seat`, `roundNo`, `tablaIndex`, `marks: CardId[]` (≤ 144, unique)                                                                                             | **Defined but unused.** No app code sends it and the host ignores it; full-card wins are detected by the host. `Session` still rate-limits it (1 per seat per 3 s, ≤ 20/s per room). Current loadtest bots also use `pick`; `claim` remains a legacy schema variant.                         |

`HOST_ONLY` = `round, call, callClosed, end, assign, lobby, pickResult, scores`.

## 3. Round lifecycle

```mermaid
sequenceDiagram
  autonumber
  participant H as Host (cantor screen)
  participant R as /api/rooms (Redis)
  participant C as Channel loteria:CODE
  participant P as Phone

  H->>R: POST {code, hostKey}  (409 → new code, ≤ 3 retries)
  H->>C: join as host, presence {role:host}
  P->>R: GET /api/rooms/CODE  (only if no #k= in the QR link)
  P->>C: join as player, presence {role:player}
  P->>H: hello {seat, name, glyph, pronouns?, labelLang}
  H-->>C: lobby {waiting, players, hostKey}  (debounced 300 ms, then every 10 s)
  Note over H: Empezar enabled when the roster has ≥ 2 seats (host-local counts)
  H-->>C: lobby {started} · round {seed, roundNo, speedSec, gridSize, deck, hostKey} · assign {seat, tablaIndex, roundNo, closed} per seat
  loop every speedSec (6–20 s) until a tabla completes or the deck runs out
    H-->>C: call {i, cardId, choices[3], at}
    P->>H: pick {seat, roundNo, i, cardId}  (≤ 2 per call, ≥ 400 ms apart)
    H-->>C: pickResult {roundNo, i, seat, correct, points, first}
    H-->>C: scores {roundNo, points, crossed}  (now on first-correct, else ≤ 500 ms)
    H-->>C: callClosed {roundNo, i}
    H-->>C: scores {roundNo, points, crossed}  (squares crossed after this call)
    Note over H: completed = seats whose gridSize² cards are all called. If any: winners = most points (ties share)
  end
  H-->>C: end {roundNo, winners, reason:'full-card'}
  Note over H,P: "Otra ronda": host returns to the lobby with roundNo+1 (same seed; new deck order, new tablas, points reset)
```

Details:

- **Start.** `start` freezes the room-language intersection as `deck`, then sets `order = deckOrder(seed, roundNo, deck)` and immediately makes call 0, so `calledCount = 1`. The timer is `setTimeout(speedSec)`, and each tick runs `closeCall()`. That sends `callClosed`, then checks for full cards. If no tabla is complete, the next `call` goes out at the same instant: there is no gap between windows.
- **Crossing.** Every seat crosses every called card when its call closes, whether or not the seat picked. A tabla is complete when all gridSize² of its cards have been called. Points only break ties.
- **Pause.** Pause stops the timer. Late picks for the current call are still accepted while paused. Resume restarts a full window. A speed change resends `round` and restarts the window.
- **No early end.** The only way to `ended` is a full card (`finish`). Pause and resume are the only organiser controls on a running round. If the deck were to run out with no seat holding a tabla, the `next` action would still move to `ended` with `winners: []`.
- **Player state** (`playerState.ts`):
  - The board is built only when `round` and the player's own `assign` agree on `roundNo`. A `round` with a new `roundNo` or `seed` resets the player state. A changed `gridSize` or `deck` for the same round rebuilds the board; normal resends keep it.
  - Messages whose `roundNo` doesn't match the current round are ignored.
  - The pick UI allows at most 2 wrong tries and blocks while a pick is pending. Each newer call resets the window. Resending the same call preserves local progress and does not reopen a closed call. Calls or choices outside an explicit frozen deck are ignored.

## 4. Host plays ("Jugar también")

With `settings.hostPlays`, the roster gets the seat `host-local`. Its name and glyph come from the shared profile (default 🌽). It counts toward the minimum of 2 and the maximum of 20, appears in `lobby.players` and `scores`, and gets a tabla through `ensureAssigned`. No `assign` is needed for it, though the boot loop does broadcast one. The organiser's tap is fed through **the same `handlePick` → `scorePick` path** as a network pick, in enqueue order, so it gets no head start. It is never sent on the wire, but its `pickResult` is broadcast like any other. Its crossed cards are derived from the calls that have closed.

## 5. Capacity and "full"

- `ROOM_MAX_PLAYERS = 20` roster seats, `ROOM_MIN_PLAYERS = 2`. The lobby schema caps `players` at 20.
- **In the lobby:** a `hello` from a new seat when the roster already has 20 makes the host send `lobby {status:'full'}` immediately. The rejected phone sees that its seat is missing from `players` and that `status` is `full`, and shows "room full" with "create a new room".
- **During a round:** a `hello` from a seat that isn't a member (removed, or the 21st) gets `lobby {full}` if the room has ≥ 20 seats, else `lobby {started}`. A new seat under the cap is added to the roster by `useHostRoom` first, so it plays: it gets `round`, `lobby`, `assign` and the current `call`.
- **Removal ("Quitar"):** the seat is banned for the session, and its later `hello`s are ignored by the roster.

## 6. Presence, reconnection and resume

**Presence.** Transports report only the list of player seats; the host is never listed. A roster seat that is missing from presence for more than **4 s** (`LEAVE_GRACE_MS`, swept every 500 ms) is dropped. The `host-local` seat is exempt.

**Phone side** (`JoinPage`, `LobbyWaiting`):

- The seat id is stable per tab (`sessionStorage`). `loteria:session:{code}` keeps the profile and host key, so a refresh rejoins without the form.
- After joining, the phone sends `hello` and retries every 3 s, up to 3 times, until it sees `round` or finds its seat in `lobby`.
- A `lobby` without the phone's seat that isn't `full` (for example, the host reloaded) triggers a re-hello, at most once every 3 s.
- After the first `round`, a 3 s watchdog re-hellos until an `assign` arrives for the current `roundNo`.
- With no `lobby` within 12 s, the phone shows "no host". Ordinary transport errors show "connection lost". Authenticated version mismatches show bilingual instructions to reload every room screen, including the organiser; protection-storage failures explain that browser storage must be enabled and offer a reload action.
- The rejoining seat gets the **same tablaIndex**: host assignments are keyed by seat.
- `assign.closed` restores every previously closed call: its word is revealed and its square crossed if it belongs to the cartón. The current open call stays hidden and uncrossed. The snapshot works whether `assign` or `round` arrives first, and repeated snapshots merge with local closed calls. A fresh `scores` restores points on every accepted `hello`. Transient per-call pick feedback is not restored.

**Host side** (`useHostRoom`, `persist.ts`):

- The round, including its frozen `deck`, is saved to IndexedDB on every state change. Saved rounds from before this field existed restore the original 54-card pool, so catalog expansion cannot change an existing tabla or call order. The ECDSA key pair is stored per room code, so the `hostKey` survives a reload.
- On boot, a saved round that hasn't ended shows a "Reanudar partida" prompt. Resume reuses the code and re-registers it (a 409 with the same key counts as success). A `running` round is restored as **paused**.
- Restored roster seats start as "missing" and are dropped after 4 s unless presence or `hello` brings them back.
- When the new transport boots, the host sends `lobby`, `round`, every `assign` with closed-call history, and `scores`, plus the current `call` if the round is running.
- Without network the host keeps calling locally ("offline"). It re-registers on `online` and every 15 s while "unverified".

## 7. Frozen decks, grid size and room defaults

- **Room deck.** `cardsAvailableIn(spokenLangs)` returns the intersection of approved names with delivered audio for every participating voice; the organiser contributes a voice only when playing. Spanish/English coverage is 144 cards; current Náhuatl, Maya yucateco and Quechua coverage is the original 54. The original pool retains its previous eligibility without claiming new provenance; new Indigenous entries require attestation/source review. The deck is fixed when the round starts, and every board, call, choice and completion check uses it.
- **Language changes and late joins.** `langsForDeck(deck)` supplies the allowed voices. Both the header gear and player settings disable uncovered voices with a reason. A late joiner whose preference cannot cover the frozen deck receives a supported voice (Spanish when available), sees an explanation, and may choose another supported voice. The deck does not shrink mid-round. Adopting room defaults or changing the effective voice announces the actual language through `hello`.
- **`round.gridSize`** (3–8) sets the cartón to `gridSize × gridSize`: `tabla(seed, tablaIndex, deck, gridSize)` yields `gridSize²` cards and `pickTablaIndex` keeps any two tablas ≤ `⌊gridSize²/2⌋` cards apart (`maxShared`). A `round` without it (older hosts) means 4. `assign` is unchanged. A phone that sees a different `gridSize` or pool for the same round rebuilds its board. Neither a language switch nor a normal resend changes the pool.
- The host offers only sizes the deck can deal for the current player count (`minDeckFor` / `maxGridFor` in `src/engine/grid.ts`, a table measured by simulation: 20 players need 27, 38, 58, 80, 110 and 138 cards for 3×3 to 8×8). The chosen size is preserved when it fits. A smaller shared pool or larger waiting-room roster caps it to the largest supported size. A 144-card pool supports twenty 8×8 tablas; a mixed 54-card room is capped at 4×4 for twenty players.
- **`lobby.defaults`** carries the organiser's default app and spoken language. A phone applies it once per room and tab (`sessionStorage` `loteria:defaults:CODE`) as its starting choice, and the player can change both afterwards from the gear.

## 8. Signed envelope version 3 and replay protection

Host signatures cover the envelope version, sequence and parsed message together: `sign({v: 3, seq, m})`. Players reject nonpositive, fractional, unsafe, repeated or decreasing sequences, and tampering with the version, sequence or message invalidates the signature. Player-to-host frames keep their existing schema and seat/rate-limit policy.

The host reserves each sequence atomically in a strict-durability IndexedDB transaction keyed by its public key, before signing. Reloading with the same persisted key continues its counter. Concurrent encode calls on one session are serialized. Every player durably advances its receive high-water mark only after signature verification, before delivering the message; this mark is keyed by host public key and the player's stable seat, so separate player tabs do not suppress one another. Browser storage errors fail closed and reach `Transport.onError`; browsers never silently reset to an in-memory counter. The Node loadtest uses process memory, so its counters persist only for that Node process. Clearing browser storage removes replay history and requires a new room/key; retaining an old key while selectively deleting counters is unsupported. Use one active host session per room: concurrent hosts sharing a key get unique sequences but can deliver frames out of order, which receivers reject.

Version 3 makes the frozen-deck contract explicit. [ADR 0022](decisions/0022-durable-signed-frame-sequences.md) introduced the durable counters in version 2; [ADR 0023](decisions/0023-expanded-catalog-and-language-coverage.md) supersedes that wire version while retaining its sequencing guarantees. An authenticated frame with an unsupported version raises `ProtocolVersionError` through `Transport.onError`. Verification of unsupported versions uses the original payload so unknown fields do not silently hide a compatibility error. The deployed version-2 client can authenticate a version-3 `lobby` (its message shape is unchanged) and displays its existing reload guidance. **Reload the organiser and every phone together after upgrading.** There is no unsigned or older-version fallback. TOFU still requires the first accepted `round` or `lobby` to carry a host key and verify successfully; it does not authenticate the first host out of band.
