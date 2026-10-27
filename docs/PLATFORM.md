# Platform: services, jobs, environment and setup

Gameplay never depends on any of this. Every service below is optional at play time; when one is not configured its endpoints answer `503 {"error":"not_configured","feature":"..."}` and the client falls back.

## Services

| Service            | Job                                                                                          | Used by                                   | Required to play? |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------- |
| Vercel             | Static PWA, `api/*` Functions (Node runtime)                                                 | everything                                | first visit only  |
| Supabase Realtime  | Broadcast + Presence on `loteria:{code}`                                                     | phones (`src/net`)                        | phones only       |
| Supabase Postgres  | System of record: submissions, decisions, reviewers, releases, metrics, job audit            | `api/metrics`, `api/review/*`, `api/jobs` | no                |
| Supabase Storage   | Private bucket `audio-pending` (signed upload URLs issued by `api/review/submit`)            | reviewer tool                             | no                |
| Upstash Redis      | Room key registry (`room:{code}`), rate limits, job idempotency                              | `api/rooms`, `api/review/auth`, jobs      | no                |
| Upstash QStash     | Durable async jobs and schedules, calling signed webhooks under `api/jobs`                   | `api/review/*`, `api/jobs`                | no                |

All database access goes through Functions with the service role; the browser never talks to Postgres or Storage directly. Tables have RLS enabled and no anon policies.

## Endpoints

| Route                       | Method | Notes                                                                                     |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `/api/health`               | GET    | `{redis, qstash, db}` each `ok`, `not_configured` or `error`                              |
| `/api/rooms`                | POST   | `{code, hostKey}`; Redis `SET room:{code} NX EX 14400`; 201 or 409; 10/min per IP         |
| `/api/rooms/{code}`         | GET    | `{hostKey}` or 404; `Cache-Control: no-store`                                             |
| `/api/metrics`              | POST   | up to 50 anonymous counters; `DNT: 1` or `Sec-GPC: 1` returns 204 and stores nothing      |
| `/api/review/auth`          | POST   | `{lang, code}` vs `REVIEW_CODE` (timing-safe), 5 attempts per 10 min per IP; HMAC token 2 h |
| `/api/review/submit`        | POST   | `Authorization: Bearer <token>`; inserts submission, optional signed upload URL, enqueues `notify-reviewers` |
| `/api/review/uploaded`      | POST   | `{submissionId}`; enqueues `transcode-recording`                                          |
| `/api/jobs/*`               | POST   | QStash only; 401 without a valid `Upstash-Signature`                                      |

Functions are same-origin only: no CORS headers are emitted and a foreign `Origin` gets 403. Errors are always `{"error":"code"}`. Secrets are never logged.

Host messages are ECDSA-signed on the host; `/api/rooms` is the public-key registry. The host registers its public key (`hostKey`, base64url) under the room code when the room opens, and phones fetch it once with `GET /api/rooms/{code}` and verify `call` and `claimResult` messages against it.

## Jobs

Each job verifies the QStash signature over the raw body, dedupes on `job:{messageId}` (Redis `SET NX EX 86400`; a failed run deletes the key so QStash retries) and writes a `job_runs` row.

| Job                       | Trigger                         | Does                                                                                                                 |
| ------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `transcode-recording`     | `review/uploaded`               | v1 stub: marks the submission `uploaded` and records `transcode_pending` in `job_runs`                               |
| `notify-reviewers`        | `review/submit`                 | Stub: logs a `job_runs` row (no email provider yet)                                                                  |
| `rollup-metrics`          | QStash schedule, daily 03:00 UTC | Recomputes `metric_daily` (day, name) from raw `metric_events` for complete UTC days, deletes raw rows older than 30 d |
| `publish-content-release` | manual publish                  | Stub: logs a `job_runs` row                                                                                          |

Transcode plan: Vercel Functions have no ffmpeg. The browser already records `audio/webm;codecs=opus`, which is the target format, so v1 stores the upload as is. If a second format (for example for iOS Safari) turns out to be needed, run ffmpeg in a separate worker (a small container or GitHub Action) that `transcode-recording` triggers, and have it write the result back to Storage and set the status.

## Environment variables

| Variable                                                              | Source                      | Used by                         |
| --------------------------------------------------------------------- | --------------------------- | ------------------------------- |
| `POSTGRES_URL` (pooled), `POSTGRES_URL_NON_POOLING`                   | Vercel Supabase integration | `api/_lib/db.ts` (pooled; `prepare: false`). The non-pooling URL is for running migrations |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`      | Vercel Supabase integration | Storage signed URLs (service role); anon key goes to the browser as `VITE_SUPABASE_ANON_KEY` |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | Upstash Redis | `api/_lib/redis.ts` |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Upstash QStash            | `api/_lib/qstash.ts`            |
| `QSTASH_URL` (optional) | Upstash QStash | Regional endpoint, e.g. `https://qstash-eu-central-1.upstash.io`; passed as the client `baseUrl`. Required for regional accounts |
| `PUBLIC_ORIGIN` (optional) | you choose | Canonical origin (`https://app.loteria.to`) used to build and verify job URLs; falls back to the request origin |
| `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` | Upstash Redis | Present in production but unused by the REST client |
| `REVIEW_CODE`                                                         | you choose                  | `api/review/auth` and token signing |
| `ADMIN_CODE`                                                          | you choose                  | future `/admin`                 |

## Setup

```sh
# 1. Database: link the Supabase project and push the migration
supabase link --project-ref <ref>
supabase db push
#    or paste supabase/migrations/0001_init.sql into the Supabase SQL editor

# 2. Env: provision Upstash Redis and QStash from the Vercel Marketplace, then
vercel env add REVIEW_CODE
vercel env add ADMIN_CODE
vercel env pull .env.local

# 3. Daily rollup (QStash schedules replace Vercel crons)
qstash schedules create --cron "0 3 * * *" https://app.loteria.to/api/jobs/rollup-metrics
#    or: curl -X POST https://qstash.upstash.io/v2/schedules/https://app.loteria.to/api/jobs/rollup-metrics \
#          -H "Authorization: Bearer $QSTASH_TOKEN" -H "Upstash-Cron: 0 3 * * *"
```

QStash cannot reach protected preview deployments; test jobs against production or a preview with Deployment Protection bypass.

## Degrade behaviour

| Missing        | Effect                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------- |
| Redis          | `/api/rooms`, `/api/review/auth` and all jobs answer 503; the host plays on without signed-room registration |
| QStash         | Jobs answer 503; `review/uploaded` answers 503; `review/submit` still succeeds (the notify enqueue is best-effort and logged) |
| Postgres       | `/api/metrics`, `/api/review/*` answer 503; clients keep their event queue                                   |
| Supabase admin | `review/submit` answers 503 when an upload URL is requested                                                    |
| `REVIEW_CODE`  | `/api/review/*` answer 503                                                                                     |

`/api/health` never throws; it reports each dependency as `ok`, `not_configured` or `error`.

## Local checks

`pnpm typecheck` covers `src`; `api/` has its own `api/tsconfig.json` (`tsc -p api --noEmit`). Tests live in `api/**/*.test.ts` and mock Redis, QStash and postgres in memory (`api/_lib/fakes.ts`).
