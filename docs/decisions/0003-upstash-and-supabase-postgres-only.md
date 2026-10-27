# 0003. Upstash Redis + QStash; Supabase Postgres is the only database

- **Status:** Accepted
- **Date:** 2026-10-26 (`902be2d`)

## Context

A few features need durable or secret-bearing state: the room host-key registry, rate limits, job idempotency, anonymous metrics and a future reviewer tool. Early planning listed Neon Postgres alongside Supabase.

## Decision

- **Supabase Postgres** is the single system of record (metrics, reviewer submissions, job audit). Neon is dropped. Access only through Functions with the service role; RLS on, no anon policies; migrations in `supabase/migrations/`.
- **Upstash Redis**: room registry `room:{code}`, rate limits, job dedupe keys.
- **Upstash QStash**: durable async jobs and schedules (daily metrics rollup) calling signed webhooks under `api/jobs/*`, replacing Vercel crons.
- Every service is optional at play time: missing config answers `503 {"error":"not_configured"}` and the client falls back.

## Consequences

- One database vendor to operate; Supabase covers Realtime, Postgres and Storage.
- Three vendors in total (Vercel, Supabase, Upstash), all on free tiers.
- Reviewer and transcode jobs are stubs in v1.0.
