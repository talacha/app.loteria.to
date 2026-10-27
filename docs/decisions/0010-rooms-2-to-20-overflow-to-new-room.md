# 0010. Rooms hold 2–20 players; overflow goes to a new room

- **Status:** Accepted
- **Date:** 2026-10-26 (`278728f`)

## Context

The first PRD said up to 40 players per room; An earlier draft said not to build a "room full" message. Every pick result is broadcast to every phone, and Supabase Free Realtime limits messages per second. Cartones must stay distinct (no two share more than 8 cards).

## Decision

- A round starts with **at least 2** players (the organiser counts when "Jugar también").
- A room holds **at most 20**. The host answers a 21st `hello` with `lobby{status:'full'}`; that phone shows "Esta sala está llena" and offers to create a new room.
- 40 is a possible later goal once fan-out cost is reduced.

## Consequences

- Message volume stays inside the free tier for typical rooms.
- A classroom of 30 needs two rooms.
