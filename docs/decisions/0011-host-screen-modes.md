# 0011. Host screen modes: "Solo pantalla" or "Jugar también"

- **Status:** Accepted
- **Date:** 2026-10-26 (`a64ec03`, `e825fee`)

## Context

The organiser's device is the cantor screen. On a projector it should only display; at a family table the organiser usually wants to play too, and a two-person game needs them as a player.

## Decision

- When creating a room, the organiser chooses **"Solo pantalla"** (display only) or **"Jugar también"** (also play).
- With "Jugar también" the organiser gets a local seat with its own cartón and spelling choices on the cantor screen, counts toward the 2-player minimum and is scored in arrival order with everyone else.

## Consequences

- Two people can play with one phone and one laptop.
- The local seat's picks have no network latency, so the organiser has an edge for the 2-point "first" (see [0019](0019-first-pick-is-arrival-order.md)).
