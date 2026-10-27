# 0001. Vite SPA + PWA on Vercel, with prerendered public pages

- **Status:** Accepted
- **Date:** 2026-10-26 (scaffold `87b5c23`; prerendering `e832a97`)

## Context

The game must start in seconds from a QR code on any phone, with no app store and no accounts. Rounds run on the organiser's device, so there is no game server to render pages. Public pages still need to be findable and to show good previews when a link is shared.

## Decision

- One TypeScript codebase: a Vite + React single-page app, installable as a PWA (`vite-plugin-pwa`, Workbox precache of shell, content, art and audio under a 10 MB budget, 3 MB per file).
- Hosted on Vercel: static assets plus a few Node Functions under `api/` for things that need a secret or durable state.
- Public routes (`/`, `/solo`, `/deck`, `/creditos`, `/print`) are prerendered at build (`scripts/prerender.mjs`) with meta, Open Graph and JSON-LD, then checked by `scripts/seo-check.mjs`. Private routes (`/host`, `/r/*`, `/ui`) rewrite to `app.html` and send `X-Robots-Tag: noindex`.
- `middleware.ts` (Vercel Routing Middleware) injects room-invite OG tags for `/r/:code` so chat apps that do not run JS show a preview.

## Consequences

- Hosting cost is near zero; the game keeps calling if the network drops after load.
- Two HTML shells (`index.html` prerendered pages, `app.html` for private routes) must stay in sync.
- No SSR framework; anything dynamic for crawlers needs the middleware or a prerender step.
