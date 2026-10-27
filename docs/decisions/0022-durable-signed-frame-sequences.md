# 0022. Durable sequences on signed host frames

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

ECDSA authenticated the host message contents but did not establish freshness. The local attack harness could replay a captured call to every phone, even though the signature remained valid.

## Decision

Sign the canonical envelope `{v: 2, seq, m}`. Reserve monotonically increasing sender sequence numbers per public key in atomic, strict-durability IndexedDB transactions before signing. Receivers verify the signature before atomically advancing a persistent high-water mark per public key and player seat; sequences at or below it are rejected. Browser storage failure stops protected messaging. Node-only harnesses use process memory.

Legacy signatures do not get an insecure compatibility fallback. Authenticated legacy hosts produce a recovery error; all screens in an existing room must refresh together after deployment. The UI explains version/storage failures and offers a reload action.

## Consequences

- Reloading a browser preserves the counters as well as the host key, preventing a counter reset from re-enabling captured messages.
- One active organiser per room remains required. Separate organisers using the same key can allocate unique counters but their network sends can arrive out of order.
- Clearing protection storage requires a new room/key. A new receiver without prior history cannot establish the age of an otherwise valid first frame; this is not a server challenge protocol.
- Unit tests, a real-browser cross-tab/reload script, and the 20 × 3 load test cover the change. The load test fails if a replay probe is accepted.
