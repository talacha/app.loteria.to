# Protocol and replay load tests

Run the acceptance scenario (20 players per room, three concurrent rooms) with:

```sh
pnpm tsx loadtest/run.ts --players 20 --rooms 3 --transport local --host headless
```

These are also the defaults for `pnpm tsx loadtest/run.ts`. Use `--help` for all flags. The reference host and bots use real transports and signed sessions, accelerated call windows, current assignments, picks, call closures and automatic full-card completion. Every player may pick every call. Crossing depends only on closed calls; points break ties between cartones completed on the same call. Truncated rounds without full-card completion fail, as do transport errors, forged host messages and accepted signed replays.

Reports are generated JSON files in `loadtest/reports/` (ignored by Git). `pass` checks delivery, crossing, score replay, first-correct scoring, full-card timing, winner agreement, and adversarial rejection. The replay probe must capture a real signed call, resend it, and observe zero accepted copies. Local delivery counters describe this harness; the report's Supabase quota is an explicitly unverified assumption, and local timing does not prove browser or hosted-service performance. The Node sequence store lasts for the process only. App-host mode requires Supabase because browser and Node BroadcastChannels do not communicate.

Run the browser storage regression separately:

```sh
pnpm tsx loadtest/check-sequence-browser.ts
```

It starts its own Vite server on port 4198 (`LOADTEST_SEQUENCE_PORT` overrides it), uses isolated Chromium browser contexts and closes both. It checks atomic sequence allocation across two tabs, atomic duplicate rejection, real page reload with the same persisted host key and player seat, and fail-closed behavior when IndexedDB is blocked. It uses the production IndexedDB path, without Node's in-memory fallback.

The signed envelope is version 2. Refresh the organiser and every player together after deployment; old hosts/players cannot interoperate securely with the new envelope. See `docs/protocol.md` for storage and compatibility details.
