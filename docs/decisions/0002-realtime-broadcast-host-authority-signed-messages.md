# 0002. Supabase Realtime broadcast, host authority, ECDSA-signed host messages (TOFU)

- **Status:** Accepted
- **Date:** 2026-10-26 (`224669e`, `902be2d`, `b1cdb41`)

## Context

Rooms need sub-second fan-out to up to 20 phones without running a game server. Any player on a broadcast channel can send any message, so phones must be able to tell real host messages from forged ones.

## Decision

- Rooms are Supabase Realtime broadcast channels `loteria:{code}` with Presence. A `Transport` interface has two implementations: `SupabaseTransport` and `LocalTransport` (BroadcastChannel) used in dev, e2e and whenever Supabase env vars are absent.
- The organiser's device is the **only authority**: it shuffles, calls, scores picks, detects full cartones and declares results. Phones only send `hello` and `pick`.
- The host generates an ECDSA P-256 key pair (private key non-extractable, kept in IndexedDB) and signs every host message over canonical JSON. The public key travels in the join link fragment (`#k=`) and is registered under the room code at `/api/rooms` (Redis `SET NX`, 4 h TTL). Phones trust the first key they see for a room (trust on first use) and drop unsigned or mis-signed host frames.
- Messages are zod-validated; the contract is [protocol.md](../protocol.md).

## Consequences

- No game database; names and cartones never touch a server.
- Signed frames carry no nonce, so a captured frame can be replayed within its round (backlog DEBT-002).
- Every pick result is broadcast to every phone, so traffic grows with players² per call (backlog DEBT-003).
- If the host device drops, the round pauses until it returns (state is persisted in IndexedDB and resumes on reload).
