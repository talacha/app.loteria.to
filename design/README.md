# design/

Source files for the "Feria de noche" look. The written guide is `docs/DESIGN.md`.

- `tokens.json` is the single source of truth for colours, type, space, radius, border, shadow, size, motion and the light-theme overrides (`theme.light`). `src/app/theme/tokens.css` must match it; `src/app/theme/tokens.test.ts` fails on drift and checks contrast.
- `look-and-feel/` mirrors the Claude Design canvas https://claude.ai/artifact/CanBtUc4RQzxzPZE2BEgWc: `project/*.dc.html` (one board per screen) with `canvas.json` (layout and titles), and `art/` (the card SVGs, same as `public/art/`). Only the orchestrator republishes the canvas; update the mirror here first.
- `og/og.html` is the source of the share images. `pnpm og:render` (needs Playwright Chromium) renders `?variant=default` and `?variant=invite` at 1200 x 630 into `public/og/default.png` and `public/og/invite.png`.
- The approved PDF is `docs/design/look-and-feel.pdf`.

Raw colours, fonts and radii are allowed only here and in `tokens.css`; `pnpm design-lint` enforces it for `src/app`.
